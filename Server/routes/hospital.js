import express from 'express';
import { logAccessRequestCreation, logRecordCreation, logPHIAccess } from '../utils/auditLogger.js';
import { sendEventToUser } from './sse.js';
import { callModel } from '../utils/aiClient.js';
import { buildRecordEmbeddingPayload, generateEmbedding } from '../utils/embedding.js';
import { markAllRead } from '../utils/notificationFeed.js';

// Treat user search text literally inside Mongo regex queries
const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const router = express.Router();

function extractJsonBlock(text) {
  if (!text || typeof text !== 'string') return null;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return text.slice(first, last + 1);
  }
  return null;
}

const SUMMARY_SECTIONS = ['criticalAlerts', 'allergies', 'medications', 'ongoingTreatments', 'conditions', 'surgeries', 'keyFindings'];

// Turn the model's JSON into a summary where every point carries numbered citations.
// refs are validated against the source map, so a model can never cite a record that does not exist.
function buildCitedSummary(rawText, sourceMap) {
  let parsed = null;
  try {
    const jsonText = extractJsonBlock(rawText);
    parsed = jsonText ? JSON.parse(jsonText) : null;
  } catch {
    parsed = null;
  }

  const references = [];
  const numberFor = new Map();
  const cite = refs => [...new Set((Array.isArray(refs) ? refs : [refs]).map(r => String(r || '').trim().toUpperCase()))]
    .filter(ref => sourceMap.has(ref))
    .map(ref => {
      if (!numberFor.has(ref)) {
        numberFor.set(ref, references.length + 1);
        references.push({ n: references.length + 1, ref, ...sourceMap.get(ref) });
      }
      return numberFor.get(ref);
    });
  const item = value => {
    if (!value) return null;
    if (typeof value === 'string') return value.trim() ? { text: value.trim(), cites: [] } : null;
    const text = String(value.text || value.summary || value.item || '').trim();
    if (!text || /^not documented\.?$/i.test(text)) return null;
    return { text, cites: cite(value.refs || value.sources || []), ...(value.date ? { date: String(value.date) } : {}) };
  };
  const list = value => (Array.isArray(value) ? value.map(item).filter(Boolean) : []);

  if (!parsed) {
    // Model ignored the format: keep its text, uncited, so the doctor still gets something
    const lines = String(rawText || '').split('\n').map(l => l.replace(/^[-*\d.\s]+/, '').trim()).filter(Boolean);
    return {
      overview: { text: lines[0] || 'The AI response could not be structured. Review the records below.', cites: [] },
      sections: { keyFindings: lines.slice(1, 20).map(text => ({ text, cites: [] })) },
      timeline: [],
      references,
      structured: false,
    };
  }

  const sections = {};
  for (const key of SUMMARY_SECTIONS) {
    const items = list(parsed[key]);
    if (items.length) sections[key] = items;
  }
  const timeline = list(parsed.timeline).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return {
    overview: item(parsed.overview) || { text: 'Summary generated from the available records.', cites: [] },
    sections,
    timeline,
    references,
    structured: true,
  };
}

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
        .populate('patient', 'name firstName lastName email phone gender patientId suspended')
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
          suspended: Boolean(p.suspended),
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

// ==================== HOSPITAL UPDATE REQUEST WORKFLOW ====================

