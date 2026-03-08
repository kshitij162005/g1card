import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'ACCESS_REQUEST',
      'ACCESS_UPGRADE_REQUEST',
      'ACCESS_GRANTED',
      'ACCESS_DENIED',
      'ACCESS_REVOKED',
      'ACCESS_LEVEL_CHANGED',
      'MEDICAL_RECORD_CREATED',
      'RECORDS_ACCESSED',
      'HOSPITAL_UPDATE_REQUEST',
      'HOSPITAL_UPDATE_APPROVED',
      'HOSPITAL_UPDATE_REJECTED',
      'HOSPITAL_UPDATE_CHANGES_REQUESTED',
      'UPDATE_REQUEST_APPROVED',
      'UPDATE_REQUEST_REJECTED',
      'UPDATE_REQUEST_CHANGES_REQUESTED',
      'UPDATE_REQUEST_MESSAGE',
      'GENERAL'
    ]
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'recipientModel',
    required: true
  },
  recipientModel: {
    type: String,
    required: true,
    enum: ['Patient', 'Hospital', 'Superadmin']
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'senderModel'
  },
  senderModel: {
    type: String,
    enum: ['Patient', 'Hospital', 'Superadmin']
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  actionUrl: String,
  relatedAccess: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HospitalAccess'
  }
}, {
  timestamps: true
});

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ isRead: 1, recipient: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
