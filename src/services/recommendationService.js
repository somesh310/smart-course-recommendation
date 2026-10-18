import { apiRequest, queryString } from './apiClient';
export function mapRecommendation(item) {
  return {
    score: item.similarity_score,
    course: {
      id: item.course_id, title: item.course_name || 'Untitled course', category: item.difficulty_level || 'Course',
      level: item.difficulty_level || 'Not specified', provider: item.university || 'Not specified',
      description: item.course_description || '', skills: (item.skills || '').split(/\s{2,}/).map((skill) => skill.trim()).filter(Boolean),
      externalUrl: item.course_url || '', rating: item.course_rating, duration: item.course_duration || null, similarity_score: item.similarity_score,
    },
  };
}
export async function getSkillGapCareers() {
  const response = await apiRequest('/recommendations/careers');
  return response.data;
}
export async function analyzeSkillGap(careerId) {
  const response = await apiRequest('/recommendations/skill-gap', { method: 'POST', body: JSON.stringify({ career_id: careerId }) });
  return response.data;
}
export async function getLearningPath(careerId) {
  const response = await apiRequest('/recommendations/learning-path', { method: 'POST', body: JSON.stringify({ career_id: careerId }) });
  return response.data;
}
export async function getRecommendations(_profile, options = {}) {
  const response = await apiRequest(`/recommendations${queryString({ top_n: options.top_n || 20, level: options.level, min_rating: options.min_rating })}`);
  return {
    source: response.meta?.source || 'ml_model', modelStatus: response.meta?.modelStatus || 'not_reported',
    items: response.data.map(mapRecommendation),
  };
}
export async function submitRecommendationFeedback(courseId, action, comment = '') {
  return apiRequest('/recommendations/feedback', { method: 'POST', body: JSON.stringify({ courseId, action, comment }) });
}
