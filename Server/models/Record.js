import mongoose from 'mongoose';

const RecordSchema = new mongoose.Schema(
  {
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    form: { type: mongoose.Schema.Types.ObjectId, ref: 'FormTemplate' },
    data: { type: Object, default: {} }, // key -> value map, files represented as metadata
    attachments: { type: Array, default: [] },
    createdBy: { type: String }, // staff id or hospital user
  },
  { timestamps: true }
);

export default mongoose.model('Record', RecordSchema);
