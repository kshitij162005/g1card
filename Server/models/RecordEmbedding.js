import mongoose from 'mongoose';

const RecordEmbeddingSchema = new mongoose.Schema(
  {
    recordId: { type: mongoose.Schema.Types.ObjectId, ref: 'Record', required: true, unique: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
    hospitalName: { type: String },
    formName: { type: String },
    admissionDate: { type: String },
    patientName: { type: String },
    patientEmail: { type: String },
    patientAge: { type: Number },
    patientGender: { type: String },
    patientConditions: { type: [String], default: [] },
    patientMedications: { type: [String], default: [] },
    notes: { type: String },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
  },
  { timestamps: true }
);

RecordEmbeddingSchema.index({ recordId: 1 }, { unique: true });

export default mongoose.model('RecordEmbedding', RecordEmbeddingSchema);
