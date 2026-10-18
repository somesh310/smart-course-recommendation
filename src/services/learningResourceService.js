import { apiRequest, queryString } from './apiClient';

export async function getLearningResources(filters = {}) {
  return apiRequest(`/learning-content/resources${queryString(filters)}`, { auth: false });
}
export async function createLearningRequest(body) {
  return apiRequest('/learning-content/requests', { method: 'POST', body: JSON.stringify(body) });
}
export async function getMyLearningRequests() {
  return apiRequest('/learning-content/requests/mine');
}
export async function getAdminResources(filters = {}) {
  return apiRequest(`/learning-content/admin/resources${queryString(filters)}`);
}
export async function saveLearningResource(body, id) {
  return apiRequest(`/learning-content/admin/resources${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
}
export async function deactivateLearningResource(id) {
  return apiRequest(`/learning-content/admin/resources/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
export async function getAdminRequests(filters = {}) {
  return apiRequest(`/learning-content/admin/requests${queryString(filters)}`);
}
export async function updateLearningRequest(id, body) {
  return apiRequest(`/learning-content/admin/requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export async function getVideoProgress(resourceId) {
  return apiRequest(`/learning-content/progress/${encodeURIComponent(resourceId)}`);
}
export async function saveVideoPlayback(resourceId, positionSeconds, playing) {
  return apiRequest('/learning-content/progress', { method: 'POST', body: JSON.stringify({ resourceId, positionSeconds, playing }) });
}
