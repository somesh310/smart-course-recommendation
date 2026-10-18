import mongoose from 'mongoose';

const pendingRegistrationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  otpHash: { type: String, required: true, select: false },
  attempts: { type: Number, default: 0, min: 0, max: 5 },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { timestamps: true });

export default mongoose.model('PendingRegistration', pendingRegistrationSchema);
