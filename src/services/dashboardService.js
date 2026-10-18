import { apiRequest } from './apiClient';
import { mapRecommendation } from './recommendationService';
export async function getDashboard() {
  const response = await apiRequest('/dashboard');
  return { ...response.data, recommendations: response.data.recommendations.map(mapRecommendation) };
}
