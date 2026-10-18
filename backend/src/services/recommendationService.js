import User from '../models/User.js';
import Course from '../models/Course.js';
import { requestModelCareers, requestModelRecommendations, requestModelSkillGap, requestModelLearningPath } from './mlServiceClient.js';
import LearningResource from '../models/LearningResource.js';
import VideoProgress from '../models/VideoProgress.js';
import ApiError from '../utils/ApiError.js';

export async function getRecommendations(userId, options = {}) {
  const user = await User.findById(userId).lean();
  if (!user) throw new ApiError(404, 'Student profile was not found.');
  if (![...(user.currentSkills || []), ...(user.interests || []), user.careerGoal || ''].some((value) => String(value).trim())) {
    throw new ApiError(400, 'Add at least one skill, interest, or career goal to your learning profile first.');
  }
  const model = await requestModelRecommendations({
    interests: user.interests || [], careerGoal: user.careerGoal || '',
    currentSkills: user.currentSkills || [], experienceLevel: user.experienceLevel,
  }, options);
  if (model.status !== 'available' || !model.data) {
    throw new ApiError(503, 'Course recommendations are temporarily unavailable. Please try again shortly.');
  }
  const sourceItems = model.data.recommendations;
  const urls = sourceItems.map((item) => item.course_url).filter(Boolean);
  const catalogCourses = urls.length
    ? await Course.find({ externalUrl: { $in: urls }, published: true }).select('externalUrl duration durationUnit').lean()
    : [];
  const durationsByUrl = new Map(catalogCourses.map((course) => [course.externalUrl, course.durationUnit === 'self-paced' ? 'Self paced' : `${course.duration} ${course.durationUnit}`]));
  return {
    source: 'ml_model', modelStatus: 'available', message: model.data.message,
    items: sourceItems.map((item) => ({ ...item, course_duration: durationsByUrl.get(item.course_url) || null })),
  };
}

export async function getSkillGap(userId, careerId) {
  const user = await User.findById(userId).lean();
  if (!user) throw new ApiError(404, 'Student profile was not found.');
  if (!(user.currentSkills || []).some((skill) => String(skill).trim())) {
    throw new ApiError(400, 'Add at least one current skill to your learning profile first.');
  }
  const model = await requestModelSkillGap(careerId, user.currentSkills || []);
  if (model.status !== 'available' || !model.data) {
    throw new ApiError(503, 'Skill-gap analysis is temporarily unavailable. Please try again shortly.');
  }
  return model.data;
}

export async function getSkillGapCareers() {
  const model = await requestModelCareers();
  if (model.status !== 'available' || !model.data) {
    throw new ApiError(503, 'Career profiles are temporarily unavailable. Please try again shortly.');
  }
  return model.data;
}

export async function getLearningPath(userId, careerId) {
  const user = await User.findById(userId).lean();
  if (!user) throw new ApiError(404, 'Student profile was not found.');
  const model = await requestModelLearningPath(careerId, user.currentSkills || []);
  if (model.status !== 'available' || !model.data) {
    throw new ApiError(503, 'Learning path is temporarily unavailable. Please try again shortly.');
  }
  const [resources, recommendations] = await Promise.all([
    LearningResource.find({ active: true }).select('title description subject skills kind youtubeUrl youtubeId channelName durationSeconds courseId courseTitle').lean(),
    Promise.all(model.data.steps.map((step) => requestModelRecommendations({ currentSkills: [step.skill_name], interests: [], careerGoal: '', experienceLevel: user.experienceLevel }, { top_n: 3 }))),
  ]);
  const resourceRows = resources.filter((resource) => (resource.skills || []).some((skill) => model.data.steps.some((step) => skill.trim().toLocaleLowerCase() === step.skill_name.toLocaleLowerCase() || skill.trim().toLocaleLowerCase() === step.skill_id.toLocaleLowerCase())));
  const progressRows = resourceRows.length ? await VideoProgress.find({ userId, resourceId: { $in: resourceRows.map((item) => item._id) } }).select('resourceId status').lean() : [];
  const progressById = new Map(progressRows.map((item) => [String(item.resourceId), item.status]));
  return {
    ...model.data,
    steps: model.data.steps.map((step, index) => ({
      ...step,
      courses: recommendations[index]?.status === 'available' ? recommendations[index].data.recommendations : [],
      videos: resourceRows.filter((resource) => (resource.skills || []).some((skill) => skill.trim().toLocaleLowerCase() === step.skill_name.toLocaleLowerCase() || skill.trim().toLocaleLowerCase() === step.skill_id.toLocaleLowerCase())).map((resource) => ({
        resource_id: String(resource._id), title: resource.title, description: resource.description, kind: resource.kind,
        youtube_url: resource.youtubeUrl, youtube_id: resource.youtubeId, channel_name: resource.channelName,
        duration_seconds: resource.durationSeconds, status: progressById.get(String(resource._id)) || 'not_started',
      })),
    })),
  };
}
