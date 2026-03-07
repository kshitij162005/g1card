import express from 'express';

const router = express.Router();

// Get audit logs for a patient
router.get('/patient/:id', async (req, res) => {
  try {
    const AuditLog = (await import('../models/AuditLog.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing patient id' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const event = req.query.event; // Optional filter by event type

    const query = {
      $or: [
        { 'actor.id': id },
        { 'target.id': id }
      ]
    };

    if (event) {
      query.event = event;
    }

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({
      ok: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('fetch patient audit logs error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get audit logs for a hospital
router.get('/hospital/:id', async (req, res) => {
  try {
    const AuditLog = (await import('../models/AuditLog.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing hospital id' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const event = req.query.event; // Optional filter by event type

    const query = {
      $or: [
        { 'actor.id': id },
        { 'target.id': id }
      ]
    };

    if (event) {
      query.event = event;
    }

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({
      ok: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('fetch hospital audit logs error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get audit logs related to a specific consent/access
router.get('/access/:accessId', async (req, res) => {
  try {
    const AuditLog = (await import('../models/AuditLog.js')).default;
    const accessId = req.params.accessId;
    if (!accessId) return res.status(400).json({ error: 'Missing access id' });

    const logs = await AuditLog.find({
      'compliance.consentId': accessId
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      ok: true,
      logs
    });
  } catch (err) {
    console.error('fetch access audit logs error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get summary statistics for audit logs
router.get('/stats/:entityId', async (req, res) => {
  try {
    const AuditLog = (await import('../models/AuditLog.js')).default;
    const entityId = req.params.entityId;
    if (!entityId) return res.status(400).json({ error: 'Missing entity id' });

    const query = {
      $or: [
        { 'actor.id': entityId },
        { 'target.id': entityId }
      ]
    };

    const [eventStats, severityStats, outcomeStats] = await Promise.all([
      AuditLog.aggregate([
        { $match: query },
        { $group: { _id: '$event', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      AuditLog.aggregate([
        { $match: query },
        { $group: { _id: '$severity', count: { $sum: 1 } } }
      ]),
      AuditLog.aggregate([
        { $match: query },
        { $group: { _id: '$action.outcome', count: { $sum: 1 } } }
      ])
    ]);

    return res.json({
      ok: true,
      stats: {
        byEvent: eventStats,
        bySeverity: severityStats,
        byOutcome: outcomeStats
      }
    });
  } catch (err) {
    console.error('fetch audit stats error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

export default router;
