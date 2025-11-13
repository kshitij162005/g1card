import mongoose from 'mongoose';

const StaffSchema = new mongoose.Schema(
  {
    staffId: { type: String, unique: true },
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String },
    phone: { type: String },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  { timestamps: true }
);

export default mongoose.model('Staff', StaffSchema);
