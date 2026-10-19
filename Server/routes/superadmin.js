import express from 'express';
import { buildRecordEmbeddingPayload, generateEmbedding } from '../utils/embedding.js';
import { answerAdminQuestion } from '../utils/goluBrain.js';
import { listProviders } from '../utils/aiClient.js';
import { listNotifications, countUnread, markRead, markAllRead } from '../utils/notificationFeed.js';

// Treat user search text literally inside Mongo regex queries
const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const router = express.Router();

async function requireAdmin(adminId) {
  if (!adminId) return null;
  const Superadmin = (await import('../models/Superadmin.js')).default;
  return Superadmin.findById(adminId).lean();
}

function trimTitle(message) {
  const text = String(message || '').trim();
  if (!text) return 'Health Intelligence Chat';
  return text.length > 64 ? `${text.slice(0, 64)}...` : text;
}

function isGreeting(text) {
  const normalized = String(text || '').trim().toLowerCase();
  const greetingSet = new Set(['hi', 'hello', 'hey', 'hii', 'hiii', 'yo', 'good morning', 'good afternoon', 'good evening']);
  if (greetingSet.has(normalized)) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length > 3) return false;
  return greetingSet.has(words.join(' '));
}

// Admin dashboard statistics (must come before /:id route)
router.get('/dashboard/stats', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const Patient = (await import('../models/Patient.js')).default;

    const totalHospitals = await Hospital.countDocuments({});
    const activeHospitals = await Hospital.countDocuments({ active: true });
    const activePatients = await Patient.countDocuments({});

    // Recent hospital registrations (last 10)
    const recentHospitals = await Hospital.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('_id name city state createdAt active')
      .lean();

    return res.json({
      ok: true,
      stats: {
        totalHospitals,
        activeHospitals,
        activePatients,
        recentHospitals,
      },
    });
  } catch (err) {
    console.error('dashboard stats error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// ==================== SUPERADMIN HEALTH INTELLIGENCE CHAT ====================

// List recent chat sessions
router.get('/chat/sessions', async (req, res) => {
  try {
    const adminId = String(req.query.adminId || '').trim();
    const admin = await requireAdmin(adminId);
    if (!admin) return res.status(403).json({ error: 'Superadmin not found' });

    const SuperadminChatSession = (await import('../models/SuperadminChatSession.js')).default;
    const sessions = await SuperadminChatSession.find({ adminId })
      .sort({ updatedAt: -1 })
      .limit(30)
      .select('_id title updatedAt createdAt')
      .lean();

    return res.json({ ok: true, sessions });
  } catch (err) {
    console.error('list chat sessions error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Fetch a specific chat session
router.get('/chat/sessions/:sessionId', async (req, res) => {
  try {
    const adminId = String(req.query.adminId || '').trim();
    const admin = await requireAdmin(adminId);
    if (!admin) return res.status(403).json({ error: 'Superadmin not found' });

    const SuperadminChatSession = (await import('../models/SuperadminChatSession.js')).default;
    const session = await SuperadminChatSession.findOne({ _id: req.params.sessionId, adminId }).lean();
    if (!session) return res.status(404).json({ error: 'Chat session not found' });

    return res.json({ ok: true, session });
  } catch (err) {
    console.error('fetch chat session error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Delete a chat session
router.delete('/chat/sessions/:sessionId', async (req, res) => {
  try {
    const adminId = String(req.query.adminId || '').trim();
    const admin = await requireAdmin(adminId);
    if (!admin) return res.status(403).json({ error: 'Superadmin not found' });

    const SuperadminChatSession = (await import('../models/SuperadminChatSession.js')).default;
    const deleted = await SuperadminChatSession.findOneAndDelete({ _id: req.params.sessionId, adminId }).lean();
    if (!deleted) return res.status(404).json({ error: 'Chat session not found' });

    return res.json({ ok: true });
  } catch (err) {
    console.error('delete chat session error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Chat endpoint: plan read-only queries from the question + conversation, answer with evidence
router.post('/chat', async (req, res) => {
  try {
    const { adminId, message, sessionId, prefer } = req.body || {};
    const preference = prefer?.provider ? { provider: String(prefer.provider), model: prefer.model ? String(prefer.model) : undefined } : null;
    if (!adminId || !message) return res.status(400).json({ error: 'adminId and message are required' });

    const admin = await requireAdmin(adminId);
    if (!admin) return res.status(403).json({ error: 'Superadmin not found' });

    const SuperadminChatSession = (await import('../models/SuperadminChatSession.js')).default;
    const question = String(message).trim().slice(0, 4000);

    let session = sessionId ? await SuperadminChatSession.findOne({ _id: sessionId, adminId }) : null;
    // The model is chosen when a chat starts and cannot change afterwards
    const chatPreference = session ? (session.preference || null) : preference;
    const history = session ? session.messages.map(m => ({ role: m.role, content: m.content, sources: m.sources })) : [];

    let answer;
    let sources = [];
    let model;
    if (isGreeting(question) && history.length === 0) {
      answer = 'Hi! I am Golu. Ask me anything about patients, hospitals, records, consents or trends on G1Card.';
    } else {
      ({ answer, sources, model } = await answerAdminQuestion({ question, history, prefer: chatPreference }));
    }

    if (!session) {
      session = await SuperadminChatSession.create({ adminId, title: trimTitle(question), messages: [], preference: chatPreference });
    }
    session.messages.push({ role: 'user', content: question });
    session.messages.push({ role: 'assistant', content: answer, sources, model });
    await session.save();

    const keepIds = await SuperadminChatSession.find({ adminId })
      .sort({ updatedAt: -1 })
      .limit(30)
      .distinct('_id');
    await SuperadminChatSession.deleteMany({ adminId, _id: { $nin: keepIds } });

    return res.json({ ok: true, sessionId: session._id, answer, messages: session.messages, sources, model, preference: session.preference || null });
  } catch (err) {
    console.error('superadmin chat error:', err);
    const message = err?.message || String(err);
    if (message.includes('MISTRAL_API_KEY_ADMIN')) {
      return res.status(503).json({ error: 'Admin AI is not configured on server yet' });
    }
    return res.status(500).json({ error: message });
  }
});

const INDEX_STATE_KEY = 'golu.recordIndex';
let reindexInFlight = null;

async function getIndexState() {
  const SystemState = (await import('../models/SystemState.js')).default;
  const Record = (await import('../models/Record.js')).default;
  const RecordEmbedding = (await import('../models/RecordEmbedding.js')).default;
  const [state, totalRecords, indexedRecords] = await Promise.all([
    SystemState.findOne({ key: INDEX_STATE_KEY }).lean(),
    Record.countDocuments({}),
    RecordEmbedding.countDocuments({}),
  ]);
  return {
    lastIndexedAt: state?.value?.lastIndexedAt || null,
    lastRun: state?.value?.lastRun || null,
    totalRecords,
    indexedRecords,
    running: Boolean(reindexInFlight),
  };
}

// Index records for Golu's semantic search. Incremental by default: only records that changed since
// the last run or that have no embedding yet. `full: true` re-embeds everything (capped by limit).
async function runReindex({ full = false, limit = 500 } = {}) {
  const SystemState = (await import('../models/SystemState.js')).default;
  const Record = (await import('../models/Record.js')).default;
  const RecordEmbedding = (await import('../models/RecordEmbedding.js')).default;
  await import('../models/Patient.js');
  await import('../models/FormTemplate.js');

  const startedAt = new Date();
  const state = await SystemState.findOne({ key: INDEX_STATE_KEY }).lean();
  const since = state?.value?.lastIndexedAt ? new Date(state.value.lastIndexedAt) : null;

  let filter = {};
  if (!full) {
    const indexedIds = await RecordEmbedding.distinct('recordId');
    filter = { $or: [{ _id: { $nin: indexedIds } }, ...(since ? [{ updatedAt: { $gt: since } }] : [])] };
  }

  const records = await Record.find(filter)
    .sort({ updatedAt: -1 })
    .limit(Math.min(parseInt(limit, 10) || 500, 2000))
    .populate('patient')
    .populate('hospital', 'name')
    .populate('form', 'name')
    .lean();

  let indexed = 0;
  let skipped = 0;
  for (const record of records) {
    const patient = record.patient;
    const hospital = record.hospital;
    if (!patient || !hospital) {
      skipped++;
      continue;
    }
    const formName = record.form?.name || 'Medical Record';
    const payload = buildRecordEmbeddingPayload({ patient, record, formName, hospitalName: hospital.name });
    const embedding = await generateEmbedding(payload.text);
    await RecordEmbedding.updateOne(
      { recordId: record._id },
      {
        $set: {
          recordId: record._id,
          patientId: patient._id,
          hospitalId: hospital._id,
          hospitalName: hospital.name,
          formName,
          admissionDate: payload.admissionDate,
          patientName: payload.patientName,
          patientEmail: payload.patientEmail,
          patientAge: payload.patientAge,
          patientGender: payload.patientGender,
          patientConditions: payload.patientConditions,
          patientMedications: payload.patientMedications,
          notes: payload.notes,
          text: payload.text,
          embedding,
        },
      },
      { upsert: true }
    );
    indexed++;
  }

  const lastRun = { mode: full ? 'full' : 'incremental', indexed, skipped, checked: records.length, durationMs: Date.now() - startedAt.getTime() };
  await SystemState.updateOne(
    { key: INDEX_STATE_KEY },
    { $set: { value: { lastIndexedAt: startedAt.toISOString(), lastRun } } },
    { upsert: true }
  );
  return lastRun;
}

// Index status (for the "last indexed" timer)
router.get('/chat/index-status', async (req, res) => {
  try {
    const admin = await requireAdmin(String(req.query.adminId || '').trim());
    if (!admin) return res.status(403).json({ error: 'Superadmin not found' });
    return res.json({ ok: true, ...(await getIndexState()) });
  } catch (err) {
    console.error('index status error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Reindex records (incremental unless full=true). Concurrent requests share one run.
router.post('/chat/reindex', async (req, res) => {
  try {
    const { adminId, limit = 500, full = false } = req.body || {};
    if (!adminId) return res.status(400).json({ error: 'adminId is required' });

    const admin = await requireAdmin(adminId);
    if (!admin) return res.status(403).json({ error: 'Superadmin not found' });

    if (!reindexInFlight) {
      reindexInFlight = runReindex({ full: Boolean(full), limit }).finally(() => { reindexInFlight = null; });
    }
    const run = await reindexInFlight;
    return res.json({ ok: true, ...run, ...(await getIndexState()) });
  } catch (err) {
    console.error('reindex embeddings error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// AI providers/models available to Golu, with live status (probe=1 pings each provider)
router.get('/chat/models', async (req, res) => {
  try {
    const admin = await requireAdmin(String(req.query.adminId || '').trim());
    if (!admin) return res.status(403).json({ error: 'Superadmin not found' });
    const providers = await listProviders({ role: 'admin', probe: req.query.probe === '1' });
    return res.json({ ok: true, providers, checkedAt: new Date().toISOString() });
  } catch (err) {
    console.error('list ai models error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});


// ==================== END SUPERADMIN HEALTH INTELLIGENCE CHAT ====================

// List pending hospital registration requests (for approval)
router.get('/hospitals/pending', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const { search = '', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { status: 'pending' };
    if (search) {
      filter.$or = [
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { contactEmail: { $regex: escapeRegex(search), $options: 'i' } },
        { city: { $regex: escapeRegex(search), $options: 'i' } },
        { state: { $regex: escapeRegex(search), $options: 'i' } },
        { regNumber: { $regex: escapeRegex(search), $options: 'i' } },
      ];
    }

    const total = await Hospital.countDocuments(filter);
    const hospitals = await Hospital.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-password -salt')
      .lean();

    return res.json({ ok: true, hospitals, pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) {
    console.error('list pending hospitals error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Approve a pending hospital
router.patch('/hospitals/:id/approve', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const { sendHospitalLifecycleEmail } = await import('../utils/emailService.js');
    const id = req.params.id;
    const { verificationChecklist = {} } = req.body || {};

    const requiredChecklist = [
      'regNumberVerified',
      'licenseVerified',
      'contactVerified',
      'adminVerified',
      'documentsVerified',
    ];

    const missingChecks = requiredChecklist.filter((key) => verificationChecklist[key] !== true);
    if (missingChecks.length > 0) {
      return res.status(400).json({ error: 'Document verification checklist must be completed before approval.' });
    }

    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    hospital.status = 'approved';
    hospital.active = true;
    await hospital.save();

    await sendHospitalLifecycleEmail({
      to: hospital.contactEmail || hospital.username,
      hospitalName: hospital.name,
      status: 'approved',
    });

    const safe = hospital.toObject();
    if (safe.password) delete safe.password;
    if (safe.salt) delete safe.salt;
    return res.json({ ok: true, hospital: safe });
  } catch (err) {
    console.error('approve hospital error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Reject a pending hospital (mark rejected or optionally delete)
router.patch('/hospitals/:id/reject', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const { sendHospitalLifecycleEmail } = await import('../utils/emailService.js');
    const id = req.params.id;
    const { reason } = req.body || {};
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    hospital.status = 'rejected';
    hospital.active = false;
    // store optional rejection reason in a field (if exists) or audit logs
    hospital.rejectionReason = reason || '';
    await hospital.save();

    await sendHospitalLifecycleEmail({
      to: hospital.contactEmail || hospital.username,
      hospitalName: hospital.name,
      status: 'rejected',
      reason,
    });

    const safe = hospital.toObject();
    if (safe.password) delete safe.password;
    if (safe.salt) delete safe.salt;
    return res.json({ ok: true, hospital: safe });
  } catch (err) {
    console.error('reject hospital error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// List all patients with search and pagination (must come before /:id route)
router.get('/patients', async (req, res) => {
  try {
    const Patient = (await import('../models/Patient.js')).default;
    const Hospital = (await import('../models/Hospital.js')).default;
    const { search = '', page = 1, limit = 10, status = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (status === 'suspended') filter.suspended = true;
    if (status === 'active') filter.suspended = { $ne: true };
    if (search) {
      filter.$or = [
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { email: { $regex: escapeRegex(search), $options: 'i' } },
        { phone: { $regex: escapeRegex(search), $options: 'i' } },
        { patientId: { $regex: escapeRegex(search), $options: 'i' } },
      ];
    }

    const total = await Patient.countDocuments(filter);
    const patients = await Patient.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-password -salt')
      .lean();

    // Populate hospital names and normalize patient data
    const patientsWithHospital = await Promise.all(
      patients.map(async (patient) => {
        let hospitalName = 'N/A';
        if (patient.hospital) {
          const hospital = await Hospital.findById(patient.hospital).select('name').lean();
          hospitalName = hospital?.name || 'N/A';
        } else if (patient.hospitals && patient.hospitals.length > 0) {
          // Check hospitals array if legacy hospital field is empty
          const hospital = await Hospital.findById(patient.hospitals[0]).select('name').lean();
          hospitalName = hospital?.name || 'N/A';
        }

        // Normalize name field - combine firstName + lastName if name is missing
        let displayName = patient.name;
        if (!displayName && (patient.firstName || patient.lastName)) {
          displayName = [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim() || 'N/A';
        }
        if (!displayName) displayName = 'N/A';

        // Use patientId if available, otherwise use _id for consistency with hospital dashboard
        const patientId = patient.patientId || patient._id.toString();

        return {
          ...patient,
          patientId,
          name: displayName,
          hospitalName,
        };
      })
    );

    return res.json({
      ok: true,
      patients: patientsWithHospital,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('list patients error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Suspend or reactivate a patient account
router.post('/patients/:patientId/suspension', async (req, res) => {
  try {
    const { adminId, suspended, reason = '' } = req.body || {};
    const admin = await requireAdmin(String(adminId || '').trim());
    if (!admin) return res.status(403).json({ error: 'Superadmin not found' });

    const Patient = (await import('../models/Patient.js')).default;
    const patient = await Patient.findById(req.params.patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const suspend = Boolean(suspended);
    patient.suspended = suspend;
    patient.suspendedAt = suspend ? new Date() : undefined;
    patient.suspendedReason = suspend ? String(reason).slice(0, 500) : '';
    patient.suspendedBy = suspend ? admin._id : undefined;
    await patient.save();

    // Let the patient know in-app (they'll see it if reactivated, and it records the action)
    try {
      const Notification = (await import('../models/Notification.js')).default;
      await Notification.create({
        type: 'GENERAL',
        recipient: patient._id,
        recipientModel: 'Patient',
        sender: admin._id,
        senderModel: 'Superadmin',
        title: suspend ? 'Your account was suspended' : 'Your account was reactivated',
        message: suspend
          ? `A G1Card administrator suspended your account${reason ? `: ${String(reason).slice(0, 200)}` : '.'}`
          : 'A G1Card administrator reactivated your account. You can use G1Card again.',
      });
    } catch (notifyErr) {
      console.warn('suspension notification failed:', notifyErr?.message || notifyErr);
    }

    return res.json({
      ok: true,
      patient: { _id: patient._id, suspended: patient.suspended, suspendedAt: patient.suspendedAt || null, suspendedReason: patient.suspendedReason || '' },
    });
  } catch (err) {
    console.error('patient suspension error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// List all hospitals with search and pagination (must come before /:id route)
router.get('/hospitals', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const { search = '', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: escapeRegex(search), $options: 'i' } },
        { city: { $regex: escapeRegex(search), $options: 'i' } },
        { state: { $regex: escapeRegex(search), $options: 'i' } },
        { contactEmail: { $regex: escapeRegex(search), $options: 'i' } },
      ];
    }

    const total = await Hospital.countDocuments(filter);
    const hospitals = await Hospital.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-password -salt')
      .lean();

    return res.json({
      ok: true,
      hospitals,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('list hospitals error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get single hospital by ID
router.get('/hospitals/:id', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const Staff = (await import('../models/Staff.js')).default;
    const Record = (await import('../models/Record.js')).default;

    const hospital = await Hospital.findById(req.params.id).select('-password -salt').lean();
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

    // Count patients, staff, and records for this hospital
    const [patientCount, staffCount, recordsCount] = await Promise.all([
      Patient.countDocuments({ hospital: req.params.id }),
      Staff.countDocuments({ hospital: req.params.id }),
      Record.countDocuments({ hospital: req.params.id }),
    ]);

    return res.json({ 
      ok: true, 
      hospital: { 
        ...hospital, 
        patientCount,
        staffCount,
        recordsCount,
      } 
    });
  } catch (err) {
    console.error('get hospital error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Update hospital (including active status)
router.patch('/hospitals/:id', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const allowedFields = ['name', 'regNumber', 'address', 'city', 'state', 'pin', 'license', 'contactEmail', 'phone', 'website', 'adminName', 'adminEmail', 'adminPhone', 'designation', 'active'];
    const updates = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const hospital = await Hospital.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-password -salt');
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

    return res.json({ ok: true, hospital });
  } catch (err) {
    console.error('update hospital error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Delete hospital
router.delete('/hospitals/:id', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const hospital = await Hospital.findByIdAndDelete(req.params.id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

    return res.json({ ok: true, message: 'Hospital deleted successfully' });
  } catch (err) {
    console.error('delete hospital error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// ==================== HOSPITAL UPDATE REQUEST MANAGEMENT ====================

// Get all hospital update requests (with filters)
router.get('/update-requests', async (req, res) => {
  try {
    const HospitalUpdateRequest = (await import('../models/HospitalUpdateRequest.js')).default;
    const Hospital = (await import('../models/Hospital.js')).default;
    const Superadmin = (await import('../models/Superadmin.js')).default;
    
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const filter = {};
    if (status && status !== 'ALL') {
      filter.status = status;
    }
    
    const [requests, total] = await Promise.all([
      HospitalUpdateRequest.find(filter)
        .populate('hospital', 'name contactEmail city state')
        .populate('reviewedBy', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      HospitalUpdateRequest.countDocuments(filter)
    ]);
    
    return res.json({
      ok: true,
      requests,
      pagination: {
        total,
        pages: Math.ceil(total / parseInt(limit)),
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (err) {
    console.error('fetch update requests error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get a specific update request with full details
router.get('/update-requests/:requestId', async (req, res) => {
  try {
    const HospitalUpdateRequest = (await import('../models/HospitalUpdateRequest.js')).default;
    const Hospital = (await import('../models/Hospital.js')).default;
    const Superadmin = (await import('../models/Superadmin.js')).default;
    
    const { requestId } = req.params;
    
    const request = await HospitalUpdateRequest.findById(requestId)
      .populate('hospital', 'name contactEmail phone city state regNumber license')
      .populate('reviewedBy', 'username email')
      .lean();
    
    if (!request) {
      return res.status(404).json({ error: 'Update request not found' });
    }
    
    return res.json({ ok: true, request });
  } catch (err) {
    console.error('fetch update request details error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Approve hospital update request
router.patch('/update-requests/:requestId/approve', async (req, res) => {
  try {
    const HospitalUpdateRequest = (await import('../models/HospitalUpdateRequest.js')).default;
    const Hospital = (await import('../models/Hospital.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const { sendEventToUser } = await import('./sse.js');
    
    const { requestId } = req.params;
    const { adminId, remarks } = req.body;
    
    if (!adminId) {
      return res.status(400).json({ error: 'Admin ID is required' });
    }
    
    const updateRequest = await HospitalUpdateRequest.findById(requestId);
    if (!updateRequest) {
      return res.status(404).json({ error: 'Update request not found' });
    }
    
    if (updateRequest.status === 'APPROVED') {
      return res.status(400).json({ error: 'Request already approved' });
    }
    
    // Apply the changes to the hospital record
    const hospital = await Hospital.findByIdAndUpdate(
      updateRequest.hospital,
      { $set: updateRequest.requestedChanges },
      { new: true }
    ).lean();
    
    // Update request status
    updateRequest.status = 'APPROVED';
    updateRequest.reviewedBy = adminId;
    updateRequest.reviewedAt = new Date();
    if (remarks) {
      updateRequest.adminRemarks = remarks;
      updateRequest.conversation.push({
        sender: 'ADMIN',
        message: remarks,
        timestamp: new Date()
      });
    }
    await updateRequest.save();
    
    // Notify hospital
    const notification = await Notification.create({
      type: 'UPDATE_REQUEST_APPROVED',
      recipient: updateRequest.hospital,
      recipientModel: 'Hospital',
      sender: adminId,
      senderModel: 'Superadmin',
      title: 'Information Update Approved',
      message: 'Your hospital information update request has been approved and applied.',
      metadata: {
        updateRequestId: updateRequest._id,
        approvedFields: Object.keys(updateRequest.requestedChanges)
      }
    });
    
    sendEventToUser('Hospital', updateRequest.hospital.toString(), {
      type: 'UPDATE_REQUEST_APPROVED',
      title: 'Update Approved',
      message: 'Your information update has been approved!',
      timestamp: new Date().toISOString(),
      updateRequestId: updateRequest._id.toString(),
      notificationId: notification._id.toString()
    });
    
    return res.json({ ok: true, updateRequest, hospital });
  } catch (err) {
    console.error('approve update request error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Reject hospital update request
router.patch('/update-requests/:requestId/reject', async (req, res) => {
  try {
    const HospitalUpdateRequest = (await import('../models/HospitalUpdateRequest.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const { sendEventToUser } = await import('./sse.js');
    
    const { requestId } = req.params;
    const { adminId, reason } = req.body;
    
    if (!adminId || !reason) {
      return res.status(400).json({ error: 'Admin ID and reason are required' });
    }
    
    const updateRequest = await HospitalUpdateRequest.findById(requestId);
    if (!updateRequest) {
      return res.status(404).json({ error: 'Update request not found' });
    }
    
    updateRequest.status = 'REJECTED';
    updateRequest.reviewedBy = adminId;
    updateRequest.reviewedAt = new Date();
    updateRequest.adminRemarks = reason;
    updateRequest.conversation.push({
      sender: 'ADMIN',
      message: reason,
      timestamp: new Date()
    });
    await updateRequest.save();
    
    // Notify hospital
    const notification = await Notification.create({
      type: 'UPDATE_REQUEST_REJECTED',
      recipient: updateRequest.hospital,
      recipientModel: 'Hospital',
      sender: adminId,
      senderModel: 'Superadmin',
      title: 'Information Update Rejected',
      message: `Your hospital information update request has been rejected. Reason: ${reason}`,
      metadata: {
        updateRequestId: updateRequest._id,
        rejectionReason: reason
      }
    });
    
    sendEventToUser('Hospital', updateRequest.hospital.toString(), {
      type: 'UPDATE_REQUEST_REJECTED',
      title: 'Update Rejected',
      message: 'Your information update was rejected.',
      timestamp: new Date().toISOString(),
      updateRequestId: updateRequest._id.toString(),
      notificationId: notification._id.toString()
    });
    
    return res.json({ ok: true, updateRequest });
  } catch (err) {
    console.error('reject update request error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Request changes on hospital update request
router.patch('/update-requests/:requestId/request-changes', async (req, res) => {
  try {
    const HospitalUpdateRequest = (await import('../models/HospitalUpdateRequest.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const { sendEventToUser } = await import('./sse.js');
    
    const { requestId } = req.params;
    const { adminId, message } = req.body;
    
    if (!adminId || !message) {
      return res.status(400).json({ error: 'Admin ID and message are required' });
    }
    
    const updateRequest = await HospitalUpdateRequest.findById(requestId);
    if (!updateRequest) {
      return res.status(404).json({ error: 'Update request not found' });
    }
    
    updateRequest.status = 'CHANGES_REQUESTED';
    updateRequest.reviewedBy = adminId;
    updateRequest.adminRemarks = message;
    updateRequest.conversation.push({
      sender: 'ADMIN',
      message,
      timestamp: new Date()
    });
    await updateRequest.save();
    
    // Notify hospital
    const notification = await Notification.create({
      type: 'UPDATE_REQUEST_CHANGES_REQUESTED',
      recipient: updateRequest.hospital,
      recipientModel: 'Hospital',
      sender: adminId,
      senderModel: 'Superadmin',
      title: 'Changes Requested on Update',
      message: `Admin has requested changes to your information update request: ${message}`,
      metadata: {
        updateRequestId: updateRequest._id,
        adminMessage: message
      }
    });
    
    sendEventToUser('Hospital', updateRequest.hospital.toString(), {
      type: 'UPDATE_REQUEST_CHANGES_REQUESTED',
      title: 'Changes Requested',
      message: 'Admin requested changes to your update.',
      timestamp: new Date().toISOString(),
      updateRequestId: updateRequest._id.toString(),
      notificationId: notification._id.toString()
    });
    
    return res.json({ ok: true, updateRequest });
  } catch (err) {
    console.error('request changes error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Add a message to update request (admin side)
router.post('/update-requests/:requestId/message', async (req, res) => {
  try {
    const HospitalUpdateRequest = (await import('../models/HospitalUpdateRequest.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const { sendEventToUser } = await import('./sse.js');
    
    const { requestId } = req.params;
    const { adminId, message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const updateRequest = await HospitalUpdateRequest.findById(requestId);
    if (!updateRequest) {
      return res.status(404).json({ error: 'Update request not found' });
    }
    
    updateRequest.conversation.push({
      sender: 'ADMIN',
      message,
      timestamp: new Date()
    });
    await updateRequest.save();
    
    // Notify hospital
    const notification = await Notification.create({
      type: 'UPDATE_REQUEST_MESSAGE',
      recipient: updateRequest.hospital,
      recipientModel: 'Hospital',
      sender: adminId,
      senderModel: 'Superadmin',
      title: 'New Message on Update Request',
      message: `Admin sent a message: ${message.substring(0, 100)}...`,
      metadata: {
        updateRequestId: updateRequest._id
      }
    });
    
    sendEventToUser('Hospital', updateRequest.hospital.toString(), {
      type: 'UPDATE_REQUEST_MESSAGE',
      title: 'New Message',
      message: 'Admin sent a message on your update request.',
      timestamp: new Date().toISOString(),
      updateRequestId: updateRequest._id.toString(),
      notificationId: notification._id.toString()
    });
    
    return res.json({ ok: true, updateRequest });
  } catch (err) {
    console.error('add admin message error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// ==================== END UPDATE REQUEST MANAGEMENT ====================

// List patient deletion requests for admin review
router.get('/deletion-requests', async (req, res) => {
  try {
    const DeletionRequest = (await import('../models/DeletionRequest.js')).default;
    const status = String(req.query.status || '').trim().toUpperCase();
    const requestType = String(req.query.requestType || '').trim().toUpperCase();
    const search = String(req.query.search || '').trim().toLowerCase();
    const query = {};
    if (status) query.status = status;
    if (requestType) query.requestType = requestType;

    const requests = await DeletionRequest.find(query)
      .populate('patient', 'firstName lastName name email username patientId')
      .sort({ createdAt: -1 })
      .lean();

    const filtered = search
      ? requests.filter((r) => {
        const patientName = `${r?.patient?.firstName || ''} ${r?.patient?.lastName || ''}`.trim() || r?.patient?.name || '';
        const patientEmail = (r?.patient?.email || r?.patient?.username || '').toLowerCase();
        return patientName.toLowerCase().includes(search) || patientEmail.includes(search);
      })
      : requests;

    const normalizedRequests = filtered.map((r) => ({
      ...r,
      reviewNotes: r.reviewNotes || r.adminRemarks || '',
    }));

    return res.json({ ok: true, requests: normalizedRequests });
  } catch (err) {
    console.error('list deletion requests error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Review patient deletion request (approve/reject)
router.patch('/deletion-requests/:requestId/review', async (req, res) => {
  try {
    const DeletionRequest = (await import('../models/DeletionRequest.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const Record = (await import('../models/Record.js')).default;
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const EmailOtp = (await import('../models/EmailOtp.js')).default;
    const { sendEventToUser } = await import('./sse.js');
    const { sendDeletionReviewEmailToPatient } = await import('../utils/emailService.js');

    const { requestId } = req.params;
    const { adminId, decision, reviewNotes } = req.body || {};

    const normalizedDecision = String(decision || '').toUpperCase();
    if (!['APPROVED', 'REJECTED'].includes(normalizedDecision)) {
      return res.status(400).json({ error: 'decision must be APPROVED or REJECTED' });
    }

    const request = await DeletionRequest.findById(requestId).populate('patient');
    if (!request) return res.status(404).json({ error: 'Deletion request not found' });
    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending requests can be reviewed' });
    }

    request.status = normalizedDecision;
    request.reviewedBy = adminId || null;
    request.reviewNotes = String(reviewNotes || '').trim();
    request.reviewedAt = new Date();
    await request.save();

    const patientId = request.patient?._id?.toString();
    const patientObjectId = request.patient?._id;
    const patientEmail = String(request.patient?.email || request.patient?.username || '').trim().toLowerCase();
    const patientUsername = String(request.patient?.username || '').trim().toLowerCase();
    const emailCandidates = [patientEmail, patientUsername].filter(Boolean);

    // Apply operational effect for approved deletion requests
    if (normalizedDecision === 'APPROVED' && patientObjectId) {
      const cleanupTasks = [
        Record.deleteMany({ patient: patientObjectId }),
        HospitalAccess.deleteMany({ patient: patientObjectId }),
        Notification.deleteMany({
          $or: [
            { recipient: patientObjectId, recipientModel: 'Patient' },
            { sender: patientObjectId, senderModel: 'Patient' },
          ],
        }),
      ];

      if (emailCandidates.length) {
        cleanupTasks.push(EmailOtp.deleteMany({ email: { $in: emailCandidates } }));
      }

      if (request.requestType === 'DATA_DELETION') {
        await Promise.all(cleanupTasks);
      }

      if (request.requestType === 'ACCOUNT_DELETION') {
        await Promise.all(cleanupTasks);

        await DeletionRequest.updateMany(
          {
            patient: patientObjectId,
            status: 'PENDING',
            _id: { $ne: request._id },
          },
          {
            $set: {
              status: 'APPROVED',
              reviewedBy: adminId || null,
              reviewedAt: new Date(),
              reviewNotes: 'Auto-approved because account deletion was approved.',
            },
          }
        );

        await Patient.deleteOne({ _id: patientObjectId });
        await DeletionRequest.deleteMany({ patient: patientObjectId });
      }
    }

    if (patientId) {
      const patientName = `${request.patient?.firstName || ''} ${request.patient?.lastName || ''}`.trim() || request.patient?.name || 'Patient';
      const title = normalizedDecision === 'APPROVED' ? 'Deletion Request Approved' : 'Deletion Request Rejected';
      const message = normalizedDecision === 'APPROVED'
        ? 'Your deletion request has been approved by the admin team.'
        : `Your deletion request was rejected.${request.reviewNotes ? ` Reason: ${request.reviewNotes}` : ''}`;

      const shouldCreateInAppNotification = !(normalizedDecision === 'APPROVED' && request.requestType === 'ACCOUNT_DELETION');

      if (shouldCreateInAppNotification) {
        const notification = await Notification.create({
          type: 'GENERAL',
          recipient: request.patient._id,
          recipientModel: 'Patient',
          sender: adminId || null,
          senderModel: 'Superadmin',
          title,
          message,
          metadata: {
            source: 'PATIENT_DELETION_REQUEST_REVIEW',
            requestId: request._id,
            requestType: request.requestType,
            status: normalizedDecision,
            reviewNotes: request.reviewNotes || '',
          },
        });

        sendEventToUser('Patient', patientId, {
          type: 'PATIENT_DELETION_REQUEST_REVIEW',
          title,
          message,
          timestamp: new Date().toISOString(),
          notificationId: notification._id.toString(),
          requestId: request._id.toString(),
        });
      }

      if (patientEmail) {
        await sendDeletionReviewEmailToPatient({
          to: patientEmail,
          patientName,
          requestType: request.requestType,
          decision: normalizedDecision,
          reviewNotes: request.reviewNotes || '',
        });
      }
    }

    return res.json({ ok: true, request });
  } catch (err) {
    console.error('review deletion request error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Fetch superadmin by id (safe view) - MUST be last to not conflict with other routes
// Platform configuration as it really is right now (read-only; no secrets)
router.get('/system', async (req, res) => {
  try {
    const mongoose = (await import('mongoose')).default;
    const { describeEmailSetup } = await import('../utils/emailService.js');
    const providers = await listProviders({ role: 'admin' }).catch(() => []);
    return res.json({
      ok: true,
      system: {
        environment: process.env.VERCEL ? 'Vercel' : (process.env.NODE_ENV || 'development'),
        appUrl: process.env.APP_BASE_URL || 'https://g1card.vercel.app',
        database: { connected: mongoose.connection.readyState === 1, name: mongoose.connection.name || '' },
        email: describeEmailSetup(),
        googleSignIn: { configured: Boolean(process.env.GOOGLE_CLIENT_ID) },
        ai: {
          routing: (process.env.AI_ROUTING || 'priority').toLowerCase(),
          providers: providers.map(p => ({ name: p.label || p.provider, configured: Boolean(p.configured), models: (p.models || []).length })),
        },
        // These match the signup/password OTP code in routes.js and the patient settings flow
        otp: { length: 6, validityMinutes: 10, resendCooldownSeconds: 60 },
        uptimeSeconds: Math.round(process.uptime()),
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || String(err) });
  }
});

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

// Admin inbox: deletion requests, hospital update requests and other platform notices
router.get('/admins/:id/notifications/count', (req, res) => countUnread(req, res, 'Superadmin'));
router.get('/admins/:id/notifications', (req, res) => listNotifications(req, res, 'Superadmin'));
router.patch('/admins/:id/notifications/read-all', (req, res) => markAllRead(req, res, 'Superadmin'));
router.patch('/admins/:id/notifications/:notificationId/read', (req, res) => markRead(req, res, 'Superadmin'));

export default router;
