import express from 'express';
import mongoose from 'mongoose';

// Treat user search text literally inside Mongo regex queries
const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const router = express.Router();

// Event groups used by the activity timeline's tabs and summary tiles
const EVENT_GROUPS = {
  access: ['PHI_ACCESSED', 'PHI_VIEWED', 'PHI_DOWNLOADED', 'PHI_EXPORTED'],
  consent: ['ACCESS_REQUEST_CREATED', 'ACCESS_REQUEST_APPROVED', 'ACCESS_REQUEST_DENIED', 'ACCESS_REQUEST_UPGRADED', 'ACCESS_REVOKED', 'CONSENT_GRANTED', 'CONSENT_WITHDRAWN'],
  records: ['RECORD_CREATED', 'RECORD_UPDATED', 'RECORD_DELETED'],
  auth: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGED', 'PASSWORD_RESET'],
};

function periodFilter(query) {
  const days = parseInt(query.days, 10);
  const months = parseInt(query.months, 10);
  const years = parseInt(query.years, 10);
  if (!Number.isNaN(days) && days > 0) return { createdAt: { $gte: new Date(Date.now() - days * 86400000) } };
  const cutoff = new Date();
  if (!Number.isNaN(months) && months > 0) { cutoff.setMonth(cutoff.getMonth() - months); return { createdAt: { $gte: cutoff } }; }
  if (!Number.isNaN(years) && years > 0) { cutoff.setFullYear(cutoff.getFullYear() - years); return { createdAt: { $gte: cutoff } }; }
  return null;
}

function searchFilter(search) {
  if (!search) return null;
  const rx = { $regex: escapeRegex(search), $options: 'i' };
  return {
    $or: ['event', 'action.description', 'action.reason', 'action.denialReason', 'actor.name', 'actor.email',
      'target.name', 'target.identifier', 'metadata.hospitalName', 'metadata.patientName'].map((field) => ({ [field]: rx })),
  };
}

// Logs where a patient or hospital is either the actor or the subject
async function listEntityLogs(req, res, label) {
  try {
    const AuditLog = (await import('../models/AuditLog.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: `Missing ${label} id` });

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
    const skip = (page - 1) * limit;
    const search = (req.query.search || '').toString().trim();

    const ids = [id];
    if (mongoose.isValidObjectId(id)) ids.push(new mongoose.Types.ObjectId(id));
    const base = [{ $or: [{ 'actor.id': { $in: ids } }, { 'target.id': { $in: ids } }] }];
    const period = periodFilter(req.query);
    if (period) base.push(period);
    const text = searchFilter(search);
    if (text) base.push(text);

    const filters = [...base];
    if (req.query.event) filters.push({ event: req.query.event });
    // events=A,B,C filters by a group of event types (the timeline's tabs)
    const eventGroup = String(req.query.events || '').split(',').map(e => e.trim()).filter(Boolean);
    if (eventGroup.length) filters.push({ event: { $in: eventGroup } });

    const finalQuery = { $and: filters };
    const [total, logs, byEvent, warnings] = await Promise.all([
      AuditLog.countDocuments(finalQuery),
      AuditLog.find(finalQuery).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      // Summary covers the whole period/search, regardless of the selected tab or page
      page === 1 ? AuditLog.aggregate([{ $match: { $and: base } }, { $group: { _id: '$event', count: { $sum: 1 } } }]) : null,
      page === 1 ? AuditLog.countDocuments({ $and: [...base, { $or: [{ severity: { $in: ['WARNING', 'CRITICAL'] } }, { 'action.outcome': 'FAILURE' }] }] }) : null,
    ]);

    let summary;
    if (byEvent) {
      summary = { total: 0, access: 0, consent: 0, records: 0, auth: 0, warnings };
      for (const row of byEvent) {
        summary.total += row.count;
        for (const [group, events] of Object.entries(EVENT_GROUPS)) {
          if (events.includes(row._id)) summary[group] += row.count;
        }
      }
    }

    return res.json({
      ok: true,
      logs,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(`fetch ${label} audit logs error:`, err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}

// Get audit logs for a patient
router.get('/patient/:id', (req, res) => listEntityLogs(req, res, 'patient'));

// Get audit logs for a hospital
router.get('/hospital/:id', (req, res) => listEntityLogs(req, res, 'hospital'));

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