// Submit hospital information update request
router.post('/:id/update-request', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const HospitalUpdateRequest = (await import('../models/HospitalUpdateRequest.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const Superadmin = (await import('../models/Superadmin.js')).default;
    
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing hospital id' });
    
    const hospital = await Hospital.findById(id).lean();
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    
    // Check if there's already a pending request
    const existingPending = await HospitalUpdateRequest.findOne({ 
      hospital: id, 
      status: { $in: ['PENDING', 'CHANGES_REQUESTED'] } 
    });
    
    if (existingPending && existingPending.status === 'PENDING') {
      return res.status(400).json({ error: 'You already have a pending update request. Please wait for admin review.' });
    }
    
    const { changes, message } = req.body;
    if (!changes || Object.keys(changes).length === 0) {
      return res.status(400).json({ error: 'No changes provided' });
    }
    
    // Validate allowed fields
    const allowedFields = ['name', 'username', 'regNumber', 'license', 'address', 'city', 'state', 'pin', 
                          'contactEmail', 'phone', 'website', 'adminName', 'adminEmail', 
                          'adminPhone', 'designation'];
    
    const requestedChanges = {};
    const originalData = {};
    
    for (const field of Object.keys(changes)) {
      if (allowedFields.includes(field)) {
        requestedChanges[field] = changes[field];
        originalData[field] = hospital[field];
      }
    }
    
    if (Object.keys(requestedChanges).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    
    // If updating an existing CHANGES_REQUESTED request, update it
    let updateRequest;
    if (existingPending && existingPending.status === 'CHANGES_REQUESTED') {
      updateRequest = await HospitalUpdateRequest.findByIdAndUpdate(
        existingPending._id,
        {
          requestedChanges,
          originalData,
          status: 'PENDING',
          resubmittedAt: new Date(),
          $push: message ? {
            conversation: {
              sender: 'HOSPITAL',
              message: message || 'Updated information as requested',
              timestamp: new Date()
            }
          } : {}
        },
        { new: true }
      );
    } else {
      // Create new request
      updateRequest = await HospitalUpdateRequest.create({
        hospital: id,
        requestedChanges,
        originalData,
        status: 'PENDING',
        conversation: message ? [{
          sender: 'HOSPITAL',
          message,
          timestamp: new Date()
        }] : []
      });
    }
    
    // Notify all superadmins
    const superadmins = await Superadmin.find({}).lean();
    for (const admin of superadmins) {
      const notification = await Notification.create({
        type: 'HOSPITAL_UPDATE_REQUEST',
        recipient: admin._id,
        recipientModel: 'Superadmin',
        sender: id,
        senderModel: 'Hospital',
        title: 'Hospital Information Update Request',
        message: `${hospital.name} has submitted a request to update their information.`,
        metadata: {
          updateRequestId: updateRequest._id,
          hospitalId: id,
          hospitalName: hospital.name,
          fieldsToUpdate: Object.keys(requestedChanges)
        }
      });
      
      sendEventToUser('Superadmin', admin._id.toString(), {
        type: 'HOSPITAL_UPDATE_REQUEST',
        title: 'New Update Request',
        message: `${hospital.name} wants to update their information.`,
        timestamp: new Date().toISOString(),
        updateRequestId: updateRequest._id.toString(),
        notificationId: notification._id.toString()
      });
    }
    
    return res.json({ ok: true, updateRequest });
  } catch (err) {
    console.error('create update request error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get pending update request for hospital
router.get('/:id/update-request/pending', async (req, res) => {
  try {
    const HospitalUpdateRequest = (await import('../models/HospitalUpdateRequest.js')).default;
    
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing hospital id' });
    
    const updateRequest = await HospitalUpdateRequest.findOne({
      hospital: id,
      status: { $in: ['PENDING', 'CHANGES_REQUESTED'] }
    })
    .populate('reviewedBy', 'username email')
    .sort({ createdAt: -1 })
    .lean();
    
    return res.json({ ok: true, updateRequest });
  } catch (err) {
    console.error('fetch pending update request error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get all update requests for hospital (history)
router.get('/:id/update-requests', async (req, res) => {
  try {
    const HospitalUpdateRequest = (await import('../models/HospitalUpdateRequest.js')).default;
    
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing hospital id' });
    
    const requests = await HospitalUpdateRequest.find({ hospital: id })
      .populate('reviewedBy', 'username email')
      .sort({ createdAt: -1 })
      .lean();
    
    return res.json({ ok: true, requests });
  } catch (err) {
    console.error('fetch update requests error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Add a message to the update request conversation
router.post('/:id/update-request/:requestId/message', async (req, res) => {
  try {
    const HospitalUpdateRequest = (await import('../models/HospitalUpdateRequest.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const Superadmin = (await import('../models/Superadmin.js')).default;
    
    const { id, requestId } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const updateRequest = await HospitalUpdateRequest.findOne({
      _id: requestId,
      hospital: id
    });
    
    if (!updateRequest) {
      return res.status(404).json({ error: 'Update request not found' });
    }
    
    updateRequest.conversation.push({
      sender: 'HOSPITAL',
      message,
      timestamp: new Date()
    });
    
    await updateRequest.save();
    
    // Notify admin if request is under review
    if (updateRequest.reviewedBy) {
      const notification = await Notification.create({
        type: 'UPDATE_REQUEST_MESSAGE',
        recipient: updateRequest.reviewedBy,
        recipientModel: 'Superadmin',
        sender: id,
        senderModel: 'Hospital',
        title: 'New Message on Update Request',
        message: `Hospital has sent a new message regarding their update request.`,
        metadata: {
          updateRequestId: updateRequest._id,
          messagePreview: message.substring(0, 100)
        }
      });
      
      sendEventToUser('Superadmin', updateRequest.reviewedBy.toString(), {
        type: 'UPDATE_REQUEST_MESSAGE',
        title: 'New Message',
        message: 'Hospital sent a message on update request.',
        timestamp: new Date().toISOString(),
        updateRequestId: updateRequest._id.toString(),
        notificationId: notification._id.toString()
      });
    }
    
    return res.json({ ok: true, updateRequest });
  } catch (err) {
    console.error('add message error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// ==================== END HOSPITAL UPDATE REQUEST WORKFLOW ====================

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
      .populate('patient', 'name firstName lastName email dob patientId suspended')
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
          suspended: Boolean(p.suspended),
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
const ALLOWED_FIELD_TYPES = new Set([
  'text',
  'textarea',
  'number',
  'date',
  'time',
  'select',
  'radio',
  'checkbox',
  'file',
  'email',
  'tel',
  'section',
  'pagebreak',
]);

const slugifyFieldKey = (value = '') =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'field';

const normalizeFormFields = (incomingFields) => {
  if (!Array.isArray(incomingFields) || incomingFields.length === 0) {
    throw new Error('At least one field is required');
  }

  const seen = new Set();
  return incomingFields.map((field, idx) => {
    const label = String(field?.label || '').trim();
    const rawType = String(field?.type || 'text').trim().toLowerCase();
    const normalizedType = ALLOWED_FIELD_TYPES.has(rawType) ? rawType : 'text';
    const type = normalizedType === 'pagebreak' ? 'pageBreak' : normalizedType;

    if (!label && type !== 'pageBreak') throw new Error(`Field ${idx + 1} label is required`);

    let keyBase = slugifyFieldKey(field?.key || label || `field_${idx + 1}`);
    let key = keyBase;
    let count = 1;
    while (seen.has(key)) {
      key = `${keyBase}_${count++}`;
    }
    seen.add(key);

    const options = Array.isArray(field?.options)
      ? field.options.map(opt => String(opt || '').trim()).filter(Boolean)
      : [];

    const allowMultiple = Boolean(field?.allowMultiple || field?.multiSelect);

    const minLength = field?.validation?.minLength;
    const maxLength = field?.validation?.maxLength;

    const validation = {
      min: String(field?.validation?.min || '').trim(),
      max: String(field?.validation?.max || '').trim(),
      minLength: Number.isFinite(Number(minLength)) ? Number(minLength) : undefined,
      maxLength: Number.isFinite(Number(maxLength)) ? Number(maxLength) : undefined,
      pattern: String(field?.validation?.pattern || '').trim(),
      customError: String(field?.validation?.customError || '').trim(),
    };

    if (type === 'select' || type === 'radio' || type === 'checkbox') {
      if (options.length === 0) {
        throw new Error(`Field "${label}" requires at least one option`);
      }
    }

    if (validation.minLength !== undefined && validation.minLength < 0) {
      throw new Error(`Field "${label}" has invalid minLength`);
    }
    if (validation.maxLength !== undefined && validation.maxLength < 0) {
      throw new Error(`Field "${label}" has invalid maxLength`);
    }
    if (
      validation.minLength !== undefined &&
      validation.maxLength !== undefined &&
      validation.minLength > validation.maxLength
    ) {
      throw new Error(`Field "${label}" has minLength greater than maxLength`);
    }

    return {
      id: String(field?.id || `f${Date.now()}_${idx}`),
      label: label || 'Page Break',
      key,
      type,
      required: Boolean(field?.required),
      description: String(field?.description || '').trim(),
      placeholder: String(field?.placeholder || '').trim(),
      options,
      multiSelect: allowMultiple,
      allowMultiple,
      defaultValue: field?.defaultValue ?? '',
      fileSettings: {
        allowedTypes: Array.isArray(field?.fileSettings?.allowedTypes)
          ? field.fileSettings.allowedTypes.map(t => String(t || '').trim()).filter(Boolean)
          : [],
        maxFileSizeMB: Number.isFinite(Number(field?.fileSettings?.maxFileSizeMB))
          ? Math.max(1, Number(field.fileSettings.maxFileSizeMB))
          : 10,
        maxFiles: Number.isFinite(Number(field?.fileSettings?.maxFiles))
          ? Math.max(1, Number(field.fileSettings.maxFiles))
          : 1,
      },
      validation,
    };
  });
};

const normalizeTheme = (theme = {}) => ({
  primaryColor: String(theme.primaryColor || '#6366f1').trim() || '#6366f1',
  backgroundColor: String(theme.backgroundColor || '#0f172a').trim() || '#0f172a',
  cardColor: String(theme.cardColor || '#1e293b').trim() || '#1e293b',
  fontFamily: String(theme.fontFamily || 'Sora').trim() || 'Sora',
});

const normalizeSubmissionSettings = (settings = {}) => ({
  successMessage:
    String(settings.successMessage || 'Thanks! Your response has been recorded.').trim() ||
    'Thanks! Your response has been recorded.',
  redirectUrl: String(settings.redirectUrl || '').trim(),
  sendEmailNotification: Boolean(settings.sendEmailNotification),
});

router.post('/:id/forms', async (req, res) => {
  try {
    const FormTemplate = (await import('../models/FormTemplate.js')).default;
    const Hospital = (await import('../models/Hospital.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing hospital id' });
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });

    const { name, description, fields, createdBy, theme, submissionSettings, active } = req.body || {};
    if (!name || !Array.isArray(fields)) return res.status(400).json({ error: 'name and fields (array) are required' });

    const normalizedFields = normalizeFormFields(fields);

    const initialActive = typeof active === 'boolean' ? active : true;

    const doc = new FormTemplate({
      hospital: hospital._id,
      name: String(name).trim(),
      description: String(description || '').trim(),
      fields: normalizedFields,
      theme: normalizeTheme(theme),
      submissionSettings: normalizeSubmissionSettings(submissionSettings),
      createdBy,
      active: initialActive,
      hasBeenPublished: initialActive,
    });
    await doc.save();
    return res.json({ ok: true, form: doc });
  } catch (err) {
    console.error('create form template error:', err);
    const msg = err?.message || String(err);
    if (msg.includes('Field') || msg.includes('At least one field')) {
      return res.status(400).json({ error: msg });
    }
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
    const filter = { hospital: id, name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') } };
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

    const allowed = ['name', 'description', 'fields', 'active', 'theme', 'submissionSettings', 'hasBeenPublished'];
    const updates = {};
    for (const key of Object.keys(req.body || {})) {
      if (allowed.includes(key)) updates[key] = req.body[key];
    }
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'No valid fields to update' });

    const current = await FormTemplate.findOne({ _id: formId, hospital: id }).lean();
    if (!current) return res.status(404).json({ error: 'Form not found' });

    const isActivating = updates.active === true;
    const hasPublishIntent = req.body?.publishIntent === true;

    if (isActivating) {
      // Backend-oriented guard: activation is allowed only through explicit publish intent.
      if (!hasPublishIntent) {
        return res.status(400).json({ error: 'Cannot activate draft form. Publish it first from editor.' });
      }
      updates.hasBeenPublished = true;
    }

    // Preserve publish lifecycle for older forms when status is toggled.
    if (updates.active === false && current.active === true && updates.hasBeenPublished === undefined) {
      updates.hasBeenPublished = true;
    }

    if (updates.name !== undefined) updates.name = String(updates.name || '').trim();
    if (updates.description !== undefined) updates.description = String(updates.description || '').trim();
    if (updates.fields !== undefined) updates.fields = normalizeFormFields(updates.fields);
    if (updates.theme !== undefined) updates.theme = normalizeTheme(updates.theme);
    if (updates.submissionSettings !== undefined) updates.submissionSettings = normalizeSubmissionSettings(updates.submissionSettings);

    const form = await FormTemplate.findOneAndUpdate(
      { _id: formId, hospital: id },
      { $set: updates },
      { new: true }
    ).lean();
    if (!form) return res.status(404).json({ error: 'Form not found' });
    return res.json({ ok: true, form });
  } catch (err) {
    console.error('update form template error:', err);
    const msg = err?.message || String(err);
    if (msg.includes('Field') || msg.includes('At least one field')) {
      return res.status(400).json({ error: msg });
    }
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
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    const id = req.params.id;
    const patientId = req.params.patientId;
    if (!id || !patientId) return res.status(400).json({ error: 'Missing hospital id or patient id' });
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Enforce consent status first when an access request record exists.
    const accessDoc = await HospitalAccess.findOne({
      hospital: hospital._id,
      patient: patient._id,
    })
      .select('_id status accessLevel')
      .lean();

    if (accessDoc && accessDoc.status !== 'APPROVED') {
      return res.status(403).json({
        error: `Patient access is ${String(accessDoc.status || '').toLowerCase()}. Record submission is allowed only after approval.`,
      });
    }

    // Fallback compatibility for legacy linked data without an access record.
    const hospitalIdStr = hospital._id.toString();
    const inHospitalsArray = patient.hospitals && patient.hospitals.some(h => h.toString() === hospitalIdStr);
    const inLegacyField = patient.hospital && patient.hospital.toString() === hospitalIdStr;
    const approvedAccess = accessDoc && accessDoc.status === 'APPROVED';

    if (!inHospitalsArray && !inLegacyField && !approvedAccess) {
      return res.status(400).json({ error: 'Patient is not linked to this hospital' });
    }

    const { formId, data, attachments, createdBy } = req.body || {};
    // formId optional (freeform), but if provided validate
    if (formId) {
      const form = await FormTemplate.findOne({ _id: formId, hospital: id, active: { $ne: false } }).lean();
      if (!form) {
        return res.status(400).json({ error: 'Form template is inactive or not found for this hospital' });
      }
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

    try {
      const RecordEmbedding = (await import('../models/RecordEmbedding.js')).default;
      const payload = buildRecordEmbeddingPayload({
        patient,
        record: rec,
        formName,
        hospitalName: hospital.name,
      });
      const embedding = await generateEmbedding(payload.text);

      await RecordEmbedding.updateOne(
        { recordId: rec._id },
        {
          $set: {
            recordId: rec._id,
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
    } catch (err) {
      console.warn('record embedding creation failed:', err?.message || err);
    }

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

    const prefs = {
      emailForNewPrescriptions: true,
      ...(patient.notificationPreferences || {}),
    };
    if (prefs.emailForNewPrescriptions && patient.email) {
      const { sendPatientPreferenceEmail } = await import('../utils/emailService.js');
      await sendPatientPreferenceEmail({
        to: patient.email,
        title: 'New medical record added',
        message: `${hospital.name} has added a new ${formName} to your G1CARD profile.`,
        details: [
          `Hospital: ${hospital.name}`,
          `Record Type: ${formName}`,
          `Created At: ${new Date().toLocaleString('en-IN')}`,
        ],
      });
    }

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
      .select('-data -attachments') // Exclude data and attachments for lightweight response
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

        const prefs = {
          emailWhenHospitalAccessRecords: true,
          ...(patient.notificationPreferences || {}),
        };
        if (prefs.emailWhenHospitalAccessRecords && patient.email) {
          const { sendPatientPreferenceEmail } = await import('../utils/emailService.js');
          await sendPatientPreferenceEmail({
            to: patient.email,
            title: 'Hospital accessed your records',
            message: `${hospital.name} viewed your medical records using ${access.accessLevel === 'COMPLETE' ? 'complete' : 'general'} access.`,
            details: [
              `Hospital: ${hospital.name}`,
              `Access Level: ${access.accessLevel}`,
              `Records Viewed: ${records.length}`,
            ],
          });
        }
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
      suspended: Boolean(patient.suspended),
      suspendedAt: patient.suspendedAt || null,
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

// Generate AI medical nutshell summary for a patient (hospital view)
router.post('/:id/patients/:patientId/ai-summary', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    const Record = (await import('../models/Record.js')).default;
    await import('../models/FormTemplate.js'); // registers the schema used by populate('form')

    const id = req.params.id;
    const patientId = req.params.patientId;
    if (!id || !patientId) return res.status(400).json({ error: 'Missing hospital id or patient id' });

    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const patient = await Patient.findById(patientId).lean();
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const access = await HospitalAccess.findOne({ hospital: hospital._id, patient: patientId }).lean();
    if (!access || access.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Access to patient profile not approved' });
    }

    await HospitalAccess.findByIdAndUpdate(access._id, { lastAccessed: new Date() });

    const recordFilter = { patient: patient._id };
    if (access.accessLevel === 'GENERAL') {
      recordFilter.hospital = hospital._id;
    }

    const records = await Record.find(recordFilter)
      .populate('hospital', '_id name')
      .populate('form', 'name description fields')
      .sort({ createdAt: -1 })
      .lean();

    const safePatientData = {
      id: patient._id,
      name: patient.name || `${patient.firstName || ''} ${patient.lastName || ''}`.trim(),
      age: patient.age,
      gender: patient.gender,
      dob: patient.dob,
      bloodGroup: patient.bloodGroup,
      allergies: patient.allergies || [],
      chronicConditions: patient.conditions || [],
      surgeries: patient.surgeries || [],
      medications: patient.medications || [],
      immunizations: patient.immunizationRecords || patient.immunizations || [],
      familyHistory: patient.familyHistory || '',
      smoking: patient.smoking || '',
      height: patient.height,
      weight: patient.weight,
      bmi: patient.bmi,
    };

    const safeRecordData = records.map(record => ({
      recordId: record._id,
      timestamp: record.createdAt,
      hospital: record.hospital?.name || 'Unknown hospital',
      formName: record.form?.name || 'Medical Record',
      formDescription: record.form?.description || '',
      data: record.data || {},
      attachments: (record.attachments || []).map(att => ({
        name: att?.name || '',
        type: att?.type || att?.mimeType || '',
      })),
    }));

    // Every source the model may cite: P = patient profile, R1..Rn = records (newest first)
    const sourceMap = new Map([['P', { kind: 'profile', title: 'Patient profile' }]]);
    const recordLines = safeRecordData.map((record, index) => {
      const ref = `R${index + 1}`;
      sourceMap.set(ref, {
        kind: 'record',
        recordId: String(record.recordId),
        title: record.formName,
        hospital: record.hospital,
        date: record.timestamp ? new Date(record.timestamp).toISOString() : null,
      });
      const data = JSON.stringify(record.data || {});
      return `${ref} | ${record.timestamp ? new Date(record.timestamp).toISOString().slice(0, 10) : 'undated'} | ${record.hospital} | ${record.formName}${record.formDescription ? ` (${record.formDescription})` : ''}\n${data.length > 1800 ? `${data.slice(0, 1800)}…` : data}`;
    });

    const systemPrompt = [
      'You summarize a patient\'s medical history for the treating clinician at a hospital.',
      'Use ONLY the provided sources. Never invent diagnoses, drugs, doses, dates or values.',
      'Every statement must cite the sources it comes from using their ids: "P" for the patient profile, "R1", "R2"... for records.',
      'Return ONLY JSON in exactly this shape (omit nothing, use [] when nothing is documented):',
      '{"overview":{"text":"2-3 sentence clinical picture","refs":["P","R1"]},',
      ' "criticalAlerts":[{"text":"","refs":[]}],      // severe allergies, dangerous interactions, red-flag findings',
      ' "allergies":[{"text":"","refs":[]}],',
      ' "medications":[{"text":"drug, dose, frequency, status if stated","refs":[]}],',
      ' "ongoingTreatments":[{"text":"","refs":[]}],',
      ' "conditions":[{"text":"","refs":[]}],',
      ' "surgeries":[{"text":"procedure and date if stated","refs":[]}],',
      ' "keyFindings":[{"text":"vitals, lab results, diagnoses worth knowing","refs":[]}],',
      ' "timeline":[{"date":"YYYY-MM-DD","text":"what happened","refs":["R1"]}]}',
      'Each item is one short clinical statement (under 25 words). Merge duplicates across records and cite all of them.',
      'Do not write "Not documented" items; leave the list empty instead.',
    ].join('\n');

    const userPrompt = [
      `Hospital: ${hospital.name} (access level: ${access.accessLevel})`,
      `P | Patient profile\n${JSON.stringify(safePatientData)}`,
      ...recordLines,
    ].join('\n\n').slice(0, 60000);

    const ai = await callModel({
      role: 'hospital',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.05,
      maxTokens: 2200,
      jsonMode: true,
    });

    const summary = buildCitedSummary(ai.content, sourceMap);

    return res.json({
      ok: true,
      summary,
      meta: {
        generatedAt: new Date().toISOString(),
        recordCount: records.length,
        accessLevel: access.accessLevel,
        model: { provider: ai.provider, providerLabel: ai.providerLabel, model: ai.model },
      },
    });
  } catch (err) {
    console.error('generate ai summary error:', err);
    const message = err?.message || String(err);
    if (message.includes('No AI provider configured')) {
      return res.status(503).json({ error: 'Hospital AI is not configured on server yet' });
    }
    return res.status(500).json({ error: message });
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
    // Register all possible sender models for Notification.sender refPath population.
    await Promise.all([
      import('../models/Patient.js'),
      import('../models/Hospital.js'),
      import('../models/Superadmin.js'),
    ]);
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
        { title: { $regex: escapeRegex(searchQuery), $options: 'i' } },
        { message: { $regex: escapeRegex(searchQuery), $options: 'i' } }
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

// Get single record details (lazy loaded)
router.get('/:id/patients/:patientId/records/:recordId', async (req, res) => {
  try {
    const Record = (await import('../models/Record.js')).default;
    const Hospital = (await import('../models/Hospital.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    
    const { id, patientId, recordId } = req.params;
    if (!id || !patientId || !recordId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Check consent access
    const access = await HospitalAccess.findOne({ hospital: hospital._id, patient: patient._id }).lean();
    if (!access || access.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Access to patient records not approved' });
    }

    const record = await Record.findById(recordId)
      .populate('hospital', '_id name')
      .populate('form', 'name description fields')
      .lean();

    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    // Verify access to this specific record
    if (access.accessLevel === 'GENERAL' && record.hospital._id.toString() !== hospital._id.toString()) {
      return res.status(403).json({ error: 'You only have access to your own hospital records' });
    }

    return res.json({ ok: true, record });
  } catch (err) {
    console.error('fetch record details error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Mark hospital notification as read
// Mark every notification read in one request
router.patch('/:id/notifications/read-all', (req, res) => markAllRead(req, res, 'Hospital'));

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

