import { z } from 'zod';
export const courseIdParamSchema = z.object({ courseId: z.string().regex(/^[a-f\d]{24}$/i) });
export const progressSchema = z.object({ progress: z.number().min(0).max(100) }).strict();
export const studyTimeSchema = z.object({ minutes: z.number().int().min(1).max(1440) }).strict();
export const feedbackSchema = z.object({ courseId: z.string().regex(/^[a-f\d]{24}$/i), action: z.enum(['helpful', 'not_helpful', 'dismissed']), comment: z.string().trim().max(1000).optional().default('') }).strict();
export const paginationSchema = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50) });
export const recommendationQuerySchema = z.object({
  top_n: z.coerce.number().int().min(1).max(20).default(5),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Mixed']).optional(),
  min_rating: z.coerce.number().min(0).max(5).optional(),
}).strict();

export const skillGapSchema = z.object({
  career_id: z.enum([
    'ai-ml-engineer',
    'data-analyst',
    'backend-developer',
  ]),
}).strict();

export const learningPathSchema = z.object({
  career_id: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/i),
}).strict();
