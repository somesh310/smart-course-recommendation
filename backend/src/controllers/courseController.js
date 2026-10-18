import Course from '../models/Course.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const listCourses = asyncHandler(async (req, res) => {
  const { page, limit, search, category, level, duration, sort } = req.validatedQuery || req.query;
  const filter = { published: true, priceType: 'Free' };
  if (category) filter.category = category;
  if (level) filter.level = level;
  if (duration === 'short') filter.durationUnit = { $in: ['hours', 'days'] };
  if (duration === 'long') filter.durationUnit = { $in: ['weeks', 'months'] };
  if (search) { const regex = new RegExp(escapeRegex(search), 'i'); filter.$or = [{ title: regex }, { description: regex }, { category: regex }, { skills: regex }]; }
  const [items, total] = await Promise.all([
    Course.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
    Course.countDocuments(filter),
  ]);
  res.json({ success: true, message: 'Courses retrieved successfully.', data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});
export const getCourse = asyncHandler(async (req, res) => {
  const identifier = req.params.id;
  const selector = /^[a-f\d]{24}$/i.test(identifier) ? { _id: identifier } : { slug: identifier.toLowerCase() };
  const course = await Course.findOne({ ...selector, published: true, priceType: 'Free' }).lean();
  if (!course) throw new ApiError(404, 'Course not found.');
  res.json({ success: true, message: 'Course retrieved successfully.', data: course });
});
export const createCourse = asyncHandler(async (req, res) => {
  const course = await Course.create(req.body);
  res.status(201).json({ success: true, message: 'Course created successfully.', data: course });
});
export const updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
  if (!course) throw new ApiError(404, 'Course not found.');
  res.json({ success: true, message: 'Course updated successfully.', data: course });
});
export const deleteCourse = asyncHandler(async (req, res) => {
  const course = await Course.findByIdAndDelete(req.params.id);
  if (!course) throw new ApiError(404, 'Course not found.');
  res.json({ success: true, message: 'Course deleted successfully.', data: course });
});
