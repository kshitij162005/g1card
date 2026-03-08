import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  sender: { type: String, required: true, enum: ['HOSPITAL', 'ADMIN'] },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const HospitalUpdateRequestSchema = new mongoose.Schema(
  {
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    requestedChanges: {
      // Store only the fields that are being changed
      name: String,
      username: String,
      regNumber: String,
      license: String,
      address: String,
      city: String,
      state: String,
      pin: String,
      contactEmail: String,
      phone: String,
      website: String,
      adminName: String,
      adminEmail: String,
      adminPhone: String,
      designation: String
    },
    originalData: {
      // Store original values for comparison
      name: String,
      username: String,
      regNumber: String,
      license: String,
      address: String,
      city: String,
      state: String,
      pin: String,
      contactEmail: String,
      phone: String,
      website: String,
      adminName: String,
      adminEmail: String,
      adminPhone: String,
      designation: String
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED'],
      default: 'PENDING'
    },
    adminRemarks: String, // Admin's comments when rejecting or requesting changes
    conversation: [MessageSchema], // Ticketing system messages
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Superadmin' },
    reviewedAt: Date,
    submittedAt: { type: Date, default: Date.now },
    resubmittedAt: Date // Track when hospital resubmits after changes requested
  },
  { timestamps: true }
);

// Add index for efficient queries
HospitalUpdateRequestSchema.index({ hospital: 1, status: 1 });
HospitalUpdateRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('HospitalUpdateRequest', HospitalUpdateRequestSchema);
