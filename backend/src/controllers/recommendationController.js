import Course from '../models/Course.js';
import RecommendationFeedback from '../models/RecommendationFeedback.js';
import { getRecommendations, getSkillGap, getSkillGapCareers, getLearningPath } from '../services/recommendationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const recommendations = asyncHandler(async (req, res) => {
  const result = await getRecommendations(req.user.id, req.validatedQuery || req.query);
  res.json({ success: true, message: result.message || 'Recommendations retrieved successfully.', data: result.items, meta: { source: result.source, modelStatus: result.modelStatus } });
});

export const skillGap = asyncHandler(async (req, res) => {
  const result = await getSkillGap(req.user.id, req.body.career_id);
  res.json({ success: true, message: 'Skill-gap analysis completed.', data: result });
});

export const skillGapCareers = asyncHandler(async (_req, res) => {
  const result = await getSkillGapCareers();
  res.json({ success: true, message: 'Career profiles retrieved successfully.', data: result });
});

export const learningPath = asyncHandler(async (req, res) => {
  const result = await getLearningPath(req.user.id, req.body.career_id);
  res.json({ success: true, message: 'Personalized learning path generated.', data: result });
});

export const feedback = asyncHandler(async (req, res) => {
  const course = await Course.findOne({ _id: req.body.courseId, published: true }).select('_id');
  if (!course) return res.status(404).json({ success: false, message: 'Published course not found.', errors: [] });
  const item = await RecommendationFeedback.create({ userId: req.user.id, ...req.body });
  res.status(201).json({ success: true, message: 'Recommendation feedback recorded.', data: item });
});
