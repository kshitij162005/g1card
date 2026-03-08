import express from 'express';
import mongoose from 'mongoose';
import { logAccessApproval, logAccessDenial } from '../utils/auditLogger.js';
import { sendEventToUser } from './sse.js';

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
        { title: { $regex: searchQuery, $options: 'i' } },
        { message: { $regex: searchQuery, $options: 'i' } },
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
