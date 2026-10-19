import mongoose from 'mongoose';

const PatientSchema = new mongoose.Schema(
  {
  username: { type: String, required: true, unique: true },
  // password is optional for hospital-created patients (they may not have user credentials)
  password: { type: String },
    salt: { type: String },
    // unique patient identifier for hospital records (e.g., P1636567890123)
    patientId: { type: String, unique: true, sparse: true },
    // reference to Hospitals this patient is linked to with timestamp of when they were added
    hospitalLinks: [{
      hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
      linkedAt: { type: Date, default: Date.now }
    }],
    // Legacy: simple array of hospital IDs (for backward compatibility)
    hospitals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' }],
    // Keep legacy 'hospital' field for backward compatibility (will be migrated to hospitals array)
    hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: false },
    name: { type: String },
    firstName: { type: String },
    lastName: { type: String },
    dob: { type: String },
    gender: { type: String },
    phone: { type: String },
    address: { type: String },
    email: { type: String },
    emailVerified: { type: Boolean, default: false },
    accountDeleted: { type: Boolean, default: false },
    // Set by a G1Card admin; a suspended patient cannot use the portal and is hidden from Golu by default
    suspended: { type: Boolean, default: false, index: true },
    suspendedAt: { type: Date },
    suspendedReason: { type: String, default: '' },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Superadmin' },
    notificationPreferences: {
      emailWhenHospitalAccessRecords: { type: Boolean, default: true },
      emailForNewPrescriptions: { type: Boolean, default: true },
      emailForConsultationReminders: { type: Boolean, default: true },
    },
    emergencyContactName: { type: String },
    emergencyContactPhone: { type: String },
    allergies: { type: Array },
    conditions: { type: Array },
    surgeries: { type: Array },
    medications: { type: Array },
    familyHistory: { type: String },
    smoking: { type: String },
    // Health summary fields
    bloodGroup: { type: String },
    age: { type: Number },
    height: { type: String },
    weight: { type: Number },
    bmi: { type: Number },
    // track last access/login time
    lastAccess: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('Patient', PatientSchema);
