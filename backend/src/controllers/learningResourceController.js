import LearningResource from '../models/LearningResource.js';
import LearningRequest from '../models/LearningRequest.js';
import VideoProgress from '../models/VideoProgress.js';
import Enrollment from '../models/Enrollment.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parseYouTubeUrl } from '../validators/resourceValidators.js';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const listResources = asyncHandler(async (req, res) => {
  const { page, limit, subject, courseId, skill, difficulty } = req.validatedQuery;
  const filter = { active: true };
  if (subject) filter.subject = new RegExp(`^${escapeRegex(subject)}$`, 'i');
  if (courseId) filter.courseId = courseId;
  if (skill) filter.skills = new RegExp(escapeRegex(skill), 'i');
  if (difficulty) filter.difficulty = difficulty;
  const [items, total] = await Promise.all([LearningResource.find(filter).sort({ courseId: 1, order: 1, createdAt: 1 }).skip((page - 1) * limit).limit(limit).lean(), LearningResource.countDocuments(filter)]);
  res.json({ success: true, message: 'Learning resources retrieved successfully.', data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});
export const listAdminResources = asyncHandler(async (req, res) => {
  const { page, limit } = req.validatedQuery;
  const [items, total] = await Promise.all([LearningResource.find().sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), LearningResource.countDocuments()]);
  res.json({ success: true, message: 'Managed learning resources retrieved.', data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

export const createResource = asyncHandler(async (req, res) => {
  const parsed = parseYouTubeUrl(req.body.youtubeUrl);
  const item = await LearningResource.create({ ...req.body, ...parsed, createdBy: req.user.id });
  res.status(201).json({ success: true, message: 'Learning resource created.', data: item });
});
export const updateResource = asyncHandler(async (req, res) => {
  const parsed = parseYouTubeUrl(req.body.youtubeUrl);
  const item = await LearningResource.findByIdAndUpdate(req.params.id, { $set: { ...req.body, ...parsed } }, { new: true, runValidators: true });
  if (!item) throw new ApiError(404, 'Learning resource not found.');
  res.json({ success: true, message: 'Learning resource updated.', data: item });
});
export const deleteResource = asyncHandler(async (req, res) => {
  const item = await LearningResource.findByIdAndUpdate(req.params.id, { $set: { active: false } }, { new: true });
  if (!item) throw new ApiError(404, 'Learning resource not found.');
  res.json({ success: true, message: 'Learning resource deactivated.', data: item });
});
export const createLearningRequest = asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const duplicate = await LearningRequest.exists({ userId: req.user.id, status: 'pending', createdAt: { $gte: since }, courseName: new RegExp(`^${escapeRegex(req.body.courseName)}$`, 'i') });
  if (duplicate) throw new ApiError(409, 'You already have a pending request for this course.');
  const item = await LearningRequest.create({ ...req.body, userId: req.user.id });
  res.status(201).json({ success: true, message: 'Learning video request submitted.', data: item });
});
export const listMyRequests = asyncHandler(async (req, res) => {
  const items = await LearningRequest.find({ userId: req.user.id }).sort({ updatedAt: -1 }).limit(100).lean();
  res.json({ success: true, message: 'Your requests retrieved.', data: items });
});
export const listMyNotifications = asyncHandler(async (req, res) => {
  const filter = { userId: req.user.id, status: { $in: ['resolved', 'declined'] } };
  const [notifications, unreadCount] = await Promise.all([
    LearningRequest.find(filter).select('courseName skill status adminNote resourceId resolvedAt readAt updatedAt').sort({ updatedAt: -1 }).limit(50).lean(),
    LearningRequest.countDocuments({ ...filter, readAt: null }),
  ]);
  res.json({ success: true, message: 'Notifications retrieved.', data: { notifications, unreadCount } });
});
export const markMyNotificationsRead = asyncHandler(async (req, res) => {
  const result = await LearningRequest.updateMany(
    { userId: req.user.id, status: { $in: ['resolved', 'declined'] }, readAt: null },
    { $set: { readAt: new Date() } },
  );
  res.json({ success: true, message: 'Notifications marked as read.', data: { markedRead: result.modifiedCount } });
});
export const listRequests = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.validatedQuery;
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    LearningRequest.aggregate([{ $match: filter }, { $group: { _id: { courseName: '$courseName', skill: '$skill', status: '$status' }, requestId: { $first: '$_id' }, sampleMessage: { $first: '$message' }, demand: { $sum: 1 }, latestAt: { $max: '$createdAt' } } }, { $sort: { demand: -1, latestAt: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }]),
    LearningRequest.countDocuments(filter),
  ]);
  res.json({ success: true, message: 'Learning requests retrieved.', data: items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});
export const updateRequest = asyncHandler(async (req, res) => {
  if (req.body.resourceId) {
    const resource = await LearningResource.findOne({ _id: req.body.resourceId, active: true });
    if (!resource) throw new ApiError(400, 'Choose an active learning resource.');
  }
  const requested = await LearningRequest.findById(req.params.id);
  if (!requested) throw new ApiError(404, 'Learning request not found.');
  const item = await LearningRequest.updateMany({ status: 'pending', courseName: new RegExp(`^${escapeRegex(requested.courseName)}$`, 'i'), skill: new RegExp(`^${escapeRegex(requested.skill)}$`, 'i') }, { $set: { ...req.body, resolvedAt: new Date() } }, { runValidators: true });
  res.json({ success: true, message: 'Matching requests updated. Students can see the update in their request list.', data: { modifiedCount: item.modifiedCount, status: req.body.status } });
});

