import mongoose from 'mongoose';

const videoProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningResource', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
  watchedRanges: { type: [[Number]], default: [] },
  lastPositionSeconds: { type: Number, min: 0, default: 0 },
  lastHeartbeatAt: { type: Date, default: null },
  status: { type: String, enum: ['not_started', 'in_progress', 'completed'], default: 'not_started' },
  completedAt: { type: Date, default: null },
}, { timestamps: true });
videoProgressSchema.index({ userId: 1, resourceId: 1 }, { unique: true });
videoProgressSchema.index({ userId: 1, courseId: 1, updatedAt: -1 });
export default mongoose.model('VideoProgress', videoProgressSchema);
