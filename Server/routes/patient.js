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
