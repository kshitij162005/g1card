import mongoose from 'mongoose';

// Small key/value store for system-wide state (e.g. when records were last indexed for Golu)
const SystemStateSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model('SystemState', SystemStateSchema);
