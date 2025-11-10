import express from 'express';
import crypto from 'crypto';
import { mongoose } from './db.js';

const router = express.Router();

// --- Helpers: SHA-256 based hashing with salt (uses PBKDF2 with sha256 for stronger derivation) ---
function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashWithSalt(password, salt) {
  // PBKDF2 with SHA-256, 100k iterations, 64 byte key
  const derived = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha256');
  return derived.toString('hex');
}

// Health endpoint — includes DB status
router.get('/health', (req, res) => {
  const dbState = mongoose?.connection?.readyState ?? 0; // 0 = disconnected, 1 = connected
  res.json({ status: 'ok', uptime: process.uptime(), dbState });
});

// Root of API
router.get('/', (req, res) => {
  res.json({ message: 'g1card API root', version: '0.1.0' });
});

// Echo endpoint
router.post('/echo', (req, res) => {
  res.json({ received: req.body });
});

// Auth: signup for patient
router.post('/auth/signup/patient', async (req, res) => {
  try {
    const Patient = (await import('./models/Patient.js')).default;
    const { email, password, firstName, lastName, dob, gender, phone, address, emergencyContactName, emergencyContactPhone, allergies, conditions, surgeries, medications, familyHistory, smoking } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

    const exists = await Patient.findOne({ username: email });
    if (exists) return res.status(409).json({ error: 'User already exists' });

    const salt = generateSalt();
    const passwordHash = hashWithSalt(password, salt);

    const doc = new Patient({
      username: email,
      password: passwordHash,
      salt,
      email,
      firstName,
      lastName,
      dob,
      gender,
      phone,
      address,
      emergencyContactName,
      emergencyContactPhone,
      allergies,
      conditions,
      surgeries,
      medications,
      familyHistory,
      smoking,
    });

    await doc.save();
    return res.json({ ok: true, id: doc._id, message: 'Patient registered' });
  } catch (err) {
    console.error('signup patient error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Auth: signup for hospital
router.post('/auth/signup/hospital', async (req, res) => {
  try {
    const Hospital = (await import('./models/Hospital.js')).default;
    const { hospitalName, regNumber, address, city, state, pin, license, email, phone, website, adminName, adminEmail, adminPhone, designation, password } = req.body;
    if (!email || !password || !hospitalName) return res.status(400).json({ error: 'hospitalName, email and password are required' });

    const exists = await Hospital.findOne({ username: email });
    if (exists) return res.status(409).json({ error: 'Hospital already exists' });

    const salt = generateSalt();
    const passwordHash = hashWithSalt(password, salt);

    const doc = new Hospital({
      name: hospitalName,
      username: email,
      password: passwordHash,
      salt,
      regNumber,
      address,
      city,
      state,
      pin,
      license,
      contactEmail: email,
      phone,
      website,
      adminName,
      adminEmail,
      adminPhone,
      designation,
    });

    await doc.save();
    return res.json({ ok: true, id: doc._id, message: 'Hospital registered' });
  } catch (err) {
    console.error('signup hospital error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Auth: login for any role
router.post('/auth/login', async (req, res) => {
  try {
    const { role, email, password } = req.body;
    if (!role || !email || !password) return res.status(400).json({ error: 'role, email and password required' });

    // Superadmin: authenticate from DB (no UI creation allowed). Username is treated as email.
    if (role === 'Super Admin' || role === 'Super_Admin' || role === 'SUPER_ADMIN') {
      const Superadmin = (await import('./models/Superadmin.js')).default;
      const user = await Superadmin.findOne({ username: email });
      if (!user) return res.status(401).json({ error: 'Superadmin not found' });
      const computed = hashWithSalt(password, user.salt || '');
      if (computed === user.password) {
        return res.json({ ok: true, user: { id: user._id, email: user.username, name: 'Super Admin', role: 'Super Admin' } });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (role === 'Patient' || role === 'PATIENT') {
      const Patient = (await import('./models/Patient.js')).default;
      const user = await Patient.findOne({ username: email });
      if (!user) return res.status(401).json({ error: 'User not found' });
      const computed = hashWithSalt(password, user.salt || '');
      if (computed === user.password) {
        // update lastAccess timestamp
        try {
          user.lastAccess = new Date();
          await user.save();
        } catch (e) {
          console.warn('Could not update lastAccess for user', e && e.message ? e.message : e);
        }
        return res.json({ ok: true, user: { id: user._id, email: user.email || user.username, name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(), role: 'Patient', lastAccess: user.lastAccess } });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (role === 'Hospital' || role === 'HOSPITAL') {
      const Hospital = (await import('./models/Hospital.js')).default;
      const user = await Hospital.findOne({ username: email });
      if (!user) return res.status(401).json({ error: 'Hospital not found' });
      const computed = hashWithSalt(password, user.salt || '');
      if (computed === user.password) {
        return res.json({ ok: true, user: { id: user._id, email: user.contactEmail || user.username, name: user.name, role: 'Hospital' } });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.status(400).json({ error: 'Unknown role' });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Dev-only seed endpoint retained (kept for compatibility)
router.post('/seed', async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Forbidden in production' });
    if (req.query.confirm !== 'true') return res.status(400).json({ error: 'Missing confirm=true query param' });

    const bcrypt = await import('bcryptjs');
    const Patient = (await import('./models/Patient.js')).default;
    const Hospital = (await import('./models/Hospital.js')).default;
    const Superadmin = (await import('./models/Superadmin.js')).default;

    const pwSalt = await bcrypt.genSalt(10);
    const patientPw = await bcrypt.hash('patientpass', pwSalt);
    const hospitalPw = await bcrypt.hash('hospitalpass', pwSalt);
    const adminPw = await bcrypt.hash('superpass', pwSalt);

    await Patient.updateOne({ username: 'patient1' }, { $setOnInsert: { username: 'patient1', password: patientPw, name: 'Test Patient' } }, { upsert: true });
    await Hospital.updateOne({ username: 'hospital1' }, { $setOnInsert: { name: 'Test Hospital', username: 'hospital1', password: hospitalPw, address: '123 Main St' } }, { upsert: true });
    await Superadmin.updateOne({ username: 'admin' }, { $setOnInsert: { username: 'admin', password: adminPw, role: 'superadmin' } }, { upsert: true });

    return res.json({ ok: true, message: 'Seeded sample Patient, Hospital and Superadmin' });
  } catch (err) {
    console.error('Seed endpoint error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Fetch patient details (safe view, excludes password/salt)
router.get('/patients/:id', async (req, res) => {
  try {
    const Patient = (await import('./models/Patient.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing patient id' });
    const user = await Patient.findById(id).lean();
    if (!user) return res.status(404).json({ error: 'Patient not found' });
    // remove sensitive fields
    if (user.password) delete user.password;
    if (user.salt) delete user.salt;
    return res.json({ ok: true, patient: user });
  } catch (err) {
    console.error('fetch patient error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Update patient fields (health summary and profile fields)
router.patch('/patients/:id', async (req, res) => {
  try {
    const Patient = (await import('./models/Patient.js')).default;
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
