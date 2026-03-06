import mongoose from 'mongoose';

// Tracks consent-based access from a Hospital to a Patient
// status: PENDING -> APPROVED / DENIED
// accessLevel: 'GENERAL' | 'COMPLETE' (only set when APPROVED)
const HospitalAccessSchema = new mongoose.Schema(
  {
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'DENIED'],
      default: 'PENDING',
    },
    accessLevel: {
      type: String,
      enum: ['GENERAL', 'COMPLETE', null],
      default: null,
    },
  },
  { timestamps: true }
);

HospitalAccessSchema.index({ hospital: 1, patient: 1 }, { unique: true });

export default mongoose.model('HospitalAccess', HospitalAccessSchema);

