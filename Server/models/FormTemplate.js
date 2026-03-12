import mongoose from 'mongoose';

const FieldSchema = new mongoose.Schema({
  id: { type: String }, // client-side id/key
  label: { type: String, required: true },
  key: { type: String, required: true },
  type: { type: String, required: true }, // text, textarea, number, date, time, select, radio, checkbox, file, email, tel, section, pageBreak
  required: { type: Boolean, default: false },
  description: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  options: { type: Array, default: [] }, // for select/radio/checkbox
  multiSelect: { type: Boolean, default: false }, // legacy alias for select
  allowMultiple: { type: Boolean, default: false }, // select/file/checkbox multi-value support
  defaultValue: { type: mongoose.Schema.Types.Mixed, default: '' },
  fileSettings: {
    allowedTypes: { type: [String], default: [] },
    maxFileSizeMB: { type: Number, default: 10 },
    maxFiles: { type: Number, default: 1 },
  },
  validation: {
    min: { type: String, default: '' },
    max: { type: String, default: '' },
    minLength: { type: Number },
    maxLength: { type: Number },
    pattern: { type: String, default: '' },
    customError: { type: String, default: '' },
  },
});

const FormTemplateSchema = new mongoose.Schema(
  {
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    name: { type: String, required: true },
    description: { type: String },
    fields: { type: [FieldSchema], default: [] },
    theme: {
      primaryColor: { type: String, default: '#6366f1' },
      backgroundColor: { type: String, default: '#0f172a' },
      cardColor: { type: String, default: '#1e293b' },
      fontFamily: { type: String, default: 'Sora' },
    },
    submissionSettings: {
      successMessage: { type: String, default: 'Thanks! Your response has been recorded.' },
      redirectUrl: { type: String, default: '' },
      sendEmailNotification: { type: Boolean, default: false },
    },
    createdBy: { type: String }, // staff id or user id who created
    active: { type: Boolean, default: true },
    hasBeenPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('FormTemplate', FormTemplateSchema);
