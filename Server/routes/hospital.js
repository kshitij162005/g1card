import express from 'express';
import { logAccessRequestCreation, logRecordCreation, logPHIAccess } from '../utils/auditLogger.js';
import { sendEventToUser } from './sse.js';

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
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    const Record = (await import('../models/Record.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing hospital id' });
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

    const [patientsApproved, patientsPending, recordsTotal, recentAccess] = await Promise.all([
      HospitalAccess.countDocuments({ hospital: id, status: 'APPROVED' }),
      HospitalAccess.countDocuments({ hospital: id, status: 'PENDING' }),
      Record.countDocuments({ hospital: id }),
      HospitalAccess.find({ hospital: id, status: 'APPROVED' })
        .populate('patient', 'name firstName lastName email phone gender patientId')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const recentPatients = recentAccess
      .filter(access => access.patient)
      .map(access => {
        const p = access.patient;
        return {
          id: p._id,
          patientId: p.patientId || p._id,
          name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unknown',
          email: p.email || '',
          phone: p.phone || '',
          gender: p.gender || '',
          createdAt: access.createdAt,
        };
      });

    const metrics = {
      patientsTotal: patientsApproved,
      patientsPending,
      recordsTotal,
      recentPatients,
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

// Create a consent-based access request for an existing patient
// Expected body: { email, password }
router.post('/:id/patients', async (req, res) => {
  try {
    const crypto = await import('crypto');
    const Hospital = (await import('../models/Hospital.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
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

    // Either create new or reset existing access to PENDING
    const access = await HospitalAccess.findOneAndUpdate(
      { hospital: hospital._id, patient: patient._id },
      { $set: { status: 'PENDING', accessLevel: null } },
      { upsert: true, new: true }
    );

    // Create audit log for access request creation
    await logAccessRequestCreation({
      hospitalId: hospital._id,
      hospitalName: hospital.name,
      patientId: patient._id,
      patientName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient',
      accessId: access._id,
      req
    });

    // Create notification in database for patient
    const Notification = (await import('../models/Notification.js')).default;
    const notification = await Notification.create({
      type: 'ACCESS_REQUEST',
      recipient: patient._id,
      recipientModel: 'Patient',
      sender: hospital._id,
      senderModel: 'Hospital',
      title: 'New Access Request',
      message: `${hospital.name} is requesting access to your medical records.`,
      metadata: {
        hospitalId: hospital._id,
        hospitalName: hospital.name,
        accessId: access._id
      },
      relatedAccess: access._id,
      actionUrl: '/patient/notifications'
    });

    // Send real-time notification to patient via SSE
    sendEventToUser('Patient', patient._id.toString(), {
      type: 'NEW_ACCESS_REQUEST',
      title: 'New Access Request',
      message: `${hospital.name} is requesting access to your medical records.`,
      timestamp: new Date().toISOString(),
      hospitalName: hospital.name,
      accessId: access._id.toString(),
      notificationId: notification._id.toString()
    });

    return res.json({
      ok: true,
      accessRequest: {
        id: access._id,
        status: access.status,
        accessLevel: access.accessLevel,
        createdAt: access.createdAt,
      },
      message: 'Access request created. Waiting for patient consent.',
    });
  } catch (err) {
    console.error('create/link patient error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Resend an existing access request for a linked patient (no password needed)
router.post('/:id/patients/:patientId/resend-access', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const id = req.params.id;
    const patientId = req.params.patientId;
    if (!id || !patientId) return res.status(400).json({ error: 'Missing hospital id or patient id' });

    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const access = await HospitalAccess.findOneAndUpdate(
      { hospital: hospital._id, patient: patient._id },
      { $set: { status: 'PENDING', accessLevel: null } },
      { new: true }
    );
    if (!access) return res.status(404).json({ error: 'Access request not found to resend' });

    // Create audit log for resend
    await logAccessRequestCreation({
      hospitalId: hospital._id,
      hospitalName: hospital.name,
      patientId: patient._id,
      patientName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient',
      accessId: access._id,
      req
    });

    // Create notification in database for patient
    const notification = await Notification.create({
      type: 'ACCESS_REQUEST',
      recipient: patient._id,
      recipientModel: 'Patient',
      sender: hospital._id,
      senderModel: 'Hospital',
      title: 'New Access Request',
      message: `${hospital.name} is requesting access to your medical records again.`,
      metadata: {
        hospitalId: hospital._id,
        hospitalName: hospital.name,
        accessId: access._id,
        isResend: true
      },
      relatedAccess: access._id,
      actionUrl: '/patient/notifications'
    });

    // Send real-time notification to patient via SSE
    sendEventToUser('Patient', patient._id.toString(), {
      type: 'NEW_ACCESS_REQUEST',
      title: 'New Access Request',
      message: `${hospital.name} is requesting access to your medical records again.`,
      timestamp: new Date().toISOString(),
      hospitalName: hospital.name,
      accessId: access._id.toString(),
      notificationId: notification._id.toString()
    });

    return res.json({
      ok: true,
      accessRequest: {
        id: access._id,
        status: access.status,
        accessLevel: access.accessLevel,
        createdAt: access.createdAt,
      },
      message: 'Access request resent to patient.',
    });
  } catch (err) {
    console.error('resend access error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// List patients & consent status for hospital with pagination and search
router.get('/:id/patients', async (req, res) => {
  try {
    const Patient = (await import('../models/Patient.js')).default;
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    const id = req.params.id;
    const q = (req.query.q || '').toString().trim();
    const page = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10')));

    const baseFilter = { hospital: id };
    const accessDocs = await HospitalAccess.find(baseFilter)
      .populate('patient', 'name firstName lastName email dob patientId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const allForCount = await HospitalAccess.countDocuments(baseFilter);

    const patients = accessDocs
      .filter(doc => !!doc.patient)
      .filter(doc => {
        if (!q) return true;
        const p = doc.patient;
        const name = p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim();
        const email = p.email || '';
        const pid = p.patientId || '';
        const needle = q.toLowerCase();
        return (
          name.toLowerCase().includes(needle) ||
          email.toLowerCase().includes(needle) ||
          String(pid).toLowerCase().includes(needle)
        );
      })
      .map(doc => {
        const p = doc.patient;
        const safeName = p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim();
        return {
          _id: p._id,
          patientId: p.patientId || p._id,
          name: safeName || 'Unknown',
          dob: p.dob || '',
          status: doc.status,
          accessLevel: doc.accessLevel,
          requestedAt: doc.createdAt,
        };
      });

    return res.json({ ok: true, total: allForCount, page, limit, patients });
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

    const hospitalIdStr = hospital._id.toString();

    // Check if patient is linked to this hospital (in hospitals array or legacy field)
    const inHospitalsArray = patient.hospitals && patient.hospitals.some(h => h.toString() === hospitalIdStr);
    const inLegacyField = patient.hospital && patient.hospital.toString() === hospitalIdStr;

    if (!inHospitalsArray && !inLegacyField) {
      return res.status(400).json({ error: 'Patient is not linked to this hospital' });
    }

    // Remove from hospitals array
    if (patient.hospitals) {
      patient.hospitals = patient.hospitals.filter(h => h.toString() !== hospitalIdStr);
    }

    // Clear legacy hospital field if it matches
    if (patient.hospital && patient.hospital.toString() === hospitalIdStr) {
      // Set to another hospital if available, otherwise null
      patient.hospital = patient.hospitals && patient.hospitals.length > 0 ? patient.hospitals[0] : null;
    }

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

    // check patient linked to hospital (in hospitals array or legacy field)
    const hospitalIdStr = hospital._id.toString();
    const inHospitalsArray = patient.hospitals && patient.hospitals.some(h => h.toString() === hospitalIdStr);
    const inLegacyField = patient.hospital && patient.hospital.toString() === hospitalIdStr;
    if (!inHospitalsArray && !inLegacyField) {
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

    // Get form name for audit logging
    let formName = 'Medical Record';
    if (formId) {
      const formTemplate = await FormTemplate.findById(formId).lean();
      formName = formTemplate?.name || formName;
    }

    // Get consent information for audit logging
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    const access = await HospitalAccess.findOne({ hospital: hospital._id, patient: patient._id }).lean();

    // Create audit log for record creation
    await logRecordCreation({
      hospitalId: hospital._id,
      hospitalName: hospital.name,
      patientId: patient._id,
      patientName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient',
      recordId: rec._id,
      formName,
      consentId: access?._id,
      req
    });

    // Notify patient about new medical record
    const Notification = (await import('../models/Notification.js')).default;
    const notification = await Notification.create({
      type: 'MEDICAL_RECORD_CREATED',
      recipient: patient._id,
      recipientModel: 'Patient',
      sender: hospital._id,
      senderModel: 'Hospital',
      title: 'New Medical Record Added',
      message: `${hospital.name} has added a new ${formName} to your medical records.`,
      metadata: {
        hospitalId: hospital._id,
        hospitalName: hospital.name,
        recordId: rec._id,
        formName
      },
      actionUrl: '/patient/health-history'
    });

    // Send real-time notification via SSE
    sendEventToUser('Patient', patient._id.toString(), {
      type: 'MEDICAL_RECORD_CREATED',
      title: 'New Medical Record Added',
      message: `${hospital.name} has added a new ${formName} to your medical records.`,
      timestamp: new Date().toISOString(),
      hospitalName: hospital.name,
      recordId: rec._id.toString(),
      notificationId: notification._id.toString()
    });

    return res.json({ ok: true, record: rec });
  } catch (err) {
    console.error('submit record error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get records for a patient, respecting consent access level
router.get('/:id/patients/:patientId/records', async (req, res) => {
  try {
    const Record = (await import('../models/Record.js')).default;
    const FormTemplate = (await import('../models/FormTemplate.js')).default;
    const Hospital = (await import('../models/Hospital.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    const id = req.params.id;
    const patientId = req.params.patientId;
    if (!id || !patientId) return res.status(400).json({ error: 'Missing hospital id or patient id' });
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Check consent access
    const access = await HospitalAccess.findOne({ hospital: hospital._id, patient: patient._id }).lean();
    if (!access || access.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Access to patient records not approved' });
    }

    // Update lastAccessed timestamp
    await HospitalAccess.findByIdAndUpdate(access._id, { lastAccessed: new Date() });

    const recordFilter = { patient: patient._id };
    if (access.accessLevel === 'GENERAL') {
      // Only this hospital's own records
      recordFilter.hospital = hospital._id;
    }
    // For COMPLETE access, show all hospitals' records for this patient

    const records = await Record.find(recordFilter)
      .populate('hospital', '_id name')
      .populate('form', 'name description fields')
      .sort({ createdAt: -1 })
      .lean();

    // Create audit log for PHI access
    await logPHIAccess({
      hospitalId: hospital._id,
      hospitalName: hospital.name,
      patientId: patient._id,
      patientName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Patient',
      recordId: records.length > 0 ? records[0]._id : null,
      recordType: records.length > 0 ? (records[0].form?.name || 'Medical Records') : 'Medical Records',
      accessLevel: access.accessLevel,
      consentId: access._id,
      req
    });

    // Notify patient about record access (only if there are records to view)
    if (records.length > 0) {
      const Notification = (await import('../models/Notification.js')).default;
      
      // Check if we already notified recently to avoid spam (within last 5 minutes)
      const recentNotification = await Notification.findOne({
        type: 'RECORDS_ACCESSED',
        recipient: patient._id,
        sender: hospital._id,
        createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
      });

      if (!recentNotification) {
        const notification = await Notification.create({
          type: 'RECORDS_ACCESSED',
          recipient: patient._id,
          recipientModel: 'Patient',
          sender: hospital._id,
          senderModel: 'Hospital',
          title: 'Medical Records Accessed',
          message: `${hospital.name} viewed your medical records (${access.accessLevel === 'COMPLETE' ? 'Complete Access' : 'General Access'}).`,
          metadata: {
            hospitalId: hospital._id,
            hospitalName: hospital.name,
            accessLevel: access.accessLevel,
            recordCount: records.length
          }
        });

        // Send real-time notification via SSE
        sendEventToUser('Patient', patient._id.toString(), {
          type: 'RECORDS_ACCESSED',
          title: 'Medical Records Accessed',
          message: `${hospital.name} viewed your medical records.`,
          timestamp: new Date().toISOString(),
          hospitalName: hospital.name,
          notificationId: notification._id.toString()
        });
      }
    }

    return res.json({ ok: true, records, accessLevel: access.accessLevel });
  } catch (err) {
    console.error('fetch records error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get patient summary for a hospital, applying consent access level
router.get('/:id/patients/:patientId/summary', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;

    const id = req.params.id;
    const patientId = req.params.patientId;
    if (!id || !patientId) return res.status(400).json({ error: 'Missing hospital id or patient id' });

    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const patient = await Patient.findById(patientId).lean();
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const access = await HospitalAccess.findOne({ hospital: hospital._id, patient: patient._id }).lean();
    if (!access || access.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Access to patient profile not approved' });
    }

    // Update lastAccessed timestamp
    await HospitalAccess.findByIdAndUpdate(access._id, { lastAccessed: new Date() });

    const base = {
      id: patient._id,
      name: patient.name || `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
      dob: patient.dob,
      age: patient.age,
      gender: patient.gender,
      phone: patient.phone,
      email: patient.email,
      address: patient.address,
      lastUpdated: patient.updatedAt,
      created: patient.createdAt,
    };

    const clinicalSummary = {
      conditions: patient.conditions || [],
      medications: patient.medications || [],
      surgeries: patient.surgeries || [],
      immunizationRecords: patient.immunizationRecords || patient.immunizations || [],
    };

    if (access.accessLevel === 'GENERAL') {
      return res.json({ ok: true, patient: { ...base, ...clinicalSummary }, accessLevel: access.accessLevel });
    }

    const extended = {
      ...base,
      bloodGroup: patient.bloodGroup,
      height: patient.height,
      weight: patient.weight,
      bmi: patient.bmi,
      allergies: patient.allergies || [],
      ...clinicalSummary,
    };

    return res.json({ ok: true, patient: extended, accessLevel: access.accessLevel });
  } catch (err) {
    console.error('fetch patient summary error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Request complete access upgrade (from GENERAL to COMPLETE)
router.post('/:id/patients/:patientId/request-complete-access', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    const Notification = (await import('../models/Notification.js')).default;

    const id = req.params.id;
    const patientId = req.params.patientId;
    if (!id || !patientId) return res.status(400).json({ error: 'Missing hospital id or patient id' });

    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const access = await HospitalAccess.findOne({ hospital: hospital._id, patient: patient._id });
    console.log('Access found:', access ? { status: access.status, accessLevel: access.accessLevel } : 'null');
    
    if (!access || access.status !== 'APPROVED') {
      console.log('Access check failed:', { hasAccess: !!access, status: access?.status });
      return res.status(403).json({ error: 'Access to patient profile not approved' });
    }

    console.log('Current access level:', access.accessLevel);
    if (access.accessLevel === 'COMPLETE') {
      console.log('Already has complete access');
      return res.status(400).json({ error: 'You already have complete access to this patient' });
    }

    // Check if there's already a pending upgrade request for the CURRENT access state
    // Only block if there's an unread notification AND the access level hasn't changed
    const existingNotification = await Notification.findOne({
      type: 'ACCESS_UPGRADE_REQUEST',
      recipient: patient._id,
      sender: hospital._id,
      relatedAccess: access._id,
      isRead: false
    });

    console.log('Existing notification:', existingNotification ? 'found' : 'not found');
    if (existingNotification) {
      // Check if the metadata matches current state (i.e., patient hasn't changed access level since)
      const currentAccessMatches = existingNotification.metadata?.currentAccessLevel === access.accessLevel;
      if (currentAccessMatches) {
        console.log('Already has pending request for current access level');
        return res.status(400).json({ error: 'You have already requested complete access. Please wait for the patient to respond.' });
      } else {
        // Access level has changed since last request, mark old notification as read/obsolete
        console.log('Access level changed since last request, marking old notification as obsolete');
        existingNotification.isRead = true;
        existingNotification.readAt = new Date();
        await existingNotification.save();
      }
    }

    console.log('Creating notification for patient:', patient._id);
    // Create notification for patient
    const notification = await Notification.create({
      type: 'ACCESS_UPGRADE_REQUEST',
      recipient: patient._id,
      recipientModel: 'Patient',
      sender: hospital._id,
      senderModel: 'Hospital',
      title: 'Complete Access Request',
      message: `${hospital.name} has requested to upgrade their access level from Partial Access to Complete Access.`,
      metadata: {
        hospitalId: hospital._id,
        hospitalName: hospital.name,
        currentAccessLevel: access.accessLevel,
        requestedAccessLevel: 'COMPLETE'
      },
      relatedAccess: access._id,
      actionUrl: '/patient/settings'
    });

    // Send real-time notification to patient via SSE
    sendEventToUser('Patient', patient._id.toString(), {
      type: 'ACCESS_UPGRADE_REQUEST',
      title: 'Complete Access Request',
      message: `${hospital.name} has requested to upgrade their access level from Partial Access to Complete Access.`,
      timestamp: new Date().toISOString(),
      hospitalName: hospital.name,
      notificationId: notification._id.toString()
    });

    return res.json({ 
      ok: true, 
      message: 'Complete access request sent to patient',
      notification: notification
    });
  } catch (err) {
    console.error('request complete access error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get notification counts for hospital (lightweight endpoint for badges)
router.get('/:id/notifications/count', async (req, res) => {
  try {
    const Notification = (await import('../models/Notification.js')).default;
    const id = req.params.id;

    if (!id) return res.status(400).json({ error: 'Missing hospital id' });

    // Count unread notifications
    const unreadCount = await Notification.countDocuments({
      recipient: id,
      recipientModel: 'Hospital',
      isRead: false
    });

    return res.json({
      ok: true,
      counts: {
        unread: unreadCount,
        total: unreadCount
      }
    });
  } catch (err) {
    console.error('notification count error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get notifications for a hospital
router.get('/:id/notifications', async (req, res) => {
  try {
    const Notification = (await import('../models/Notification.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing hospital id' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filter = req.query.filter || 'all'; // 'all' or 'unread'
    const searchQuery = req.query.search || '';

    console.log('Fetching notifications for hospital:', id, { page, limit, filter, searchQuery });
    
    // Build query
    const query = { 
      recipient: id, 
      recipientModel: 'Hospital' 
    };

    // Apply filter
    if (filter === 'unread') {
      query.isRead = false;
    }

    // Apply search (search in title, message, or sender name)
    if (searchQuery) {
      query.$or = [
        { title: { $regex: searchQuery, $options: 'i' } },
        { message: { $regex: searchQuery, $options: 'i' } }
      ];
    }

    // Get total counts
    const totalCount = await Notification.countDocuments({ 
      recipient: id, 
      recipientModel: 'Hospital',
      ...(searchQuery ? { $or: query.$or } : {})
    });
    
    const unreadCount = await Notification.countDocuments({ 
      recipient: id, 
      recipientModel: 'Hospital',
      isRead: false,
      ...(searchQuery ? { $or: query.$or } : {})
    });

    // Get paginated notifications
    const skip = (page - 1) * limit;
    const notifications = await Notification.find(query)
      .populate('sender', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Notification.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    console.log('Found notifications:', notifications.length, 'Total:', total, 'TotalCount:', totalCount, 'UnreadCount:', unreadCount);

    return res.json({
      ok: true,
      notifications: notifications.map(n => ({
        id: n._id.toString(),
        type: n.type,
        title: n.title,
        message: n.message,
        metadata: n.metadata,
        isRead: n.isRead,
        readAt: n.readAt,
        actionUrl: n.actionUrl,
        relatedAccess: n.relatedAccess,
        sender: n.sender,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
      pagination: {
        total: total, // Total matching current filter
        pages: totalPages,
        page: page,
        limit: limit
      },
      totalCount: totalCount, // Total all notifications
      unreadCount: unreadCount // Total unread notifications
    });
  } catch (err) {
    console.error('fetch notifications error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Mark hospital notification as read
router.patch('/:id/notifications/:notificationId/read', async (req, res) => {
  try {
    const Notification = (await import('../models/Notification.js')).default;
    const id = req.params.id;
    const notificationId = req.params.notificationId;
    if (!id || !notificationId) {
      return res.status(400).json({ error: 'Missing hospital id or notification id' });
    }

    const notification = await Notification.findOne({ 
      _id: notificationId, 
      recipient: id,
      recipientModel: 'Hospital'
    });
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return res.json({ ok: true, notification });
  } catch (err) {
    console.error('mark notification read error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

export default router;