function mergeRanges(ranges, nextRange) {
  const sorted = [...ranges, nextRange].filter(([start, end]) => end > start).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (!last || range[0] > last[1]) merged.push([...range]);
    else last[1] = Math.max(last[1], range[1]);
  }
  return merged;
}

export const getVideoProgress = asyncHandler(async (req, res) => {
  const resource = await LearningResource.findOne({ _id: req.params.resourceId, active: true }).lean();
  if (!resource) throw new ApiError(404, 'Learning resource not found.');
  const progress = await VideoProgress.findOne({ userId: req.user.id, resourceId: resource._id }).lean();
  res.json({ success: true, message: 'Video progress retrieved.', data: { resourceId: resource._id, durationSeconds: resource.durationSeconds, supported: resource.kind === 'video', status: progress?.status || 'not_started', watchedRanges: progress?.watchedRanges || [], lastPositionSeconds: progress?.lastPositionSeconds || 0, coveragePercent: resource.durationSeconds ? Math.min(100, Math.round(((progress?.watchedRanges || []).reduce((sum, [start, end]) => sum + end - start, 0) / resource.durationSeconds) * 100)) : null } });
});

export const recordPlayback = asyncHandler(async (req, res) => {
  const { resourceId, positionSeconds, playing } = req.body;
  const resource = await LearningResource.findOne({ _id: resourceId, active: true });
  if (!resource) throw new ApiError(404, 'Learning resource not found.');
  if (resource.kind !== 'video') throw new ApiError(422, 'Progress tracking requires a video.');
  let progress = await VideoProgress.findOne({ userId: req.user.id, resourceId });
  if (!progress) progress = await VideoProgress.create({ userId: req.user.id, resourceId, courseId: resource.courseId });

  const now = new Date();
  let creditedSeconds = 0;
  if (progress.lastHeartbeatAt) {
    const elapsed = (now - progress.lastHeartbeatAt) / 1000;
    const advance = positionSeconds - progress.lastPositionSeconds;
    // Heartbeats are expected every 10 seconds. Long gaps, backward seeks and
    // forward seeks beyond plausible playback are treated as no watched time.
    if (elapsed > 0 && elapsed <= 15 && advance > 0 && advance <= elapsed + 2.5) {
      creditedSeconds = elapsed;
      if (resource.durationSeconds) progress.watchedRanges = mergeRanges(progress.watchedRanges, [progress.lastPositionSeconds, Math.min(positionSeconds, resource.durationSeconds)]);
    }
  }
  progress.lastPositionSeconds = Math.min(positionSeconds, resource.durationSeconds || positionSeconds);
  progress.lastHeartbeatAt = playing ? now : null;
  const covered = progress.watchedRanges.reduce((sum, [start, end]) => sum + end - start, 0);
  if (resource.durationSeconds && covered >= resource.durationSeconds * 0.9) {
    progress.status = 'completed';
    progress.completedAt ||= now;
  } else if (creditedSeconds > 0 || covered > 0) progress.status = 'in_progress';
  await progress.save();

  let course = null;
  if (resource.courseId) {
    const required = await LearningResource.find({ courseId: resource.courseId, active: true }).select('_id kind durationSeconds').lean();
    const rows = required.length ? await VideoProgress.find({ userId: req.user.id, resourceId: { $in: required.map((item) => item._id) } }).select('resourceId watchedRanges').lean() : [];
    const finished = new Set(rows.filter((row) => {
      const duration = required.find((item) => String(item._id) === String(row.resourceId) && item.kind === 'video')?.durationSeconds;
      return duration && row.watchedRanges.reduce((sum, [start, end]) => sum + end - start, 0) >= duration * 0.9;
    }).map((row) => String(row.resourceId)));
    course = { requiredResources: required.length, completedResources: finished.size, progressPercent: required.length ? Math.round(finished.size / required.length * 100) : 0, completed: required.length > 0 && finished.size === required.length };
    const update = { $set: { progress: course.progressPercent, status: course.completed ? 'completed' : 'in_progress', completedAt: course.completed ? (await Enrollment.findOne({ userId: req.user.id, courseId: resource.courseId }).select('completedAt').lean())?.completedAt || now : null }, $setOnInsert: { userId: req.user.id, courseId: resource.courseId } };
    if (creditedSeconds > 0) update.$inc = { studyMinutes: creditedSeconds / 60 };
    await Enrollment.updateOne({ userId: req.user.id, courseId: resource.courseId }, update, { upsert: true, runValidators: true });
  }
  res.json({ success: true, message: 'Playback progress saved.', data: { status: progress.status, watchedRanges: progress.watchedRanges, lastPositionSeconds: progress.lastPositionSeconds, coveragePercent: resource.durationSeconds ? Math.min(100, Math.round((covered / resource.durationSeconds) * 100)) : null, course } });
});
