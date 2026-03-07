import AuditLog from '../models/AuditLog.js';

/**
 * Create a HIPAA-compliant audit log entry
 * @param {Object} params - Audit log parameters
 * @returns {Promise<Object>} Created audit log
 */
export async function createAuditLog({
  event,
  actor,
  target = null,
  action,
  changes = null,
  relatedResources = [],
  compliance = {},
  metadata = {},
  severity = 'INFO',
  req = null // Express request object for IP/UserAgent
}) {
  try {
    const logEntry = {
      event,
      actor: {
        id: actor.id,
        model: actor.model,
        name: actor.name,
        email: actor.email,
        ipAddress: req ? (req.ip || req.connection?.remoteAddress) : actor.ipAddress,
        userAgent: req ? req.get('user-agent') : actor.userAgent
      },
      action,
      severity,
      metadata
    };

    // Add target if provided
    if (target) {
      logEntry.target = {
        id: target.id,
        model: target.model,
        name: target.name,
        identifier: target.identifier
      };
    }

    // Add changes if provided
    if (changes) {
      logEntry.changes = changes;
    }

    // Add related resources
    if (relatedResources.length > 0) {
      logEntry.relatedResources = relatedResources;
    }

    // Add compliance info
    if (Object.keys(compliance).length > 0) {
      logEntry.compliance = compliance;
    }

    const auditLog = await AuditLog.create(logEntry);
    return auditLog;
  } catch (error) {
    // Critical: audit logging failure should be logged separately
    console.error('CRITICAL: Failed to create audit log:', error);
    // Don't throw - we don't want audit logging to break the main flow
    return null;
  }
}

/**
 * Log access request approval
 */
export async function logAccessApproval({
  patientId,
  patientName,
  patientEmail,
  hospitalId,
  hospitalName,
  accessLevel,
  previousAccessLevel,
  accessId,
  req
}) {
  return createAuditLog({
    event: previousAccessLevel ? 'ACCESS_REQUEST_UPGRADED' : 'ACCESS_REQUEST_APPROVED',
    actor: {
      id: patientId,
      model: 'Patient',
      name: patientName,
      email: patientEmail
    },
    target: {
      id: hospitalId,
      model: 'Hospital',
      name: hospitalName
    },
    action: {
      description: previousAccessLevel 
        ? `Patient upgraded hospital access from ${previousAccessLevel} to ${accessLevel}`
        : `Patient approved hospital access request with ${accessLevel} access level`,
      outcome: 'SUCCESS',
      reason: 'Patient consent granted'
    },
    changes: {
      before: { accessLevel: previousAccessLevel || null, status: 'PENDING' },
      after: { accessLevel, status: 'APPROVED' }
    },
    compliance: {
      hipaaJustification: 'Patient authorized access to PHI',
      consentBased: true,
      consentId: accessId
    },
    metadata: {
      accessLevel,
      previousAccessLevel: previousAccessLevel || null
    },
    severity: 'INFO',
    req
  });
}

/**
 * Log access request denial
 */
export async function logAccessDenial({
  patientId,
  patientName,
  patientEmail,
  hospitalId,
  hospitalName,
  accessId,
  req
}) {
  return createAuditLog({
    event: 'ACCESS_REQUEST_DENIED',
    actor: {
      id: patientId,
      model: 'Patient',
      name: patientName,
      email: patientEmail
    },
    target: {
      id: hospitalId,
      model: 'Hospital',
      name: hospitalName
    },
    action: {
      description: `Patient denied hospital access request`,
      outcome: 'SUCCESS',
      reason: 'Patient declined to grant access',
      denialReason: 'Patient exercised right to deny consent'
    },
    changes: {
      before: { status: 'PENDING' },
      after: { status: 'DENIED' }
    },
    compliance: {
      hipaaJustification: 'Patient right to control PHI access',
      consentBased: false
    },
    metadata: {
      accessId: accessId.toString()
    },
    severity: 'INFO',
    req
  });
}

/**
 * Log hospital access request creation
 */
