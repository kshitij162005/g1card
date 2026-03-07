import mongoose from 'mongoose';

/**
 * HIPAA-Compliant Audit Log Model
 * Tracks all access and modifications to PHI (Protected Health Information)
 * 
 * HIPAA Requirements Covered:
 * - §164.312(b) - Audit controls to record and examine access and activity
 * - §164.308(a)(1)(ii)(D) - Information system activity review
 * - §164.308(a)(5)(ii)(C) - Log-in monitoring
 */
const AuditLogSchema = new mongoose.Schema(
  {
    // Event Information
    event: {
      type: String,
      required: true,
      enum: [
        // Access Control Events
        'ACCESS_REQUEST_CREATED',
        'ACCESS_REQUEST_APPROVED',
        'ACCESS_REQUEST_DENIED',
        'ACCESS_REQUEST_UPGRADED',
        'ACCESS_REVOKED',
        
        // Data Access Events
        'PHI_ACCESSED',
        'PHI_VIEWED',
        'PHI_DOWNLOADED',
        'PHI_EXPORTED',
        
        // Data Modification Events
        'RECORD_CREATED',
        'RECORD_UPDATED',
        'RECORD_DELETED',
        
        // Authentication Events
        'LOGIN_SUCCESS',
        'LOGIN_FAILED',
        'LOGOUT',
        'PASSWORD_CHANGED',
        'PASSWORD_RESET',
        
        // System Events
        'CONSENT_GRANTED',
        'CONSENT_WITHDRAWN',
        'NOTIFICATION_SENT',
        'NOTIFICATION_READ'
      ]
    },
    
    // Actor (Who performed the action)
    actor: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'actorModel'
      },
      model: {
        type: String,
        required: true,
        enum: ['Patient', 'Hospital', 'Staff', 'Superadmin']
      },
      name: String,
      email: String,
      ipAddress: String,
      userAgent: String
    },
    
    // Target (What was affected)
    target: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'targetModel'
      },
      model: {
        type: String,
        enum: ['Patient', 'Hospital', 'Record', 'HospitalAccess', 'FormTemplate', 'Staff']
      },
      name: String,
      identifier: String // e.g., patient MRN, hospital name
    },
    
    // Action Details
    action: {
      description: {
        type: String,
        required: true
      },
      outcome: {
        type: String,
        enum: ['SUCCESS', 'FAILURE', 'PARTIAL'],
        required: true
      },
      reason: String, // Why action was taken (e.g., "Clinical consultation")
      denialReason: String // If denied/failed, why
    },
    
    // Before/After State (for modifications)
    changes: {
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed
    },
    
    // Related Resources
    relatedResources: [{
      resourceId: mongoose.Schema.Types.ObjectId,
      resourceType: String,
      resourceName: String
    }],
    
    // Compliance & Context
    compliance: {
      hipaaJustification: String, // Treatment, Payment, Operations, etc.
      consentBased: {
        type: Boolean,
        default: false
      },
      consentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HospitalAccess'
      }
    },
    
    // Technical Metadata
    metadata: {
      sessionId: String,
      requestId: String,
      duration: Number, // milliseconds
      dataAccessed: Number, // bytes or record count
      accessLevel: String // 'GENERAL', 'COMPLETE'
    },
    
    // Severity for monitoring
    severity: {
      type: String,
      enum: ['INFO', 'WARNING', 'CRITICAL'],
      default: 'INFO'
    },
    
    // Immutability flag - once created, should never be modified
    immutable: {
      type: Boolean,
      default: true
    }
  },
  { 
    timestamps: true,
    // Disable updates to ensure immutability
    strict: true
  }
);

// Indexes for efficient querying
AuditLogSchema.index({ 'actor.id': 1, createdAt: -1 });
AuditLogSchema.index({ 'target.id': 1, createdAt: -1 });
AuditLogSchema.index({ event: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ 'compliance.consentId': 1 });

// Prevent updates (immutability)
AuditLogSchema.pre('save', function(next) {
  if (!this.isNew) {
    return next(new Error('Audit logs are immutable and cannot be modified'));
  }
  next();
});

// Prevent deletion
AuditLogSchema.pre('remove', function(next) {
  return next(new Error('Audit logs cannot be deleted'));
});

export default mongoose.model('AuditLog', AuditLogSchema);
