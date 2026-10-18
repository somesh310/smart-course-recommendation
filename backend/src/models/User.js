import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  tokenVersion: { type: Number, default: 0, select: false },
  role: { type: String, enum: ['student', 'admin'], default: 'student', required: true },
  emailVerified: { type: Boolean, default: false },
  degree: { type: String, trim: true, maxlength: 100, default: '' },
  branch: { type: String, trim: true, maxlength: 100, default: '' },
  semester: { type: String, trim: true, maxlength: 40, default: '' },
  currentSkills: { type: [String], default: [] },
  experienceLevel: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
  interests: { type: [String], default: [] },
  careerGoal: { type: String, trim: true, maxlength: 160, default: '' },
  weeklyLearningHours: { type: Number, min: 1, max: 80, default: 6 },
  budgetPreference: { type: String, enum: ['Free only', 'Free and paid', 'Paid'], default: 'Free and paid' },
  preferredLearningStyle: { type: String, trim: true, maxlength: 80, default: '' },
}, { timestamps: true, toJSON: { transform: (_doc, ret) => { delete ret.passwordHash; delete ret.tokenVersion; delete ret.__v; return ret; } } });

export default mongoose.model('User', userSchema);
