import mongoose from 'mongoose';

const HospitalSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    salt: { type: String },
    regNumber: { type: String },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pin: { type: String },
    license: { type: String },
    contactEmail: { type: String },
    phone: { type: String },
    website: { type: String },
    adminName: { type: String },
    adminEmail: { type: String },
    adminPhone: { type: String },
    designation: { type: String },
    emailVerified: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    // status reflects review/approval lifecycle. 'approved' for existing behavior.
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'approved' },
    // optional field to capture rejection reason provided by superadmin
    rejectionReason: { type: String },
    // track last login time
    lastAccess: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('Hospital', HospitalSchema);
