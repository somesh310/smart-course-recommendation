import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  category: { type: String, required: true, trim: true, maxlength: 80, index: true },
  level: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], required: true },
  duration: { type: Number, required: true, min: 0 },
  durationUnit: { type: String, enum: ['hours', 'days', 'weeks', 'months', 'self-paced'], required: true },
  priceType: { type: String, enum: ['Free', 'Paid'], required: true },
  price: { type: Number, min: 0, default: 0 },
  currency: { type: String, uppercase: true, default: 'USD', minlength: 3, maxlength: 3 },
  skills: { type: [String], default: [] },
  prerequisites: { type: [String], default: [] },
  learningOutcomes: { type: [String], default: [] },
  provider: { type: String, required: true, trim: true, maxlength: 120 },
  externalUrl: { type: String, trim: true, default: '' },
  image: { type: String, trim: true, default: '' },
  published: { type: Boolean, default: true, index: true },
}, { timestamps: true });

courseSchema.index({ title: 'text', description: 'text', category: 'text', skills: 'text' });
courseSchema.index({ category: 1, level: 1, priceType: 1, published: 1 });
export default mongoose.model('Course', courseSchema);
