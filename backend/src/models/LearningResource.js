import mongoose from 'mongoose';

const learningResourceSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  subject: { type: String, required: true, trim: true, maxlength: 100, index: true },
  courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null, index: true },
  courseTitle: { type: String, trim: true, maxlength: 180, default: '' },
  skills: { type: [String], default: [] },
  difficulty: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
  careerGoal: { type: String, trim: true, maxlength: 160, default: '' },
  kind: { type: String, enum: ['video', 'playlist'], required: true },
  youtubeUrl: { type: String, required: true, trim: true, maxlength: 2048 },
  youtubeId: { type: String, required: true, trim: true, index: true },
  channelName: { type: String, trim: true, maxlength: 160, default: '' },
  durationSeconds: { type: Number, min: 1, default: null },
  order: { type: Number, min: 0, default: 0 },
  active: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
learningResourceSchema.index({ courseId: 1, order: 1, active: 1 });
learningResourceSchema.index({ subject: 1, active: 1, difficulty: 1 });
export default mongoose.model('LearningResource', learningResourceSchema);