export async function logAccessRequestCreation({
  hospitalId,
  hospitalName,
  patientId,
  patientName,
  accessId,
  req
}) {
  return createAuditLog({
    event: 'ACCESS_REQUEST_CREATED',
    actor: {
      id: hospitalId,
      model: 'Hospital',
      name: hospitalName
    },
    target: {
      id: patientId,
      model: 'Patient',
      name: patientName
    },
    action: {
      description: `Hospital requested access to patient medical records`,
      outcome: 'SUCCESS',
      reason: 'Clinical consultation/treatment requirement'
    },
    compliance: {
      hipaaJustification: 'Treatment, Payment, or Healthcare Operations',
      consentBased: false
    },
    metadata: {
      accessId: accessId.toString(),
      requestStatus: 'PENDING'
    },
    severity: 'INFO',
    req
  });
}

/**
 * Log PHI access by hospital
 */
export async function logPHIAccess({
  hospitalId,
  hospitalName,
  patientId,
  patientName,
  recordId,
  recordType,
  accessLevel,
  consentId,
  req
}) {
  return createAuditLog({
    event: 'PHI_ACCESSED',
    actor: {
      id: hospitalId,
      model: 'Hospital',
      name: hospitalName
    },
    target: {
      id: patientId,
      model: 'Patient',
      name: patientName
    },
    action: {
      description: `Hospital accessed patient medical record`,
      outcome: 'SUCCESS',
      reason: 'Authorized access per patient consent'
    },
    relatedResources: recordId ? [{
      resourceId: recordId,
      resourceType: 'Record',
      resourceName: recordType || 'Medical Record'
    }] : [],
    compliance: {
      hipaaJustification: 'Treatment with patient consent',
      consentBased: true,
      consentId
    },
    metadata: {
      accessLevel,
      recordId: recordId?.toString()
    },
    severity: 'INFO',
    req
  });
}

/**
 * Log medical record creation by hospital
 */
export async function logRecordCreation({
  hospitalId,
  hospitalName,
  patientId,
  patientName,
  recordId,
  formName,
  consentId,
  req
}) {
  return createAuditLog({
    event: 'RECORD_CREATED',
    actor: {
      id: hospitalId,
      model: 'Hospital',
      name: hospitalName
    },
    target: {
      id: recordId,
      model: 'Record',
      name: formName
    },
    action: {
      description: `Hospital created new medical record for patient`,
      outcome: 'SUCCESS',
      reason: 'Medical documentation'
    },
    relatedResources: [{
      resourceId: patientId,
      resourceType: 'Patient',
      resourceName: patientName
    }],
    compliance: {
      hipaaJustification: 'Treatment documentation',
      consentBased: true,
      consentId
    },
    metadata: {
      formName,
      recordId: recordId.toString()
    },
    severity: 'INFO',
    req
  });
}

/**
 * Log access revocation
 */
export async function logAccessRevocation({
  actorId,
  actorModel,
  actorName,
  hospitalId,
  hospitalName,
  patientId,
  patientName,
  accessId,
  reason,
  req
}) {
  return createAuditLog({
    event: 'ACCESS_REVOKED',
    actor: {
      id: actorId,
      model: actorModel,
      name: actorName
    },
    target: {
      id: accessId,
      model: 'HospitalAccess'
    },
    action: {
      description: `Access revoked between hospital and patient`,
      outcome: 'SUCCESS',
      reason: reason || 'Access no longer needed'
    },
    changes: {
      before: { status: 'APPROVED' },
      after: { status: 'REVOKED' }
    },
    relatedResources: [
      {
        resourceId: hospitalId,
        resourceType: 'Hospital',
        resourceName: hospitalName
      },
      {
        resourceId: patientId,
        resourceType: 'Patient',
        resourceName: patientName
      }
    ],
    compliance: {
      hipaaJustification: 'Access control management',
      consentBased: false
    },
    severity: 'WARNING',
    req
  });
}

export default {
  createAuditLog,
  logAccessApproval,
  logAccessDenial,
  logAccessRequestCreation,
  logPHIAccess,
  logRecordCreation,
  logAccessRevocation
};
