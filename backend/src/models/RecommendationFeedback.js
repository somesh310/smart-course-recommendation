import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  action: { type: String, enum: ['helpful', 'not_helpful', 'dismissed'], required: true },
  comment: { type: String, trim: true, maxlength: 1000, default: '' },
}, { timestamps: true });
feedbackSchema.index({ userId: 1, createdAt: -1 });
export default mongoose.model('RecommendationFeedback', feedbackSchema);
