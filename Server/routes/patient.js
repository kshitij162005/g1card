import express from 'express';
import mongoose from 'mongoose';
import { logAccessApproval, logAccessDenial } from '../utils/auditLogger.js';
import { sendEventToUser } from './sse.js';
import { markAllRead } from '../utils/notificationFeed.js';

// Treat user search text literally inside Mongo regex queries
const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const router = express.Router();

// A suspended patient is locked out of every portal endpoint, including sessions that were already open
router.param('id', async (req, res, next, id) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) return next();
    const Patient = (await import('../models/Patient.js')).default;
    const patient = await Patient.findById(id).select('suspended').lean();
    if (patient?.suspended) {
      return res.status(403).json({ error: 'This G1Card account has been suspended by an administrator. Contact support if you think this is a mistake.', code: 'ACCOUNT_SUSPENDED' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
});

const DEFAULT_NOTIFICATION_PREFERENCES = {
  emailWhenHospitalAccessRecords: true,
  emailForNewPrescriptions: true,
  emailForConsultationReminders: true,
};

const escapeCsv = (value) => {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
};

async function purgePatientData({ patientObjectId, patientEmail = '', patientUsername = '' }) {
  const Patient = (await import('../models/Patient.js')).default;
  const Record = (await import('../models/Record.js')).default;
  const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
  const Notification = (await import('../models/Notification.js')).default;
  const EmailOtp = (await import('../models/EmailOtp.js')).default;
  const DeletionRequest = (await import('../models/DeletionRequest.js')).default;
  const AuditLog = (await import('../models/AuditLog.js')).default;

  const emailCandidates = [patientEmail, patientUsername]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  const patientIdAsString = patientObjectId?.toString?.() || String(patientObjectId || '');

  const tasks = [
    Record.deleteMany({ patient: patientObjectId }),
    HospitalAccess.deleteMany({ patient: patientObjectId }),
    Notification.deleteMany({
      $or: [
        { recipient: patientObjectId, recipientModel: 'Patient' },
        { sender: patientObjectId, senderModel: 'Patient' },
      ],
    }),
    DeletionRequest.deleteMany({ patient: patientObjectId }),
    AuditLog.deleteMany({
      $or: [
        { 'actor.id': patientObjectId, 'actor.model': 'Patient' },
        { 'target.id': patientObjectId, 'target.model': 'Patient' },
      ],
    }),
  ];

  if (emailCandidates.length) {
    tasks.push(EmailOtp.deleteMany({ email: { $in: emailCandidates } }));
  }

  if (patientIdAsString) {
    tasks.push(EmailOtp.deleteMany({ 'payload.patientId': patientIdAsString }));
  }

  await Promise.all(tasks);
  await Patient.deleteOne({ _id: patientObjectId });
}

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

// Fetch paginated hospital groups for a patient
router.get('/:id/records/hospitals', async (req, res) => {
  try {
    const Record = (await import('../models/Record.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing patient id' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Convert patient id to ObjectId
    const patientObjectId = new mongoose.Types.ObjectId(id);

    // Aggregate to group records by hospital
    const hospitalGroups = await Record.aggregate([
      { $match: { patient: patientObjectId } },
      {
        $group: {
          _id: '$hospital',
          recordCount: { $sum: 1 },
          lastVisit: { $max: '$createdAt' }
        }
      },
      { $sort: { lastVisit: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    // Get total count for pagination
    const totalGroups = await Record.aggregate([
      { $match: { patient: patientObjectId } },
      { $group: { _id: '$hospital' } },
      { $count: 'total' }
    ]);
    const total = totalGroups.length > 0 ? totalGroups[0].total : 0;

    // Populate hospital details
    const Hospital = (await import('../models/Hospital.js')).default;
    const populatedGroups = await Promise.all(
      hospitalGroups.map(async (group) => {
        const hospital = await Hospital.findById(group._id).select('_id name').lean();
        return {
          hospitalId: group._id,
          hospitalName: hospital?.name || 'Unknown Hospital',
          recordCount: group.recordCount,
          lastVisit: group.lastVisit
        };
      })
    );

    return res.json({
      ok: true,
      hospitals: populatedGroups,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('fetch hospital groups error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Fetch paginated records for a specific hospital
router.get('/:id/records/hospital/:hospitalId', async (req, res) => {
  try {
    const Record = (await import('../models/Record.js')).default;
    await import('../models/FormTemplate.js');
    const { id, hospitalId } = req.params;
    if (!id || !hospitalId) return res.status(400).json({ error: 'Missing patient id or hospital id' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Record.countDocuments({ patient: id, hospital: hospitalId });

    const records = await Record.find({ patient: id, hospital: hospitalId })
      .populate('hospital', '_id name')
      .populate('form', 'name description fields')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.json({
      ok: true,
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page < Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('fetch hospital records error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Fetch all medical records for a patient (legacy endpoint - kept for backward compatibility)
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
    // Ensure Hospital model is registered for populate('hospital')
    await import('../models/Hospital.js');
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing patient id' });
    const statusFilter = (req.query.status || '').toString().toUpperCase();
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));

    const filter = { patient: id };
    if (statusFilter && ['PENDING', 'APPROVED', 'DENIED', 'REVOKED'].includes(statusFilter)) {
      filter.status = statusFilter;
    }

    const total = await HospitalAccess.countDocuments(filter);

    const requests = await HospitalAccess.find(filter)
      .populate('hospital', '_id name')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
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
      pagination: {
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
        page,
        limit,
      },
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
    const Patient = (await import('../models/Patient.js')).default;
    const Hospital = (await import('../models/Hospital.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const id = req.params.id;
    const accessId = req.params.accessId;
    if (!id || !accessId) return res.status(400).json({ error: 'Missing patient id or access id' });

    const { decision, accessLevel } = req.body || {};
    if (!decision || !['APPROVE', 'DENY'].includes(decision.toUpperCase())) {
      return res.status(400).json({ error: 'decision must be APPROVE or DENY' });
    }

    const access = await HospitalAccess.findOne({ _id: accessId, patient: id }).populate('hospital patient');
    if (!access) return res.status(404).json({ error: 'Access request not found' });

    // Get patient and hospital details for audit logging
    const patient = await Patient.findById(id);
    const hospital = await Hospital.findById(access.hospital);

    const previousAccessLevel = access.accessLevel;
    const previousStatus = access.status;

    if (decision.toUpperCase() === 'DENY') {
      access.status = 'DENIED';
      access.accessLevel = null;
      await access.save();

      // Create patient-facing history notification (append-only)
      await Notification.create({
        type: 'GENERAL',
        recipient: id,
        recipientModel: 'Patient',
        sender: id,
        senderModel: 'Patient',
        title: 'Access Request Denied',
        message: `You denied ${hospital?.name || 'hospital'}'s access request.`,
        relatedAccess: access._id,
        metadata: {
          decision: 'DENIED',
          hospitalId: hospital?._id,
          hospitalName: hospital?.name,
          previousStatus,
          timestamp: new Date(),
        }
      });

      // Mark request notifications as processed for this access request
      await Notification.updateMany(
        {
          recipient: id,
          recipientModel: 'Patient',
          relatedAccess: access._id,
          type: 'ACCESS_REQUEST',
          isRead: false,
        },
        {
          $set: {
            isRead: true,
            readAt: new Date(),
          },
        }
      );

      // Create audit log for denial
      await logAccessDenial({
        patientId: id,
        patientName: `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Unknown Patient',
        patientEmail: patient?.email,
        hospitalId: access.hospital._id,
        hospitalName: hospital?.name || 'Unknown Hospital',
        accessId: access._id,
        req
      });

      // Send notification to hospital about denial
      await Notification.create({
        type: 'ACCESS_REVOKED',
        recipient: access.hospital._id,
        recipientModel: 'Hospital',
        sender: id,
        senderModel: 'Patient',
        title: 'Access Request Denied',
        message: `${patient?.firstName || 'Patient'} has denied your access request.`,
        relatedAccess: access._id,
        metadata: {
          decision: 'DENIED',
          previousStatus,
          timestamp: new Date()
        }
      });

      // Send real-time notification to hospital via SSE
      sendEventToUser('Hospital', access.hospital._id.toString(), {
        type: 'ACCESS_DENIED',
        title: 'Access Request Denied',
        message: `${patient?.firstName || 'Patient'} has denied your access request.`,
        timestamp: new Date().toISOString(),
        accessId: access._id.toString()
      });
    } else {
      const level = (accessLevel || '').toString().toUpperCase();
      if (!['GENERAL', 'COMPLETE'].includes(level)) {
        return res.status(400).json({ error: 'accessLevel must be GENERAL or COMPLETE when approving' });
      }
      access.status = 'APPROVED';
      access.accessLevel = level;
      await access.save();

      // Create patient-facing history notification (append-only)
      await Notification.create({
        type: 'GENERAL',
        recipient: id,
        recipientModel: 'Patient',
        sender: id,
        senderModel: 'Patient',
        title: previousAccessLevel ? 'Access Upgraded' : 'Access Approved',
        message: `You granted ${hospital?.name || 'hospital'} ${level === 'COMPLETE' ? 'complete' : 'general'} access.`,
        relatedAccess: access._id,
        metadata: {
          decision: 'APPROVED',
          accessLevel: level,
          previousAccessLevel,
          hospitalId: hospital?._id,
          hospitalName: hospital?.name,
          timestamp: new Date(),
        }
      });

      // Mark request notifications as processed for this access request
      await Notification.updateMany(
        {
          recipient: id,
          recipientModel: 'Patient',
          relatedAccess: access._id,
          type: 'ACCESS_REQUEST',
          isRead: false,
        },
        {
          $set: {
            isRead: true,
            readAt: new Date(),
          },
        }
      );

      // Create audit log for approval
      await logAccessApproval({
        patientId: id,
        patientName: `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Unknown Patient',
        patientEmail: patient?.email,
        hospitalId: access.hospital._id,
        hospitalName: hospital?.name || 'Unknown Hospital',
        accessLevel: level,
        previousAccessLevel,
        accessId: access._id,
        req
      });

      // Send notification to hospital about approval
      await Notification.create({
        type: 'ACCESS_GRANTED',
        recipient: access.hospital._id,
        recipientModel: 'Hospital',
        sender: id,
        senderModel: 'Patient',
        title: `Access Request ${previousAccessLevel ? 'Upgraded' : 'Approved'}`,
        message: `${patient?.firstName || 'Patient'} has ${previousAccessLevel ? 'upgraded your access to' : 'granted you'} ${level} access.`,
        relatedAccess: access._id,
        metadata: {
          decision: 'APPROVED',
          accessLevel: level,
          previousAccessLevel,
          previousStatus,
          timestamp: new Date()
        }
      });

      // Send real-time notification to hospital via SSE
      sendEventToUser('Hospital', access.hospital._id.toString(), {
        type: 'ACCESS_GRANTED',
        title: `Access Request ${previousAccessLevel ? 'Upgraded' : 'Approved'}`,
        message: `${patient?.firstName || 'Patient'} has ${previousAccessLevel ? 'upgraded your access to' : 'granted you'} ${level} access.`,
        timestamp: new Date().toISOString(),
        accessId: access._id.toString(),
        accessLevel: level
      });
    }

    return res.json({
      ok: true,
      accessRequest: {
        id: access._id,
        status: access.status,
        accessLevel: access.accessLevel,
        hospitalId: access.hospital._id,
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

// Get approved hospital accesses for a patient
router.get('/:id/hospital-accesses/count', async (req, res) => {
  try {
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing patient id' });

    const [completeAccess, partialAccess] = await Promise.all([
      HospitalAccess.countDocuments({ patient: id, status: 'APPROVED', accessLevel: 'COMPLETE' }),
      HospitalAccess.countDocuments({ patient: id, status: 'APPROVED', accessLevel: 'GENERAL' })
    ]);

    return res.json({
      ok: true,
      counts: {
        total: completeAccess + partialAccess,
        complete: completeAccess,
        partial: partialAccess
      }
    });
  } catch (err) {
    console.error('hospital access count error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

router.get('/:id/hospital-accesses', async (req, res) => {
  try {
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    // Ensure Hospital model is registered for populate('hospital')
    await import('../models/Hospital.js');
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing patient id' });

    const accesses = await HospitalAccess.find({ patient: id, status: 'APPROVED' })
      .populate('hospital', '_id name')
      .sort({ lastAccessed: -1 })
      .lean();

    return res.json({
      ok: true,
      accesses: accesses.map(a => ({
        id: a._id,
        hospitalId: a.hospital?._id,
        hospitalName: a.hospital?.name,
        accessLevel: a.accessLevel,
        lastAccessed: a.lastAccessed,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    });
  } catch (err) {
    console.error('list hospital accesses error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Update access level for a hospital
router.patch('/:id/hospital-accesses/:accessId', async (req, res) => {
  try {
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const Hospital = (await import('../models/Hospital.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const id = req.params.id;
    const accessId = req.params.accessId;
    if (!id || !accessId) return res.status(400).json({ error: 'Missing patient id or access id' });

    const { accessLevel } = req.body || {};
    if (!accessLevel || !['GENERAL', 'COMPLETE'].includes(accessLevel.toUpperCase())) {
      return res.status(400).json({ error: 'accessLevel must be GENERAL or COMPLETE' });
    }

    const access = await HospitalAccess.findOne({ _id: accessId, patient: id });
    if (!access) return res.status(404).json({ error: 'Access not found' });
    if (access.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Can only update approved accesses' });
    }

    // Get patient and hospital details for notification
    const patient = await Patient.findById(id);
    const hospital = await Hospital.findById(access.hospital);
    const previousLevel = access.accessLevel;
    const newLevel = accessLevel.toUpperCase();

    access.accessLevel = newLevel;
    await access.save();

    // Create patient-facing history notification for each explicit access-level change
    await Notification.create({
      type: 'ACCESS_LEVEL_CHANGED',
      recipient: id,
      recipientModel: 'Patient',
      sender: id,
      senderModel: 'Patient',
      title: 'Hospital Permission Updated',
      message: `You changed ${hospital?.name || 'hospital'} access from ${previousLevel} to ${newLevel}.`,
      relatedAccess: access._id,
      metadata: {
        hospitalId: hospital?._id,
        hospitalName: hospital?.name,
        previousLevel,
        newLevel,
        timestamp: new Date(),
      }
    });

    // Notify hospital about access level change
    if (previousLevel !== newLevel) {
      const notification = await Notification.create({
        type: 'ACCESS_LEVEL_CHANGED',
        recipient: hospital._id,
        recipientModel: 'Hospital',
        sender: patient._id,
        senderModel: 'Patient',
        title: 'Access Level Modified',
        message: `${patient?.firstName || 'Patient'} has ${newLevel === 'COMPLETE' ? 'upgraded' : 'downgraded'} your access from ${previousLevel} to ${newLevel}.`,
        metadata: {
          patientId: patient._id,
          patientName: `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Patient',
          previousLevel,
          newLevel,
          accessId: access._id
        }
      });

      // Send real-time notification via SSE
      sendEventToUser('Hospital', hospital._id.toString(), {
        type: 'ACCESS_LEVEL_CHANGED',
        title: 'Access Level Modified',
        message: `${patient?.firstName || 'Patient'} has changed your access level to ${newLevel}.`,
        timestamp: new Date().toISOString(),
        patientName: `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Patient',
        previousLevel,
        newLevel,
        notificationId: notification._id.toString()
      });
    }

    return res.json({
      ok: true,
      access: {
        id: access._id,
        status: access.status,
        accessLevel: access.accessLevel,
        updatedAt: access.updatedAt,
      },
    });
  } catch (err) {
    console.error('update access level error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Revoke hospital access
router.post('/:id/hospital-accesses/:accessId/revoke', async (req, res) => {
  try {
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const Hospital = (await import('../models/Hospital.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const { logAccessRevocation } = await import('../utils/auditLogger.js');
    
    const id = req.params.id;
    const accessId = req.params.accessId;
    const { reason } = req.body || {};
    
    if (!id || !accessId) return res.status(400).json({ error: 'Missing patient id or access id' });

    const access = await HospitalAccess.findOne({ _id: accessId, patient: id });
    if (!access) return res.status(404).json({ error: 'Access not found' });

    // Get patient and hospital details for logging and notification
    const patient = await Patient.findById(id);
    const hospital = await Hospital.findById(access.hospital);
    
    const previousAccessLevel = access.accessLevel;
    const previousStatus = access.status;

    access.status = 'REVOKED';
    access.accessLevel = null;
    await access.save();

    // Create patient-facing history notification for revoke action
    await Notification.create({
      type: 'GENERAL',
      recipient: id,
      recipientModel: 'Patient',
      sender: id,
      senderModel: 'Patient',
      title: 'Hospital Access Revoked',
      message: `You revoked ${hospital?.name || 'hospital'} access to your medical records.`,
      relatedAccess: access._id,
      metadata: {
        hospitalId: hospital?._id,
        hospitalName: hospital?.name,
        previousAccessLevel,
        previousStatus,
        timestamp: new Date(),
      }
    });

    // Create audit log for revocation
    await logAccessRevocation({
      actorId: id,
      actorModel: 'Patient',
      actorName: `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Unknown Patient',
      hospitalId: access.hospital,
      hospitalName: hospital?.name || 'Unknown Hospital',
      patientId: id,
      patientName: `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Unknown Patient',
      accessId: access._id,
      reason: reason || 'Patient revoked access',
      req
    });

    // Notify hospital about revocation
    await Notification.create({
      type: 'ACCESS_REVOKED',
      recipient: access.hospital,
      recipientModel: 'Hospital',
      sender: id,
      senderModel: 'Patient',
      title: 'Access Revoked',
      message: `${patient?.firstName || 'Patient'} ${patient?.lastName || ''} has revoked your access to their medical records.`,
      relatedAccess: access._id,
      metadata: {
        previousAccessLevel,
        previousStatus,
        reason: reason || 'Patient revoked access',
        timestamp: new Date()
      }
    });

    // Send real-time notification to hospital via SSE
    sendEventToUser('Hospital', access.hospital.toString(), {
      type: 'ACCESS_REVOKED',
      title: 'Access Revoked',
      message: `${patient?.firstName || 'Patient'} ${patient?.lastName || ''} has revoked your access to their medical records.`,
      timestamp: new Date().toISOString(),
      accessId: access._id.toString()
    });

    return res.json({
      ok: true,
      access: {
        id: access._id,
        status: access.status,
        accessLevel: access.accessLevel,
        updatedAt: access.updatedAt,
      },
    });
  } catch (err) {
    console.error('revoke access error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get patient notification preferences
router.get('/:id/preferences/notifications', async (req, res) => {
  try {
    const Patient = (await import('../models/Patient.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing patient id' });

    const patient = await Patient.findById(id).select('notificationPreferences').lean();
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    return res.json({
      ok: true,
      preferences: {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...(patient.notificationPreferences || {}),
      },
    });
  } catch (err) {
    console.error('get notification preferences error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Update patient notification preferences
router.patch('/:id/preferences/notifications', async (req, res) => {
  try {
    const Patient = (await import('../models/Patient.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing patient id' });

    const incoming = req.body || {};
    const nextPrefs = {
      emailWhenHospitalAccessRecords: Boolean(incoming.emailWhenHospitalAccessRecords),
      emailForNewPrescriptions: Boolean(incoming.emailForNewPrescriptions),
      emailForConsultationReminders: Boolean(incoming.emailForConsultationReminders),
    };

    const updated = await Patient.findByIdAndUpdate(
      id,
      { $set: { notificationPreferences: nextPrefs } },
      { new: true }
    ).select('notificationPreferences').lean();

    if (!updated) return res.status(404).json({ error: 'Patient not found' });

    return res.json({ ok: true, preferences: updated.notificationPreferences });
  } catch (err) {
    console.error('update notification preferences error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Trigger consultation reminder (used for reminder workflows and preference-driven email)
router.post('/:id/consultation-reminders', async (req, res) => {
  try {
    const Patient = (await import('../models/Patient.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const { sendPatientPreferenceEmail } = await import('../utils/emailService.js');

    const id = req.params.id;
    const { hospitalName, reminderText, reminderAt } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing patient id' });

    const patient = await Patient.findById(id).lean();
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const title = 'Consultation Reminder';
    const message = reminderText || `You have an upcoming consultation${hospitalName ? ` with ${hospitalName}` : ''}.`;

    const notification = await Notification.create({
      type: 'GENERAL',
      recipient: patient._id,
      recipientModel: 'Patient',
      title,
      message,
      metadata: {
        source: 'CONSULTATION_REMINDER',
        hospitalName: hospitalName || '',
        reminderAt: reminderAt || null,
      },
    });

    sendEventToUser('Patient', patient._id.toString(), {
      type: 'CONSULTATION_REMINDER',
      title,
      message,
      timestamp: new Date().toISOString(),
      notificationId: notification._id.toString(),
    });

    const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(patient.notificationPreferences || {}) };
    if (prefs.emailForConsultationReminders && patient.email) {
      await sendPatientPreferenceEmail({
        to: patient.email,
        title,
        message,
        details: [
          hospitalName ? `Hospital: ${hospitalName}` : 'Hospital: N/A',
          reminderAt ? `Scheduled At: ${new Date(reminderAt).toLocaleString('en-IN')}` : 'Scheduled At: As advised by care team',
        ],
      });
    }

    return res.json({ ok: true, message: 'Consultation reminder sent' });
  } catch (err) {
    console.error('consultation reminder error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Download structured patient data export as CSV or PDF
router.get('/:id/data-export', async (req, res) => {
  try {
    const Patient = (await import('../models/Patient.js')).default;
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    const Record = (await import('../models/Record.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const DeletionRequest = (await import('../models/DeletionRequest.js')).default;
    const AuditLog = (await import('../models/AuditLog.js')).default;
    const EmailOtp = (await import('../models/EmailOtp.js')).default;
    await import('../models/Hospital.js');
    await import('../models/FormTemplate.js');

    const id = req.params.id;
    const format = String(req.query.format || 'csv').toLowerCase();
    if (!id) return res.status(400).json({ error: 'Missing patient id' });
    if (!['csv', 'pdf'].includes(format)) return res.status(400).json({ error: 'format must be csv or pdf' });

    const patient = await Patient.findById(id).lean();
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const sanitizedPatient = { ...patient };
    delete sanitizedPatient.password;
    delete sanitizedPatient.__v;

    const iso = (value) => {
      if (!value) return '';
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? '' : d.toISOString();
    };

    const normalizeText = (value) => String(value ?? '')
      .replace(/[\{\}\[\]"]/g, ' ')
      .replace(/:/g, ' - ')
      .replace(/,/g, ' - ')
      .replace(/\s+/g, ' ')
      .trim();

    const formatFieldPath = (path) => String(path || '')
      .replace(/\[(\d+)\]/g, ' item $1')
      .replace(/\./g, ' - ')
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const plain = (value) => {
      if (value === undefined || value === null) return '';
      if (value instanceof Date) return normalizeText(value.toISOString());
      if (Array.isArray(value)) return normalizeText(value.map((item) => plain(item)).join(' | '));
      if (typeof value === 'object') {
        if (value && typeof value.toHexString === 'function') return normalizeText(value.toHexString());
        if (value && value._id && typeof value._id.toString === 'function') return normalizeText(value._id.toString());
        return normalizeText(
          Object.entries(value)
            .map(([key, nested]) => `${formatFieldPath(key)} ${plain(nested)}`)
            .join(' | ')
        );
      }
      return normalizeText(String(value));
    };

    const flattenObject = (input, parentKey = '') => {
      const rows = [];
      if (input === null || input === undefined) {
        rows.push({ field: parentKey || 'value', value: '' });
        return rows;
      }

      if (Array.isArray(input)) {
        if (!input.length) {
          rows.push({ field: parentKey || 'value', value: '' });
          return rows;
        }
        input.forEach((item, index) => {
          const nextKey = parentKey ? `${parentKey}[${index}]` : `[${index}]`;
          if (item && typeof item === 'object' && !(item instanceof Date)) {
            rows.push(...flattenObject(item, nextKey));
          } else {
            rows.push({ field: formatFieldPath(nextKey), value: plain(item) });
          }
        });
        return rows;
      }

      if (typeof input === 'object' && !(input instanceof Date)) {
        const keys = Object.keys(input);
        if (!keys.length) {
          rows.push({ field: parentKey || 'value', value: '' });
          return rows;
        }
        keys.forEach((key) => {
          const nextKey = parentKey ? `${parentKey}.${key}` : key;
          const value = input[key];
          if (value && typeof value === 'object' && !(value instanceof Date)) {
            rows.push(...flattenObject(value, nextKey));
          } else {
            rows.push({ field: formatFieldPath(nextKey), value: plain(value) });
          }
        });
        return rows;
      }

      rows.push({ field: formatFieldPath(parentKey || 'value'), value: plain(input) });
      return rows;
    };

    const patientEmail = String(sanitizedPatient.email || '').trim().toLowerCase();
    const patientUsername = String(sanitizedPatient.username || '').trim().toLowerCase();
    const emailCandidates = [patientEmail, patientUsername].filter(Boolean);

    const [accesses, recordsPrimary, notifications, deletionRequests, auditLogs, emailOtps] = await Promise.all([
      HospitalAccess.find({ patient: id }).populate('hospital', 'name contactEmail').lean(),
      Record.find({ patient: id })
        .populate('hospital', 'name contactEmail')
        .populate('form', 'name')
        .sort({ createdAt: -1 })
        .lean(),
      Notification.find({
        $or: [
          { recipient: id, recipientModel: 'Patient' },
          { sender: id, senderModel: 'Patient' },
        ],
      }).sort({ createdAt: -1 }).lean(),
      DeletionRequest.find({ patient: id }).sort({ createdAt: -1 }).lean(),
      AuditLog.find({
        $or: [
          { 'actor.id': id, 'actor.model': 'Patient' },
          { 'target.id': id, 'target.model': 'Patient' },
        ],
      }).sort({ createdAt: -1 }).lean(),
      EmailOtp.find({
        $or: [
          ...(emailCandidates.length ? [{ email: { $in: emailCandidates } }] : []),
          ...(sanitizedPatient.patientId ? [{ 'payload.patientId': String(sanitizedPatient.patientId) }] : []),
        ],
      }).sort({ createdAt: -1 }).lean(),
    ]);

    // Legacy fallback in case older records don't have patient ObjectId linked properly
    const records = recordsPrimary.length
      ? recordsPrimary
      : (sanitizedPatient.patientId
        ? await Record.find({ 'data.patientId': sanitizedPatient.patientId })
            .populate('hospital', 'name contactEmail')
            .populate('form', 'name')
            .sort({ createdAt: -1 })
            .lean()
        : []);

    const profileRows = flattenObject(sanitizedPatient);
    const recordFieldRows = records.flatMap((record) => {
      const flattened = flattenObject(record.data || {}, 'data');
      return flattened.map((entry) => ({
        recordId: String(record._id || ''),
        hospital: record.hospital?.name || 'Unknown',
        form: record.form?.name || 'General Record',
        field: entry.field,
        value: entry.value,
      }));
    });
    const attachmentRows = records.flatMap((record) => {
      const attachments = Array.isArray(record.attachments) ? record.attachments : [];
      return attachments.length
        ? attachments.flatMap((item, index) => flattenObject(item, `attachment[${index}]`).map((entry) => ({
            recordId: String(record._id || ''),
            field: entry.field,
            value: entry.value,
          })))
        : [];
    });
    const notificationMetadataRows = notifications.flatMap((notification) =>
      flattenObject(notification.metadata || {}, 'metadata').map((entry) => ({
        notificationId: String(notification._id || ''),
        field: entry.field,
        value: entry.value,
      }))
    );
    const auditDetailRows = auditLogs.flatMap((log) => {
      const changesBefore = flattenObject(log.changes?.before || {}, 'changes.before');
      const changesAfter = flattenObject(log.changes?.after || {}, 'changes.after');
      const metadataRows = flattenObject(log.metadata || {}, 'metadata');
      const complianceRows = flattenObject(log.compliance || {}, 'compliance');
      return [...changesBefore, ...changesAfter, ...metadataRows, ...complianceRows].map((entry) => ({
        auditId: String(log._id || ''),
        field: entry.field,
        value: entry.value,
      }));
    });

    const nowIso = new Date().toISOString();

    if (format === 'csv') {
      const lines = [];

      const pushTable = (title, headers, rows) => {
        lines.push('');
        lines.push('G1CARD CONFIDENTIAL WATERMARK');
        lines.push(title);
        lines.push(['WATERMARK', ...headers].map((header) => escapeCsv(header)).join(','));
        if (!rows.length) {
          lines.push([escapeCsv('G1CARD CONFIDENTIAL'), escapeCsv('No rows')].join(','));
          return;
        }
        rows.forEach((row) => {
          lines.push(['G1CARD CONFIDENTIAL', ...row].map((value) => escapeCsv(value)).join(','));
        });
      };

      lines.push('G1CARD PATIENT DETAILED DATA EXPORT');
      lines.push(`Generated At (ISO),${escapeCsv(nowIso)}`);
      lines.push(`Patient DB ID,${escapeCsv(id)}`);

      pushTable('PROFILE_FIELDS', ['Field', 'Value'], profileRows.map((row) => [row.field, row.value]));

      pushTable(
        'HOSPITAL_ACCESS',
        ['Access ID', 'Hospital Name', 'Hospital Email', 'Status', 'Access Level', 'Last Accessed', 'Created At', 'Updated At'],
        accesses.map((access) => [
          String(access._id || ''),
          access.hospital?.name || 'Unknown',
          access.hospital?.contactEmail || '',
          access.status || '',
          access.accessLevel || '',
          iso(access.lastAccessed),
          iso(access.createdAt),
          iso(access.updatedAt),
        ])
      );

      pushTable(
        'MEDICAL_RECORDS',
        ['Record ID', 'Hospital', 'Hospital Email', 'Form', 'Created By', 'Created At', 'Updated At'],
        records.map((record) => [
          String(record._id || ''),
          record.hospital?.name || 'Unknown',
          record.hospital?.contactEmail || '',
          record.form?.name || 'General Record',
          record.createdBy || '',
          iso(record.createdAt),
          iso(record.updatedAt),
        ])
      );

      pushTable(
        'MEDICAL_RECORD_FIELDS',
        ['Record ID', 'Hospital', 'Form', 'Field Path', 'Value'],
        recordFieldRows.map((row) => [row.recordId, row.hospital, row.form, row.field, row.value])
      );

      pushTable(
        'MEDICAL_RECORD_ATTACHMENTS',
        ['Record ID', 'Attachment Field', 'Value'],
        attachmentRows.map((row) => [row.recordId, row.field, row.value])
      );

      pushTable(
        'NOTIFICATIONS',
        ['Notification ID', 'Type', 'Title', 'Message', 'Read', 'Recipient Model', 'Sender Model', 'Action URL', 'Created At'],
        notifications.map((notification) => [
          String(notification._id || ''),
          notification.type || '',
          notification.title || '',
          notification.message || '',
          notification.isRead ? 'true' : 'false',
          notification.recipientModel || '',
          notification.senderModel || '',
          notification.actionUrl || '',
          iso(notification.createdAt),
        ])
      );

      pushTable(
        'NOTIFICATION_METADATA',
        ['Notification ID', 'Field Path', 'Value'],
        notificationMetadataRows.map((row) => [row.notificationId, row.field, row.value])
      );

      pushTable(
        'DELETION_REQUESTS',
        ['Request ID', 'Type', 'Status', 'Reason', 'Review Notes', 'Requested By Email', 'Reviewed By', 'Created At', 'Reviewed At'],
        deletionRequests.map((request) => [
          String(request._id || ''),
          request.requestType || '',
          request.status || '',
          request.reason || '',
          request.reviewNotes || request.adminRemarks || '',
          request.requestedByEmail || '',
          plain(request.reviewedBy || ''),
          iso(request.createdAt),
          iso(request.reviewedAt),
        ])
      );

      pushTable(
        'AUDIT_LOGS',
        ['Audit ID', 'Event', 'Outcome', 'Severity', 'Actor Model', 'Actor Name', 'Target Model', 'Description', 'Created At'],
        auditLogs.map((log) => [
          String(log._id || ''),
          log.event || '',
          log.action?.outcome || '',
          log.severity || '',
          log.actor?.model || '',
          log.actor?.name || '',
          log.target?.model || '',
          log.action?.description || '',
          iso(log.createdAt),
        ])
      );

      pushTable(
        'AUDIT_LOG_DETAILS',
        ['Audit ID', 'Field Path', 'Value'],
        auditDetailRows.map((row) => [row.auditId, row.field, row.value])
      );

      pushTable(
        'EMAIL_OTP_LOGS',
        ['OTP ID', 'Email', 'Purpose', 'Attempts', 'Expires At', 'Used At', 'Created At', 'Updated At'],
        emailOtps.map((otp) => [
          String(otp._id || ''),
          otp.email || '',
          otp.purpose || '',
          plain(otp.attempts || 0),
          iso(otp.expiresAt),
          iso(otp.usedAt),
          iso(otp.createdAt),
          iso(otp.updatedAt),
        ])
      );

      pushTable(
        'EMAIL_OTP_PAYLOAD',
        ['OTP ID', 'Field Path', 'Value'],
        emailOtps.flatMap((otp) => flattenObject(otp.payload || {}, 'payload').map((entry) => [String(otp._id || ''), entry.field, entry.value]))
      );

      const csv = lines.join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="g1card-data-export-${id}.csv"`);
      return res.send(csv);
    }

    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const filename = `g1card-data-export-${id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    const pageBottom = () => doc.page.height - doc.page.margins.bottom;
    const ensureSpace = (heightNeeded = 28) => {
      if (doc.y + heightNeeded > pageBottom()) doc.addPage();
    };

    const drawWatermark = () => {
      const cx = doc.page.width / 2;
      const cy = doc.page.height / 2;
      doc.save();
      doc.rotate(-35, { origin: [cx, cy] });
      doc.fillColor('#64748b', 0.12);
      doc.font('Helvetica-Bold').fontSize(64).text('G1CARD CONFIDENTIAL', cx - 280, cy - 50, { width: 560, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(36).text('DO NOT SHARE', cx - 200, cy + 10, { width: 400, align: 'center' });
      doc.restore();
      doc.save();
      doc.fillColor('#64748b', 0.3);
      doc.font('Helvetica-Bold').fontSize(8).text('G1CARD CONFIDENTIAL - EXPORTED PATIENT DATA', doc.page.margins.left, doc.page.height - 20, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'center',
      });
      doc.restore();
      doc.fillColor('#0f172a', 1);
    };

    doc.on('pageAdded', () => {
      drawWatermark();
      doc.font('Helvetica');
      doc.fillColor('#0f172a', 1);
    });
    drawWatermark();

    const drawSectionTitle = (title) => {
      ensureSpace(40);
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#0f4aa0').text(title);
      doc.moveDown(0.25);
    };

    const drawTable = (headers, rows, columnWidths) => {
      const xStart = doc.page.margins.left;
      const yStart = doc.y;
      const widths = columnWidths || headers.map(() => (doc.page.width - doc.page.margins.left - doc.page.margins.right) / headers.length);
      const padX = 4;
      const padY = 5;

      const drawHeaderRow = () => {
        ensureSpace(24);
        let x = xStart;
        doc.font('Helvetica-Bold').fontSize(8);
        headers.forEach((header, idx) => {
          const w = widths[idx];
          doc.rect(x, doc.y, w, 20).fillAndStroke('#dbeafe', '#93c5fd');
          doc.fillColor('#0f172a').text(String(header), x + padX, doc.y + 6, { width: w - padX * 2, align: 'left' });
          x += w;
        });
        doc.moveDown(1.4);
      };

      drawHeaderRow();

      if (!rows.length) {
        ensureSpace(22);
        doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('No rows available for this section.');
        doc.moveDown(0.6);
        return;
      }

      rows.forEach((row) => {
        doc.font('Helvetica').fontSize(8).fillColor('#1f2937');
        const values = row.map((value) => String(value ?? ''));
        const heights = values.map((value, idx) => {
          const w = widths[idx] || 80;
          return doc.heightOfString(value || '-', { width: w - padX * 2, align: 'left' });
        });
        const rowHeight = Math.max(18, Math.max(...heights) + padY * 2);
        ensureSpace(rowHeight + 2);
        if (doc.y + rowHeight > pageBottom()) {
          doc.addPage();
          drawHeaderRow();
        }

        let x = xStart;
        const y = doc.y;
        values.forEach((value, idx) => {
          const w = widths[idx] || 80;
          doc.rect(x, y, w, rowHeight).strokeColor('#cbd5e1').stroke();
          doc.fillColor('#1f2937').text(value || '-', x + padX, y + padY, { width: w - padX * 2, align: 'left' });
          x += w;
        });
        doc.y = y + rowHeight;
      });

      doc.moveDown(0.7);
      if (doc.y < yStart) doc.y = yStart;
    };

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#0f4aa0').text('G1CARD Patient Data Export', { align: 'left' });
    doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`Generated: ${new Date().toLocaleString('en-IN')}`);
    doc.text(`Patient ID: ${id}`);
    doc.text('This export includes all patient-linked records in the database except password fields.');

    drawSectionTitle('Profile Fields');
    drawTable(
      ['Field', 'Value'],
      profileRows.map((row) => [row.field, row.value]),
      [220, 295]
    );

    drawSectionTitle('Hospital Access');
    drawTable(
      ['Hospital', 'Status', 'Access', 'Last Accessed', 'Updated'],
      accesses.map((access) => [
        access.hospital?.name || 'Unknown',
        access.status || '',
        access.accessLevel || '',
        iso(access.lastAccessed),
        iso(access.updatedAt),
      ]),
      [140, 80, 70, 112, 113]
    );

    drawSectionTitle('Medical Records');
    drawTable(
      ['Record ID', 'Hospital', 'Form', 'Created By', 'Created At'],
      records.map((record) => [
        String(record._id || ''),
        record.hospital?.name || 'Unknown',
        record.form?.name || 'General Record',
        record.createdBy || '',
        iso(record.createdAt),
      ]),
      [120, 130, 95, 80, 90]
    );

    drawSectionTitle('Medical Record Fields (Flattened)');
    drawTable(
      ['Record ID', 'Field Path', 'Value'],
      recordFieldRows.map((row) => [row.recordId, row.field, row.value]),
      [120, 175, 220]
    );

    drawSectionTitle('Medical Record Attachments');
    drawTable(
      ['Record ID', 'Attachment Field', 'Value'],
      attachmentRows.map((row) => [row.recordId, row.field, row.value]),
      [120, 175, 220]
    );

    drawSectionTitle('Notifications');
    drawTable(
      ['Type', 'Title', 'Read', 'Created At', 'Message'],
      notifications.map((notification) => [
        notification.type || '',
        notification.title || '',
        notification.isRead ? 'Yes' : 'No',
        iso(notification.createdAt),
        notification.message || '',
      ]),
      [80, 125, 45, 95, 170]
    );

    drawSectionTitle('Deletion Requests');
    drawTable(
      ['Type', 'Status', 'Reason', 'Review Notes', 'Created'],
      deletionRequests.map((request) => [
        request.requestType || '',
        request.status || '',
        request.reason || '',
        request.reviewNotes || request.adminRemarks || '',
        iso(request.createdAt),
      ]),
      [95, 60, 130, 145, 85]
    );

    drawSectionTitle('Audit Logs');
    drawTable(
      ['Event', 'Outcome', 'Severity', 'Description', 'Created At'],
      auditLogs.map((log) => [
        log.event || '',
        log.action?.outcome || '',
        log.severity || '',
        log.action?.description || '',
        iso(log.createdAt),
      ]),
      [110, 70, 65, 180, 90]
    );

    drawSectionTitle('Audit Log Details (Flattened)');
    drawTable(
      ['Audit ID', 'Field Path', 'Value'],
      auditDetailRows.map((row) => [row.auditId, row.field, row.value]),
      [120, 175, 220]
    );

    drawSectionTitle('Email OTP Logs');
    drawTable(
      ['Email', 'Purpose', 'Attempts', 'Expires At', 'Used At'],
      emailOtps.map((otp) => [
        otp.email || '',
        otp.purpose || '',
        plain(otp.attempts || 0),
        iso(otp.expiresAt),
        iso(otp.usedAt),
      ]),
      [145, 130, 55, 95, 90]
    );

    drawSectionTitle('Email OTP Payload (Flattened)');
    drawTable(
      ['OTP ID', 'Field Path', 'Value'],
      emailOtps.flatMap((otp) => flattenObject(otp.payload || {}, 'payload').map((entry) => [String(otp._id || ''), entry.field, entry.value])),
      [120, 175, 220]
    );

    ensureSpace(24);
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('G1CARD Confidential Export. Handle according to healthcare privacy policy.');
    doc.end();
  } catch (err) {
    console.error('data export error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Submit patient deletion request for super admin approval
router.post('/:id/deletion-requests', async (req, res) => {
  try {
    const Patient = (await import('../models/Patient.js')).default;
    const Superadmin = (await import('../models/Superadmin.js')).default;
    const Notification = (await import('../models/Notification.js')).default;
    const DeletionRequest = (await import('../models/DeletionRequest.js')).default;
    const { sendDeletionRequestEmailToAdmin } = await import('../utils/emailService.js');

    const id = req.params.id;
    const { requestType, reason } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Missing patient id' });
    if (!['DATA_DELETION', 'ACCOUNT_DELETION'].includes(String(requestType || ''))) {
      return res.status(400).json({ error: 'requestType must be DATA_DELETION or ACCOUNT_DELETION' });
    }

    const patient = await Patient.findById(id).lean();
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    if (requestType === 'ACCOUNT_DELETION') {
      await purgePatientData({
        patientObjectId: patient._id,
        patientEmail: patient.email || '',
        patientUsername: patient.username || '',
      });

      // Notify admin by email only to avoid storing user traces in DB.
      await sendDeletionRequestEmailToAdmin({
        patientName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || patient.name || 'Unknown Patient',
        patientEmail: patient.email || patient.username || '',
        requestType,
        reason: String(reason || '').trim(),
      });

      return res.json({
        ok: true,
        accountDeleted: true,
        message: 'Your account and associated data have been permanently deleted.',
      });
    }

    const existingPending = await DeletionRequest.findOne({ patient: id, requestType, status: 'PENDING' }).lean();
    if (existingPending) {
      return res.status(409).json({ error: 'A pending request already exists for this request type' });
    }

    const request = await DeletionRequest.create({
      patient: id,
      requestType,
      reason: String(reason || '').trim(),
      requestedByEmail: patient.email || patient.username || '',
    });

    const admins = await Superadmin.find({}).select('_id').lean();
    if (admins.length) {
      await Notification.insertMany(
        admins.map((admin) => ({
          type: 'GENERAL',
          recipient: admin._id,
          recipientModel: 'Superadmin',
          sender: id,
          senderModel: 'Patient',
          title: 'Patient Deletion Request Submitted',
          message: `${(`${patient.firstName || ''} ${patient.lastName || ''}`.trim() || patient.email || 'A patient')} submitted a deletion request.`,
          metadata: {
            source: 'PATIENT_DELETION_REQUEST',
            requestId: request._id,
            requestType,
            patientId: patient._id,
            patientEmail: patient.email || '',
            reason: request.reason,
          },
        }))
      );
    }

    await sendDeletionRequestEmailToAdmin({
      patientName: `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || patient.name || 'Unknown Patient',
      patientEmail: patient.email || patient.username || '',
      requestType,
      reason: request.reason,
    });

    return res.json({ ok: true, request });
  } catch (err) {
    console.error('create deletion request error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get deletion request status/history for a patient
router.get('/:id/deletion-requests', async (req, res) => {
  try {
    const DeletionRequest = (await import('../models/DeletionRequest.js')).default;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing patient id' });

    const requests = await DeletionRequest.find({ patient: id })
      .sort({ createdAt: -1 })
      .lean();

    const normalizedRequests = requests.map((r) => ({
      ...r,
      reviewNotes: r.reviewNotes || r.adminRemarks || '',
    }));

    return res.json({
      ok: true,
      requests: normalizedRequests,
      latestRequest: normalizedRequests[0] || null,
      hasPendingRequest: normalizedRequests.some((r) => r.status === 'PENDING'),
    });
  } catch (err) {
    console.error('get deletion requests error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get notification counts (lightweight endpoint for badges) - must come before /:id/notifications
router.get('/:id/notifications/count', async (req, res) => {
  try {
    const Notification = (await import('../models/Notification.js')).default;
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    const id = req.params.id;

    if (!id) return res.status(400).json({ error: 'Missing patient id' });

    // Count unread upgrade requests
    const upgradeRequestsCount = await Notification.countDocuments({
      recipient: id,
      recipientModel: 'Patient',
      type: 'ACCESS_UPGRADE_REQUEST',
      isRead: false
    });

    // Count pending access requests
    const pendingAccessCount = await HospitalAccess.countDocuments({
      patient: id,
      status: 'PENDING'
    });

    return res.json({
      ok: true,
      counts: {
        upgradeRequests: upgradeRequestsCount,
        pendingAccess: pendingAccessCount,
        total: upgradeRequestsCount + pendingAccessCount
      }
    });
  } catch (err) {
    console.error('notification count error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Get notifications for a patient
router.get('/:id/notifications', async (req, res) => {
  try {
    const Notification = (await import('../models/Notification.js')).default;
    // Ensure sender models are registered for populate('sender') with refPath senderModel
    await Promise.all([
      import('../models/Hospital.js'),
      import('../models/Patient.js'),
      import('../models/Superadmin.js'),
    ]);
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Missing patient id' });
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '10', 10)));
    const filter = req.query.filter || 'all'; // 'all' or 'unread'
    const searchQuery = (req.query.search || '').toString();

    const query = { recipient: id, recipientModel: 'Patient' };
    if (filter === 'unread') {
      query.isRead = false;
    }
    if (searchQuery) {
      query.$or = [
        { title: { $regex: escapeRegex(searchQuery), $options: 'i' } },
        { message: { $regex: escapeRegex(searchQuery), $options: 'i' } },
      ];
    }

    const totalCount = await Notification.countDocuments({
      recipient: id,
      recipientModel: 'Patient',
      ...(searchQuery ? { $or: query.$or } : {}),
    });
    const unreadCount = await Notification.countDocuments({
      recipient: id,
      recipientModel: 'Patient',
      isRead: false,
      ...(searchQuery ? { $or: query.$or } : {}),
    });

    const total = await Notification.countDocuments(query);
    
    const notifications = await Notification.find(query)
      .populate('sender', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

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
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
        page,
        limit,
      },
      totalCount,
      unreadCount,
    });
  } catch (err) {
    console.error('fetch notifications error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Handle upgrade request decision (approve/deny complete access request)
router.post('/:id/notifications/:notificationId/upgrade-decision', async (req, res) => {
  try {
    const Notification = (await import('../models/Notification.js')).default;
    const HospitalAccess = (await import('../models/HospitalAccess.js')).default;
    const Patient = (await import('../models/Patient.js')).default;
    const Hospital = (await import('../models/Hospital.js')).default;
    const id = req.params.id;
    const notificationId = req.params.notificationId;
    const { decision } = req.body; // 'APPROVE' or 'DENY'

    if (!id || !notificationId) return res.status(400).json({ error: 'Missing patient id or notification id' });
    if (!decision || !['APPROVE', 'DENY'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision. Must be APPROVE or DENY' });
    }

    const notification = await Notification.findOne({ _id: notificationId, recipient: id, recipientModel: 'Patient' });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });

    if (notification.type !== 'ACCESS_UPGRADE_REQUEST') {
      return res.status(400).json({ error: 'This notification is not an upgrade request' });
    }

    if (!notification.relatedAccess) {
      return res.status(400).json({ error: 'No related access found for this notification' });
    }

    const access = await HospitalAccess.findById(notification.relatedAccess);
    if (!access) return res.status(404).json({ error: 'Access record not found' });

    // Get patient and hospital details for audit logging and notifications
    const patient = await Patient.findById(id);
    const hospital = await Hospital.findById(access.hospital);
    const previousAccessLevel = access.accessLevel;

    if (decision === 'APPROVE') {
      access.accessLevel = 'COMPLETE';
      await access.save();
      notification.isRead = true;
      notification.readAt = new Date();
      notification.metadata = {
        ...notification.metadata,
        decision: 'APPROVED',
        decisionTimestamp: new Date()
      };
      await notification.save();

      // Add immutable patient-side history event instead of only mutating request notification
      await Notification.create({
        type: 'GENERAL',
        recipient: id,
        recipientModel: 'Patient',
        sender: id,
        senderModel: 'Patient',
        title: 'Upgrade Request Approved',
        message: `You approved complete access for ${hospital?.name || 'hospital'}.`,
        relatedAccess: access._id,
        metadata: {
          decision: 'APPROVED',
          hospitalId: hospital?._id,
          hospitalName: hospital?.name,
          previousAccessLevel,
          newAccessLevel: 'COMPLETE',
          timestamp: new Date(),
        }
      });

      // Create audit log for upgrade approval
      await logAccessApproval({
        patientId: id,
        patientName: `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Unknown Patient',
        patientEmail: patient?.email,
        hospitalId: access.hospital,
        hospitalName: hospital?.name || 'Unknown Hospital',
        accessLevel: 'COMPLETE',
        previousAccessLevel,
        accessId: access._id,
        req
      });

      // Send notification to hospital about upgrade approval
      await Notification.create({
        type: 'ACCESS_GRANTED',
        recipient: access.hospital,
        recipientModel: 'Hospital',
        sender: id,
        senderModel: 'Patient',
        title: 'Complete Access Granted',
        message: `${patient?.firstName || 'Patient'} has upgraded your access to COMPLETE access.`,
        relatedAccess: access._id,
        metadata: {
          decision: 'APPROVED',
          accessLevel: 'COMPLETE',
          previousAccessLevel,
          upgradeRequest: true,
          timestamp: new Date()
        }
      });

      return res.json({ ok: true, message: 'Complete access granted', access });
    } else {
      notification.isRead = true;
      notification.readAt = new Date();
      notification.metadata = {
        ...notification.metadata,
        decision: 'DENIED',
        decisionTimestamp: new Date()
      };
      await notification.save();

      // Add immutable patient-side history event instead of only mutating request notification
      await Notification.create({
        type: 'GENERAL',
        recipient: id,
        recipientModel: 'Patient',
        sender: id,
        senderModel: 'Patient',
        title: 'Upgrade Request Denied',
        message: `You denied complete access upgrade for ${hospital?.name || 'hospital'}.`,
        relatedAccess: access._id,
        metadata: {
          decision: 'DENIED',
          hospitalId: hospital?._id,
          hospitalName: hospital?.name,
          previousAccessLevel,
          timestamp: new Date(),
        }
      });

      // Create audit log for upgrade denial
      await logAccessDenial({
        patientId: id,
        patientName: `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim() || 'Unknown Patient',
        patientEmail: patient?.email,
        hospitalId: access.hospital,
        hospitalName: hospital?.name || 'Unknown Hospital',
        accessId: access._id,
        req
      });

      // Send notification to hospital about upgrade denial
      await Notification.create({
        type: 'ACCESS_REVOKED',
        recipient: access.hospital,
        recipientModel: 'Hospital',
        sender: id,
        senderModel: 'Patient',
        title: 'Complete Access Request Denied',
        message: `${patient?.firstName || 'Patient'} has denied your request for COMPLETE access.`,
        relatedAccess: access._id,
        metadata: {
          decision: 'DENIED',
          requestedAccessLevel: 'COMPLETE',
          currentAccessLevel: previousAccessLevel,
          upgradeRequest: true,
          timestamp: new Date()
        }
      });

      return res.json({ ok: true, message: 'Complete access request denied' });
    }
  } catch (err) {
    console.error('upgrade decision error:', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
});

// Mark notification as read
// Mark every notification read in one request
router.patch('/:id/notifications/read-all', (req, res) => markAllRead(req, res, 'Patient'));

router.patch('/:id/notifications/:notificationId/read', async (req, res) => {
  try {
    const Notification = (await import('../models/Notification.js')).default;
    const id = req.params.id;
    const notificationId = req.params.notificationId;

    if (!id || !notificationId) return res.status(400).json({ error: 'Missing patient id or notification id' });

    const notification = await Notification.findOne({ _id: notificationId, recipient: id, recipientModel: 'Patient' });
    if (!notification) return res.status(404).json({ error: 'Notification not found' });

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
