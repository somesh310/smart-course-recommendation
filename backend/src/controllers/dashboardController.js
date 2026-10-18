import Enrollment from '../models/Enrollment.js';
import { getRecommendations } from '../services/recommendationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const dashboard = asyncHandler(async (req, res) => {
  const [totalEnrolled, completedCourses, progressRows, studyTimeRows, recommendationData] = await Promise.all([
    Enrollment.countDocuments({ userId: req.user.id }),
    Enrollment.countDocuments({ userId: req.user.id, status: 'completed' }),
    Enrollment.find({ userId: req.user.id }).sort({ updatedAt: -1 }).limit(10).populate('courseId', 'title category image').lean(),
    Enrollment.aggregate([
      { $match: { userId: req.user._id } },
      { $group: { _id: null, totalMinutes: { $sum: '$studyMinutes' } } },
    ]),
    getRecommendations(req.user.id, { top_n: 3 }).catch(() => ({ items: [], source: 'unavailable' })),
  ]);
  const inProgressCourses = totalEnrolled - completedCourses;
  const completionPercentage = totalEnrolled ? Math.round((completedCourses / totalEnrolled) * 100) : 0;
  const learningHours = Number(((studyTimeRows[0]?.totalMinutes || 0) / 60).toFixed(1));
  res.json({ success: true, message: 'Dashboard retrieved successfully.', data: {
    stats: { totalEnrolled, completedCourses, inProgressCourses, completionPercentage, learningHours },
    learningProgress: progressRows,
    recentActivity: progressRows.map((row) => ({ courseId: row.courseId?._id, courseTitle: row.courseId?.title || 'Unavailable course', action: row.status === 'completed' ? 'completed' : 'learning', updatedAt: row.updatedAt })),
    recommendations: recommendationData.items,
    recommendationSource: recommendationData.source,
  } });
});
