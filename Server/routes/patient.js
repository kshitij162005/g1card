import express from 'express';

const router = express.Router();

// Fetch patient details (safe view, excludes password/salt)
router.get('/:id', async (req, res) => {
  try {
    const Patient = (await import('../models/Patient.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing patient id' });
    const user = await Patient.findById(id).lean();
    if (!user) return res.status(404).json({ error: 'Patient not found' });
    if (user.password) delete user.password;
    if (user.salt) delete user.salt;
    return res.json({ ok: true, patient: user });
  } catch (err) {
    console.error('fetch patient error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Fetch all medical records for a patient (across hospitals)
router.get('/:id/records', async (req, res) => {
  try {
    const Record = (await import('../models/Record.js')).default;
    // Import FormTemplate to register the schema for populate
    await import('../models/FormTemplate.js');
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing patient id' });

    const records = await Record.find({ patient: id })
      .populate('hospital', '_id name')
      .populate('form', 'name description fields')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ ok: true, records });
  } catch (err) {
    console.error('fetch patient records error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// List consent access requests for a patient
router.get('/:id/access-requests', async (req, res) => {
  try {
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing patient id' });
    const statusFilter = (req.query.status || '').toString().toUpperCase();

    const filter = { patient: id };
    if (statusFilter && ['PENDING', 'APPROVED', 'DENIED'].includes(statusFilter)) {
      filter.status = statusFilter;
    }

    const requests = await HospitalAccess.find(filter)
      .populate('hospital', '_id name')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      ok: true,
      requests: requests.map(r => ({
        id: r._id,
        hospitalId: r.hospital?._id,
        hospitalName: r.hospital?.name,
        status: r.status,
        accessLevel: r.accessLevel,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err) {
    console.error('list access requests error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Approve or deny a consent request
router.post('/:id/access-requests/:accessId/decision', async (req, res) => {
  try {
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    const id = req.params.id;
    const accessId = req.params.accessId;
    if (!id || !accessId) return res.status(400).json({ error: 'Missing patient id or access id' });

    const { decision, accessLevel } = req.body || {};
    if (!decision || !['APPROVE', 'DENY'].includes(decision.toUpperCase())) {
      return res.status(400).json({ error: 'decision must be APPROVE or DENY' });
    }

    const access = await HospitalAccess.findOne({ _id: accessId, patient: id });
    if (!access) return res.status(404).json({ error: 'Access request not found' });

    if (decision.toUpperCase() === 'DENY') {
      access.status = 'DENIED';
      access.accessLevel = null;
    } else {
      const level = (accessLevel || '').toString().toUpperCase();
      if (!['GENERAL', 'COMPLETE'].includes(level)) {
        return res.status(400).json({ error: 'accessLevel must be GENERAL or COMPLETE when approving' });
      }
      access.status = 'APPROVED';
      access.accessLevel = level;
    }

    await access.save();

    return res.json({
      ok: true,
      accessRequest: {
        id: access._id,
        status: access.status,
        accessLevel: access.accessLevel,
        hospitalId: access.hospital,
        updatedAt: access.updatedAt,
      },
    });
  } catch (err) {
    console.error('update access decision error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Update patient fields (health summary and profile fields)
router.patch('/:id', async (req, res) => {
  try {
    const Patient = (await import('../models/Patient.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing patient id' });
    const allowed = ['bloodGroup', 'age', 'height', 'weight', 'bmi', 'allergies', 'conditions', 'surgeries', 'medications', 'familyHistory', 'smoking', 'firstName', 'lastName', 'phone', 'address', 'emergencyContactName', 'emergencyContactPhone', 'email', 'dob', 'gender'];
    const updates = {};
    for (const k of Object.keys(req.body || {})) {
      if (allowed.includes(k)) updates[k] = req.body[k];
    }
    // If DOB is being updated, also recompute age
    if (Object.prototype.hasOwnProperty.call(updates, 'dob')) {
      const { dob } = updates;
      if (dob) {
        const d = new Date(dob);
        if (!Number.isNaN(d.getTime())) {
          const today = new Date();
          let age = today.getFullYear() - d.getFullYear();
          const m = today.getMonth() - d.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
            age--;
          }
          updates.age = age;
        }
      } else {
        // If dob cleared, also clear age
        updates.age = undefined;
      }
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields to update' });
    const updated = await Patient.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Patient not found' });
    if (updated.password) delete updated.password;
    if (updated.salt) delete updated.salt;
    return res.json({ ok: true, patient: updated });
  } catch (err) {
    console.error('update patient error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

export default router;
