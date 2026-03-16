import express from 'express';

const router = express.Router();

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

// List pending hospital registration requests (for approval)
router.get('/hospitals/pending', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const { search = '', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { status: 'pending' };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { contactEmail: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { state: { $regex: search, $options: 'i' } },
        { regNumber: { $regex: search, $options: 'i' } },
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
    const id = req.params.id;
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    hospital.status = 'approved';
    hospital.active = true;
    await hospital.save();
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
    const id = req.params.id;
    const { reason } = req.body || {};
    const hospital = await Hospital.findById(id);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    hospital.status = 'rejected';
    hospital.active = false;
    // store optional rejection reason in a field (if exists) or audit logs
    hospital.rejectionReason = reason || '';
    await hospital.save();
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
    const { search = '', page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { patientId: { $regex: search, $options: 'i' } },
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

// List all hospitals with search and pagination (must come before /:id route)
router.get('/hospitals', async (req, res) => {
  try {
    const Hospital = (await import('../models/Hospital.js')).default;
    const { search = '', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { state: { $regex: search, $options: 'i' } },
        { contactEmail: { $regex: search, $options: 'i' } },
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
