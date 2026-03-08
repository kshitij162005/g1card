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
    const search = (req.query.search || '').toString().trim();
    const months = parseInt(req.query.months, 10);
    const years = parseInt(req.query.years, 10);

    const query = {
      $or: [
        { 'actor.id': id },
        { 'target.id': id }
      ]
    };

    const filters = [query];
    if (event) {
      filters.push({ event });
    }
    if (search) {
      filters.push({
        $or: [
          { event: { $regex: search, $options: 'i' } },
          { 'action.description': { $regex: search, $options: 'i' } },
          { 'action.reason': { $regex: search, $options: 'i' } },
          { 'action.denialReason': { $regex: search, $options: 'i' } },
          { 'actor.name': { $regex: search, $options: 'i' } },
          { 'actor.email': { $regex: search, $options: 'i' } },
          { 'target.name': { $regex: search, $options: 'i' } },
          { 'target.identifier': { $regex: search, $options: 'i' } },
          { 'metadata.hospitalName': { $regex: search, $options: 'i' } },
          { 'metadata.patientName': { $regex: search, $options: 'i' } },
        ]
      });
    }
    if (!Number.isNaN(months) && months > 0) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      filters.push({ createdAt: { $gte: cutoff } });
    } else if (!Number.isNaN(years) && years > 0) {
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - years);
      filters.push({ createdAt: { $gte: cutoff } });
    }

    const finalQuery = filters.length > 1 ? { $and: filters } : query;

    const total = await AuditLog.countDocuments(finalQuery);
    const logs = await AuditLog.find(finalQuery)
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
    const search = (req.query.search || '').toString().trim();
    const months = parseInt(req.query.months, 10);
    const years = parseInt(req.query.years, 10);

    const query = {
      $or: [
        { 'actor.id': id },
        { 'target.id': id }
      ]
    };

    const filters = [query];
    if (event) {
      filters.push({ event });
    }
    if (search) {
      filters.push({
        $or: [
          { event: { $regex: search, $options: 'i' } },
          { 'action.description': { $regex: search, $options: 'i' } },
          { 'action.reason': { $regex: search, $options: 'i' } },
          { 'action.denialReason': { $regex: search, $options: 'i' } },
          { 'actor.name': { $regex: search, $options: 'i' } },
          { 'actor.email': { $regex: search, $options: 'i' } },
          { 'target.name': { $regex: search, $options: 'i' } },
          { 'target.identifier': { $regex: search, $options: 'i' } },
          { 'metadata.hospitalName': { $regex: search, $options: 'i' } },
          { 'metadata.patientName': { $regex: search, $options: 'i' } },
        ]
      });
    }
    if (!Number.isNaN(months) && months > 0) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      filters.push({ createdAt: { $gte: cutoff } });
    } else if (!Number.isNaN(years) && years > 0) {
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - years);
      filters.push({ createdAt: { $gte: cutoff } });
    }

    const finalQuery = filters.length > 1 ? { $and: filters } : query;

    const total = await AuditLog.countDocuments(finalQuery);
    const logs = await AuditLog.find(finalQuery)
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
