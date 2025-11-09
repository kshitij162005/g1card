import mongoose from 'mongoose';

const SuperadminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'superadmin' },
  },
  { timestamps: true }
);

export default mongoose.model('Superadmin', SuperadminSchema);
