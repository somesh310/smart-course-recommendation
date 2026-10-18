import { z } from 'zod';

const stringList = z.array(z.string().trim().min(1).max(120)).max(50).default([]);
export const courseSchema = z.object({
  title: z.string().trim().min(3).max(180),
  slug: z.string().trim().toLowerCase().min(3).max(190).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(20).max(3000),
  category: z.string().trim().min(2).max(80),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  duration: z.number().positive().max(10000),
  durationUnit: z.enum(['hours', 'days', 'weeks', 'months', 'self-paced']),
  priceType: z.enum(['Free', 'Paid']),
  price: z.number().min(0).default(0),
  currency: z.string().trim().length(3).default('USD'),
  skills: stringList,
  prerequisites: stringList,
  learningOutcomes: stringList,
  provider: z.string().trim().min(2).max(120),
  externalUrl: z.string().url().max(2048).or(z.literal('')).default(''),
  image: z.string().url().max(2048).or(z.literal('')).default(''),
  published: z.boolean().default(false),
}).strict();
export const courseQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(80).optional(),
  level: z.enum(['Beginner', 'Intermediate', 'Advanced']).optional(),
  priceType: z.enum(['Free', 'Paid']).optional(),
  duration: z.enum(['short', 'long']).optional(),
  sort: z.enum(['title', '-title', 'createdAt', '-createdAt', 'duration', '-duration']).default('title'),
});
export const idParamSchema = z.object({ id: z.string().regex(/^(?:[a-f\d]{24}|[a-z0-9]+(?:-[a-z0-9]+)*)$/i) });
