import mongoose from 'mongoose';

const PatientSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    salt: { type: String },
    name: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    dob: { type: String },
    gender: { type: String },
    phone: { type: String },
    address: { type: String },
    email: { type: String },
    emergencyContactName: { type: String },
    emergencyContactPhone: { type: String },
    allergies: { type: Array },
    conditions: { type: Array },
    surgeries: { type: Array },
    medications: { type: Array },
    familyHistory: { type: String },
    smoking: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model('Patient', PatientSchema);
