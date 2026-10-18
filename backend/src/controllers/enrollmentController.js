import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const populated = (query) => query.populate('courseId').lean();
export const listLearning = asyncHandler(async (req, res) => {
  const { page, limit } = req.validatedQuery || req.query;
  const [items, total] = await Promise.all([
    populated(Enrollment.find({ userId: req.user.id }).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit)),
    Enrollment.countDocuments({ userId: req.user.id }),
  ]);
  res.json({ success: true, message: 'Learning records retrieved successfully.', data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

export const enroll = asyncHandler(async (req, res) => {
  const course = await Course.findOne({ _id: req.body.courseId, published: true });
  if (!course) throw new ApiError(404, 'Published course not found.');
  const exists = await Enrollment.exists({ userId: req.user.id, courseId: course.id });
  if (exists) throw new ApiError(409, 'You are already enrolled in this course.');
  const enrollment = await Enrollment.create({ userId: req.user.id, courseId: course.id });
  await enrollment.populate('courseId');
  res.status(201).json({ success: true, message: 'Enrolled successfully.', data: enrollment });
});

export const getLearningItem = asyncHandler(async (req, res) => {
  const item = await populated(Enrollment.findOne({ userId: req.user.id, courseId: req.params.courseId }));
  if (!item) throw new ApiError(404, 'Enrollment not found.');
  res.json({ success: true, message: 'Learning record retrieved successfully.', data: item });
});

export const updateProgress = asyncHandler(async (req, res) => {
  const enrolled = await Enrollment.exists({ userId: req.user.id, courseId: req.params.courseId });
  if (!enrolled) throw new ApiError(404, 'Enrollment not found. Enroll before reading progress.');
  throw new ApiError(409, 'Course completion is calculated from watched learning videos and cannot be set manually.');
});

export const logStudyTime = asyncHandler(async (req, res) => {
  const item = await Enrollment.findOneAndUpdate(
    { userId: req.user.id, courseId: req.params.courseId },
    { $inc: { studyMinutes: req.body.minutes } },
    { new: true, runValidators: true },
  ).populate('courseId');
  if (!item) throw new ApiError(404, 'Enrollment not found. Enroll before logging study time.');
  res.json({ success: true, message: 'Study time logged successfully.', data: item });
});

export const removeEnrollment = asyncHandler(async (req, res) => {
  const item = await Enrollment.findOneAndDelete({ userId: req.user.id, courseId: req.params.courseId });
  if (!item) throw new ApiError(404, 'Enrollment not found.');
  res.json({ success: true, message: 'Enrollment removed successfully.', data: null });
});
