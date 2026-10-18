import { apiRequest } from './apiClient';
import { initialProfile } from '../data/mockUser';

const KEY = 'pathwise-profile';
export function getDefaultUserProfile() { return { ...initialProfile, skills: [...initialProfile.skills], interests: [...initialProfile.interests] }; }

export function mapUser(user) {
  if (!user) return null;
  return {
    ...user,
    skills: user.currentSkills || user.skills || [],
    experience: user.experienceLevel || user.experience || 'Beginner',
    weeklyHours: user.weeklyLearningHours ?? user.weeklyHours ?? 6,
    budget: user.budgetPreference || user.budget || 'Free and paid',
  };
}

export async function getUserProfile() {
  const response = await apiRequest('/users/me');
  const user = mapUser(response.data.user);
  localStorage.setItem(KEY, JSON.stringify(user));
  return user;
}

export async function updateUserProfile(profile) {
  const payload = {
    name: profile.name,
    degree: profile.degree,
    branch: profile.branch,
    semester: profile.semester,
    currentSkills: profile.skills ?? profile.currentSkills,
    experienceLevel: profile.experience ?? profile.experienceLevel,
    interests: profile.interests,
    careerGoal: profile.careerGoal,
    weeklyLearningHours: Number(profile.weeklyHours ?? profile.weeklyLearningHours),
    budgetPreference: profile.budget ?? profile.budgetPreference,
    preferredLearningStyle: profile.preferredLearningStyle,
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  const response = await apiRequest('/users/me', { method: 'PUT', body: JSON.stringify(payload) });
  const user = mapUser(response.data.user);
  localStorage.setItem(KEY, JSON.stringify(user));
  return user;
}

export async function updateUserPreferences(preferences) {
  const payload = {
    interests: preferences.interests,
    careerGoal: preferences.careerGoal,
    weeklyLearningHours: Number(preferences.weeklyHours ?? preferences.weeklyLearningHours),
    budgetPreference: preferences.budget ?? preferences.budgetPreference,
    preferredLearningStyle: preferences.preferredLearningStyle,
  };
  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  const response = await apiRequest('/users/me/preferences', { method: 'PATCH', body: JSON.stringify(payload) });
  return mapUser(response.data.user);
}
