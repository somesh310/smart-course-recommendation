import mongoose from 'mongoose';

const enrollmentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress', required: true },
  progress: { type: Number, min: 0, max: 100, default: 0, required: true },
  studyMinutes: { type: Number, min: 0, default: 0, required: true },
  enrolledAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });
enrollmentSchema.index({ userId: 1, status: 1, updatedAt: -1 });
export default mongoose.model('Enrollment', enrollmentSchema);
