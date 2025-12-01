import mongoose from 'mongoose';

const FieldSchema = new mongoose.Schema({
  id: { type: String }, // client-side id/key
  label: { type: String, required: true },
  key: { type: String, required: true },
  type: { type: String, required: true }, // text, textarea, number, date, select, file
  required: { type: Boolean, default: false },
  options: { type: Array, default: [] }, // for select
  multiSelect: { type: Boolean, default: false }, // for select - allow multiple selections
});

const FormTemplateSchema = new mongoose.Schema(
  {
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    name: { type: String, required: true },
    description: { type: String },
    fields: { type: [FieldSchema], default: [] },
    createdBy: { type: String }, // staff id or user id who created
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('FormTemplate', FormTemplateSchema);
