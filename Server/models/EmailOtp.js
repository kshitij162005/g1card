import mongoose from 'mongoose';

const EmailOtpSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    purpose: {
      type: String,
      required: true,
      enum: ['SIGNUP_PATIENT', 'SIGNUP_HOSPITAL', 'CHANGE_PASSWORD_PATIENT'],
      index: true,
    },
    otpHash: { type: String, required: true },
    salt: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    attempts: { type: Number, default: 0 },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

EmailOtpSchema.index({ email: 1, purpose: 1, createdAt: -1 });

export default mongoose.model('EmailOtp', EmailOtpSchema);
