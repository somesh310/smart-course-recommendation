import { Router } from 'express';
import { login, logout, me, register, requestPasswordReset, resendRegistrationOtp, resetPassword, verifyRegistration } from '../controllers/authController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { forgotPasswordSchema, loginSchema, registerSchema, resendRegistrationOtpSchema, resetPasswordSchema, verifyRegistrationSchema } from '../validators/authValidators.js';

const router = Router();
router.post('/register', validateRequest(registerSchema), register);
router.post('/verify-registration', validateRequest(verifyRegistrationSchema), verifyRegistration);
router.post('/resend-registration-otp', validateRequest(resendRegistrationOtpSchema), resendRegistrationOtp);
router.post('/forgot-password', validateRequest(forgotPasswordSchema), requestPasswordReset);
router.post('/reset-password', validateRequest(resetPasswordSchema), resetPassword);
router.post('/login', validateRequest(loginSchema), login);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);
export default router;
