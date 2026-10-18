import { z } from 'zod';

const list = z.array(z.string().trim().min(1).max(80)).max(50).optional();
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  degree: z.string().trim().max(100).optional(),
  branch: z.string().trim().max(100).optional(),
  semester: z.string().trim().max(40).refine((value) => !value || /^(?:[1-9]|1[0-2])(?:st|nd|rd|th)?(?:\s+semester)?$/i.test(value), 'Semester must be from 1 to 12.').optional(),
  currentSkills: list,
  experienceLevel: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
  interests: list,
  careerGoal: z.string().trim().max(160).optional(),
  weeklyLearningHours: z.number().int().min(1).max(80).optional(),
  budgetPreference: z.enum(['Free only', 'Free and paid', 'Paid']).optional(),
  preferredLearningStyle: z.string().trim().max(80).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one profile field is required.');
export const preferencesSchema = z.object({
  interests: list,
  careerGoal: z.string().trim().max(160).optional(),
  weeklyLearningHours: z.number().int().min(1).max(80).optional(),
  budgetPreference: z.enum(['Free only', 'Free and paid', 'Paid']).optional(),
  preferredLearningStyle: z.string().trim().max(80).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one preference is required.');
