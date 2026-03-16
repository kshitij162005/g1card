import mongoose from 'mongoose';

const DeletionRequestSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true,
    },
    requestType: {
      type: String,
      enum: ['DATA_DELETION', 'ACCOUNT_DELETION'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    reason: { type: String, default: '' },
    requestedByEmail: { type: String, default: '' },
    reviewNotes: { type: String, default: '' },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Superadmin',
      default: null,
    },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

DeletionRequestSchema.index({ patient: 1, requestType: 1, status: 1 });

export default mongoose.model('DeletionRequest', DeletionRequestSchema);
