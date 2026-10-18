import { apiRequest } from './apiClient';
import { mapCourse, getCourseById } from './courseService';
import { roadmap } from '../data/recommendations';

function mapEnrollment(item) {
  const course = item.courseId && typeof item.courseId === 'object' ? mapCourse(item.courseId) : null;
  return { courseId: String(course?.id || item.courseId), course, progress: item.progress, studyMinutes: item.studyMinutes || 0, status: item.status === 'in_progress' ? 'in-progress' : item.status, updatedAt: item.updatedAt };
}
export async function getMyLearning() { const response = await apiRequest('/learning?limit=100'); return response.data.map(mapEnrollment); }
export async function enrollInCourse(courseId) { await apiRequest('/learning/enroll', { method: 'POST', body: JSON.stringify({ courseId }) }); return getMyLearning(); }
export async function updateLearningProgress(courseId, progress) { await apiRequest(`/learning/${encodeURIComponent(courseId)}/progress`, { method: 'PATCH', body: JSON.stringify({ progress }) }); return getMyLearning(); }
export async function logStudyTime(courseId, minutes) { await apiRequest(`/learning/${encodeURIComponent(courseId)}/study-time`, { method: 'PATCH', body: JSON.stringify({ minutes }) }); return getMyLearning(); }
export async function removeEnrollment(courseId) { await apiRequest(`/learning/${encodeURIComponent(courseId)}`, { method: 'DELETE' }); return getMyLearning(); }
export async function clearMyLearning() { const items = await getMyLearning(); await Promise.all(items.map((item) => apiRequest(`/learning/${encodeURIComponent(item.courseId)}`, { method: 'DELETE' }))); return []; }
export async function getLearningRoadmap(learning = []) {
  const courses = await Promise.all(roadmap.map((step) => getCourseById(step.courseId).catch(() => null)));
  let currentAssigned = false;
  return roadmap.map((step, index) => {
    const course = courses[index];
    const enrollment = learning.find((item) => course && item.courseId === course.id);
    let state = 'upcoming';
    if (enrollment?.status === 'completed' || enrollment?.progress === 100) state = 'completed';
    else if (enrollment) { state = 'current'; currentAssigned = true; }
    else if (!currentAssigned && roadmap.slice(0, index).every((previous, previousIndex) => {
      const previousCourse = courses[previousIndex];
      const previousEnrollment = learning.find((item) => previousCourse && item.courseId === previousCourse.id);
      return previousEnrollment?.status === 'completed' || previousEnrollment?.progress === 100;
    })) { state = 'current'; currentAssigned = true; }
    return { ...step, courseId: course?.id || step.courseId, title: course?.title || step.title, state };
  });
}
