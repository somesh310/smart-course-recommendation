import { z } from 'zod';
export const enrollmentSchema = z.object({ courseId: z.string().regex(/^[a-f\d]{24}$/i) }).strict();
