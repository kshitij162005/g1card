import mongoose from 'mongoose';

const PatientSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String },
    email: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model('Patient', PatientSchema);
