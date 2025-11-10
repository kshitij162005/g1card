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
  },
  { timestamps: true }
);

export default mongoose.model('Hospital', HospitalSchema);
