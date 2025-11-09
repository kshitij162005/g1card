import express from 'express';
import { mongoose } from './db.js';

const router = express.Router();

// Health endpoint — includes DB status
router.get('/health', (req, res) => {
  const dbState = mongoose?.connection?.readyState ?? 0; // 0 = disconnected, 1 = connected
  res.json({ status: 'ok', uptime: process.uptime(), dbState });
});

// Root of API
router.get('/', (req, res) => {
  res.json({ message: 'g1card API root', version: '0.1.0' });
});

// Example echo endpoint
router.post('/echo', (req, res) => {
  res.json({ received: req.body });
});

// Dev-only seed endpoint to insert sample data (protected by ?confirm=true)
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

// Dev-only seed endpoint to insert sample data (protected by ?confirm=true)
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

export default router;
