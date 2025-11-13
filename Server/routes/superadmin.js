import express from 'express';

const router = express.Router();

// Fetch superadmin by id (safe view) - for administrative use only
router.get('/:id', async (req, res) => {
  try {
    const Superadmin = (await import('../models/Superadmin.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing superadmin id' });
    const doc = await Superadmin.findById(id).lean();
    if (!doc) return res.status(404).json({ error: 'Superadmin not found' });
    if (doc.password) delete doc.password;
    if (doc.salt) delete doc.salt;
    return res.json({ ok: true, admin: doc });
  } catch (err) {
    console.error('fetch superadmin error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

export default router;
