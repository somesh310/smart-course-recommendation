import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});
export const verifyRegistrationSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  code: z.string().trim().regex(/^\d{6}$/),
}).strict();
export const resendRegistrationOtpSchema = z.object({ email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()) }).strict();
export const loginSchema = z.object({ email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()), password: z.string().min(1).max(128) });
export const forgotPasswordSchema = z.object({ email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()) }).strict();
export const resetPasswordSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  token: z.string().regex(/^[a-f\d]{64}$/i),
  password: z.string().min(12).max(128),
}).strict();
