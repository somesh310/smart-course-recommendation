import mongoose from 'mongoose';

const learningRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  courseName: { type: String, required: true, trim: true, maxlength: 180 },
  skill: { type: String, trim: true, maxlength: 120, default: '' },
  message: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['pending', 'resolved', 'declined'], default: 'pending', index: true },
  adminNote: { type: String, trim: true, maxlength: 1000, default: '' },
  resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningResource', default: null },
  resolvedAt: { type: Date, default: null },
  readAt: { type: Date, default: null },
}, { timestamps: true });
learningRequestSchema.index({ userId: 1, courseName: 1, status: 1 });
learningRequestSchema.index({ userId: 1, status: 1, readAt: 1, updatedAt: -1 });
export default mongoose.model('LearningRequest', learningRequestSchema);
