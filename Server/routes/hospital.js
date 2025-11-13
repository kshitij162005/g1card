import express from 'express';

const router = express.Router();

// Placeholder: fetch hospital by id (safe view)
router.get('/:id', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing hospital id' });
    const doc = await Hospital.findById(id).lean();
    if (!doc) return res.status(404).json({ error: 'Hospital not found' });
    if (doc.password) delete doc.password;
    if (doc.salt) delete doc.salt;
    return res.json({ ok: true, hospital: doc });
  } catch (err) {
    console.error('fetch hospital error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get dashboard metrics for hospital
router.get('/:id/dashboard-metrics', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const Staff = (await import('../models/Staff.js')).default;
    const Record = (await import('../models/Record.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing hospital id' });
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

    const [patientsTotal, staffTotal, recordsTotal, recentPatients] = await Promise.all([
      Patient.countDocuments({ hospital: id }),
      Staff.countDocuments({ hospital: id }),
      Record.countDocuments({ hospital: id }),
      Patient.find({ hospital: id }).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    const metrics = {
      patientsTotal,
      staffTotal,
      recordsTotal,
      recentPatients: recentPatients.map(p => ({
        id: p._id,
        patientId: p.patientId || p._id,
        name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unknown',
        email: p.email,
        phone: p.phone,
        gender: p.gender,
        createdAt: p.createdAt,
      })),
    };

    return res.json({ ok: true, metrics });
  } catch (err) {
    console.error('fetch dashboard metrics error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Placeholder: update hospital fields
router.patch('/:id', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing hospital id' });
    // allow update of a few basic fields for now
    const allowed = ['name', 'contactEmail', 'phone', 'address', 'city', 'state', 'website'];
  const updates = {};
    for (const k of Object.keys(req.body || {})) {
      if (allowed.includes(k)) updates[k] = req.body[k];
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields to update' });
    const updated = await Hospital.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Hospital not found' });
    if (updated.password) delete updated.password;
    if (updated.salt) delete updated.salt;
    return res.json({ ok: true, hospital: updated });
  } catch (err) {
    console.error('update hospital error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

function generateUniqueId(prefix = 'X') {
  // short unique id using time + random
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).substring(2, 6);
  return `${prefix}${t}${r}`.toUpperCase();
}

// Create staff member for hospital
router.post('/:id/staff', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const Staff = (await import('../models/Staff.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing hospital id' });
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const { name, email, role, phone } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'name and email required' });

    // generate staffId and ensure uniqueness (best effort)
    let staffId = generateUniqueId('S');
    while (await Staff.findOne({ staffId })) {
      staffId = generateUniqueId('S');
    }

    const doc = new Staff({ staffId, hospital: hospital._id, name, email, role, phone });
    await doc.save();
    return res.json({ ok: true, staff: { id: doc._id, staffId: doc.staffId, name: doc.name, email: doc.email, role: doc.role, status: doc.status } });
  } catch (err) {
    console.error('create staff error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// List staff for a hospital with pagination and global search
router.get('/:id/staff', async (req, res) => {
  try {
    const Staff = (await import('../models/Staff.js')).default;
    const id = req.params.id;
    const q = (req.query.q || '').toString().trim();
    const page = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10')));
    const filter = { hospital: id };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { staffId: { $regex: q, $options: 'i' } },
      ];
    }
    const total = await Staff.countDocuments(filter);
    const docs = await Staff.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    return res.json({ ok: true, total, page, limit, staff: docs });
  } catch (err) {
    console.error('list staff error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Create/link patient under hospital by verifying existing patient credentials
// Expected body: { email, password }
router.post('/:id/patients', async (req, res) => {
  try {
    const crypto = await import('crypto');
    const Hospital = (await import('../models/Hospital.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing hospital id' });
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    // find existing patient by username or email
    const patient = await Patient.findOne({ $or: [{ username: email }, { email }] });
    if (!patient) return res.status(404).json({ error: 'Patient not found in system' });

    // patient must have a password & salt saved (self-registered). If not, we cannot verify.
    if (!patient.password || !patient.salt) return res.status(400).json({ error: 'Patient does not have credentials to verify' });

    // PBKDF2-SHA256, 100k iterations, 64 byte key (same as auth flow)
    const computed = crypto.pbkdf2Sync(password, patient.salt, 100000, 64, 'sha256').toString('hex');
    if (computed !== patient.password) return res.status(401).json({ error: 'Invalid patient credentials' });

    // Link patient to hospital (if not already linked)
    if (!patient.hospital || patient.hospital.toString() !== hospital._id.toString()) {
      patient.hospital = hospital._id;
      await patient.save();
    }

    const safe = patient.toObject();
    if (safe.password) delete safe.password;
    if (safe.salt) delete safe.salt;

    return res.json({ ok: true, patient: { id: safe._id, patientId: safe.patientId, name: safe.name, email: safe.email } });
  } catch (err) {
    console.error('create/link patient error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// List patients for hospital with pagination and global search
router.get('/:id/patients', async (req, res) => {
  try {
    const Patient = (await import('../models/Patient.js')).default;
    const id = req.params.id;
    const q = (req.query.q || '').toString().trim();
    const page = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10')));
    const filter = { hospital: id };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { patientId: { $regex: q, $options: 'i' } },
      ];
    }
    const total = await Patient.countDocuments(filter);
    const docs = await Patient.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
    // remove sensitive fields
    for (const d of docs) {
      if (d.password) delete d.password;
      if (d.salt) delete d.salt;
    }
    return res.json({ ok: true, total, page, limit, patients: docs });
  } catch (err) {
    console.error('list patients error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Unlink (remove) a patient from hospital records (does not delete patient)
router.delete('/:id/patients/:patientId', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const id = req.params.id;
    const patientId = req.params.patientId;
    if (!id || !patientId) return res.status(400).json({ error: 'Missing hospital id or patient id' });
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Only unlink if patient is linked to this hospital
    if (!patient.hospital || patient.hospital.toString() !== hospital._id.toString()) {
      return res.status(400).json({ error: 'Patient is not linked to this hospital' });
    }

    patient.hospital = null;
    await patient.save();
    return res.json({ ok: true, message: 'Patient unlinked from hospital' });
  } catch (err) {
    console.error('unlink patient error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Create a form template for a hospital
router.post('/:id/forms', async (req, res) => {
  try {
    const FormTemplate = (await import('../models/FormTemplate.js')).default;
    const Hospital = (await import('../models/Hospital.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing hospital id' });
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

    const { name, description, fields, createdBy } = req.body || {};
    if (!name || !Array.isArray(fields)) return res.status(400).json({ error: 'name and fields (array) are required' });

    const doc = new FormTemplate({ hospital: hospital._id, name, description, fields, createdBy, active: true });
    await doc.save();
    return res.json({ ok: true, form: doc });
  } catch (err) {
    console.error('create form template error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// List form templates for a hospital
router.get('/:id/forms', async (req, res) => {
  try {
    const FormTemplate = (await import('../models/FormTemplate.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing hospital id' });
    const templates = await FormTemplate.find({ hospital: id }).sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, templates });
  } catch (err) {
    console.error('list form templates error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Check if a form name already exists for a hospital
router.get('/:id/forms/check-name', async (req, res) => {
  try {
    const FormTemplate = (await import('../models/FormTemplate.js')).default;
    const id = req.params.id;
    const name = (req.query.name || '').toString().trim();
    const excludeId = req.query.excludeId;
    if (!id || !name) return res.status(400).json({ error: 'Missing hospital id or name' });
    const filter = { hospital: id, name: { $regex: new RegExp(`^${name}$`, 'i') } };
    if (excludeId) filter._id = { $ne: excludeId };
    const exists = await FormTemplate.findOne(filter).lean();
    return res.json({ ok: true, exists: !!exists });
  } catch (err) {
    console.error('check form name error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get single form template
router.get('/:id/forms/:formId', async (req, res) => {
  try {
    const FormTemplate = (await import('../models/FormTemplate.js')).default;
    const id = req.params.id;
    const formId = req.params.formId;
    if (!id || !formId) return res.status(400).json({ error: 'Missing hospital id or form id' });
    const form = await FormTemplate.findOne({ _id: formId, hospital: id }).lean();
    if (!form) return res.status(404).json({ error: 'Form not found' });
    return res.json({ ok: true, form });
  } catch (err) {
    console.error('get form template error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Update form template fields (including soft delete via active flag)
router.patch('/:id/forms/:formId', async (req, res) => {
  try {
    const FormTemplate = (await import('../models/FormTemplate.js')).default;
    const id = req.params.id;
    const formId = req.params.formId;
    if (!id || !formId) return res.status(400).json({ error: 'Missing hospital id or form id' });

    const allowed = ['name', 'description', 'fields', 'active'];
    const updates = {};
    for (const key of Object.keys(req.body || {})) {
      if (allowed.includes(key)) updates[key] = req.body[key];
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields to update' });

    const form = await FormTemplate.findOneAndUpdate(
      { _id: formId, hospital: id },
      { $set: updates },
      { new: true }
    ).lean();
    if (!form) return res.status(404).json({ error: 'Form not found' });
    return res.json({ ok: true, form });
  } catch (err) {
    console.error('update form template error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Permanently delete a form template
router.delete('/:id/forms/:formId', async (req, res) => {
  try {
    const FormTemplate = (await import('../models/FormTemplate.js')).default;
    const id = req.params.id;
    const formId = req.params.formId;
    if (!id || !formId) return res.status(400).json({ error: 'Missing hospital id or form id' });
    const result = await FormTemplate.findOneAndDelete({ _id: formId, hospital: id });
    if (!result) return res.status(404).json({ error: 'Form not found' });
    return res.json({ ok: true, message: 'Form template deleted permanently' });
  } catch (err) {
    console.error('delete form template error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Submit a filled form (medical record) for a patient
router.post('/:id/patients/:patientId/records', async (req, res) => {
  try {
    const Record = (await import('../models/Record.js')).default;
    const FormTemplate = (await import('../models/FormTemplate.js')).default;
    const Hospital = (await import('../models/Hospital.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const id = req.params.id;
    const patientId = req.params.patientId;
    if (!id || !patientId) return res.status(400).json({ error: 'Missing hospital id or patient id' });
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // check patient linked to hospital
    if (!patient.hospital || patient.hospital.toString() !== hospital._id.toString()) {
      return res.status(400).json({ error: 'Patient is not linked to this hospital' });
    }

    const { formId, data, attachments, createdBy } = req.body || {};
    // formId optional (freeform), but if provided validate
    if (formId) {
      const form = await FormTemplate.findOne({ _id: formId, hospital: id }).lean();
      if (!form) return res.status(400).json({ error: 'Form template not found for this hospital' });
    }

    const rec = new Record({ hospital: hospital._id, patient: patient._id, form: formId, data: data || {}, attachments: attachments || [], createdBy });
    await rec.save();

    return res.json({ ok: true, record: rec });
  } catch (err) {
    console.error('submit record error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get all records for a patient
router.get('/:id/patients/:patientId/records', async (req, res) => {
  try {
    const Record = (await import('../models/Record.js')).default;
    const FormTemplate = (await import('../models/FormTemplate.js')).default;
    const Hospital = (await import('../models/Hospital.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const id = req.params.id;
    const patientId = req.params.patientId;
    if (!id || !patientId) return res.status(400).json({ error: 'Missing hospital id or patient id' });
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // check patient linked to hospital
    if (!patient.hospital || patient.hospital.toString() !== hospital._id.toString()) {
      return res.status(400).json({ error: 'Patient is not linked to this hospital' });
    }

    const records = await Record.find({ hospital: hospital._id, patient: patient._id })
      .populate('form', 'name description fields')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ ok: true, records });
  } catch (err) {
    console.error('fetch records error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Dashboard metrics for hospital
router.get('/:id/dashboard-metrics', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const Staff = (await import('../models/Staff.js')).default;
    const Record = (await import('../models/Record.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing hospital id' });

    const hospital = await Hospital.findById(id).lean();
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

    const [patientsTotal, recentPatients, staffTotal, recordsTotal] = await Promise.all([
      Patient.countDocuments({ hospital: id }),
      Patient.find({ hospital: id }).sort({ createdAt: -1 }).limit(5).select('name patientId createdAt email phone gender').lean(),
      Staff.countDocuments({ hospital: id }),
      Record.countDocuments({ hospital: id }),
    ]);

    return res.json({
      ok: true,
      metrics: {
        patientsTotal,
        staffTotal,
        recordsTotal,
        recentPatients: recentPatients.map(p => ({
          id: p._id,
          patientId: p.patientId || p._id,
          name: p.name || '',
          email: p.email || '',
          phone: p.phone || '',
          gender: p.gender || '',
          createdAt: p.createdAt,
        })),
      },
    });
  } catch (err) {
    console.error('dashboard metrics error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

export default router;

