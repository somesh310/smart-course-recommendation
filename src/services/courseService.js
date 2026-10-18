import { apiRequest, queryString } from './apiClient';

export function mapCourse(course) {
  if (!course) return null;
  const id = String(course._id || course.id || course.slug);
  const duration = course.durationUnit === 'self-paced' ? 'Self paced' : `${course.duration} ${course.durationUnit}`;
  return {
    ...course,
    id,
    slug: course.slug,
    duration,
    priceType: course.priceType,
    url: course.externalUrl || course.url || '',
    image: course.image || '',
    skills: course.skills || [],
    prerequisites: course.prerequisites || [],
    learningOutcomes: course.learningOutcomes || [],
  };
}

export async function getCourses(filters = {}) {
  const params = {
    page: filters.page || 1,
    limit: filters.limit || 100,
    search: filters.search,
    category: filters.category,
    level: filters.level,
    priceType: filters.price,
    duration: filters.duration,
    sort: filters.sort || 'title',
  };
  const response = await apiRequest(`/courses${queryString(params)}`, { auth: false });
  return response.data.map(mapCourse);
}

export async function getCourseById(id) {
  try {
    const response = await apiRequest(`/courses/${encodeURIComponent(id)}`, { auth: false });
    return mapCourse(response.data);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}
