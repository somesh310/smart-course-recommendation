import { apiRequest } from './apiClient';

export async function getMyNotifications() {
  const response = await apiRequest('/learning-content/notifications');
  return response.data;
}

export async function markMyNotificationsRead() {
  const response = await apiRequest('/learning-content/notifications/read', { method: 'PATCH' });
  return response.data;
}
