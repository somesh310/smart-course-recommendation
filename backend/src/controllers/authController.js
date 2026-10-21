import bcrypt from 'bcryptjs';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import User from '../models/User.js';
import PasswordResetToken from '../models/PasswordResetToken.js';
import PendingRegistration from '../models/PendingRegistration.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateToken } from '../utils/generateToken.js';
import { emailIsConfigured, sendPasswordResetEmail, sendRegistrationOtpEmail } from '../services/emailService.js';

const userPayload = (user) => user.toJSON();
const hashRegistrationOtp = (code) => createHmac('sha256', process.env.JWT_SECRET).update(code).digest('hex');
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists.');
  if (!emailIsConfigured()) throw new ApiError(503, 'Registration email is not configured. Ask the project administrator for help.');
  const passwordHash = await bcrypt.hash(password, 12);
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await PendingRegistration.findOneAndUpdate(
    { email },
    { $set: { name, email, passwordHash, otpHash: hashRegistrationOtp(code), attempts: 0, expiresAt: new Date(Date.now() + 10 * 60 * 1000) } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  try {
    await sendRegistrationOtpEmail({ to: email, code });
  } catch (error) {
    console.error(`Registration verification email delivery failed: ${error.message}`);
    throw new ApiError(502, 'We could not send the verification code. Check the email settings or try again.');
  }
  res.status(202).json({ success: true, message: 'Verification code sent. Check your inbox to finish creating your account.', data: { email, expiresInMinutes: 10 } });
});

export const resendRegistrationOtp = asyncHandler(async (req, res) => {
  if (!emailIsConfigured()) throw new ApiError(503, 'Registration email is not configured. Ask the project administrator for help.');
  const { email } = req.body;
  const pending = await PendingRegistration.findOne({ email, expiresAt: { $gt: new Date() } });
  if (pending) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    pending.otpHash = hashRegistrationOtp(code);
    pending.attempts = 0;
    pending.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pending.save();
    try {
      await sendRegistrationOtpEmail({ to: email, code });
    } catch (error) {
      console.error(`Registration verification email delivery failed: ${error.message}`);
      throw new ApiError(502, 'We could not send the verification code. Try again shortly.');
    }
  }
  res.json({ success: true, message: 'If signup is pending for that email, a new verification code has been sent.', data: null });
});

export const verifyRegistration = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists. Try signing in.');
  const pending = await PendingRegistration.findOne({ email, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }).select('+passwordHash +otpHash');
  if (!pending) throw new ApiError(400, 'No active signup was found, or its code expired. Start registration again.');
  const submittedHash = Buffer.from(hashRegistrationOtp(code), 'hex');
  const storedHash = Buffer.from(pending.otpHash, 'hex');
  if (!timingSafeEqual(submittedHash, storedHash)) {
    await PendingRegistration.updateOne({ _id: pending.id, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } });
    throw new ApiError(400, 'That verification code is incorrect. You can request a new code.');
  }
  const claimed = await PendingRegistration.findOneAndDelete({ _id: pending.id, otpHash: pending.otpHash, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }).select('+passwordHash');
  if (!claimed) throw new ApiError(400, 'That verification code has already been used. Request a new code.');
  const user = await User.create({ name: claimed.name, email: claimed.email, passwordHash: claimed.passwordHash, emailVerified: true });
  res.status(201).json({ success: true, message: 'Email verified and account created.', data: { user: userPayload(user), token: generateToken(user) } });
});

export const requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new ApiError(503, 'Password reset email is not configured. Ask the project administrator for help.');
  }
  const user = await User.findOne({ email });
  if (user) {
    await PasswordResetToken.deleteMany({ userId: user.id });
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await PasswordResetToken.create({ userId: user.id, email, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt });
    const resetUrl = new URL('/reset-password', process.env.FRONTEND_URL || 'http://localhost:5173');
    resetUrl.hash = new URLSearchParams({ token, email }).toString();
    try {
      await sendPasswordResetEmail({ to: email, resetUrl: resetUrl.toString() });
    } catch (error) {
      await PasswordResetToken.deleteMany({ userId: user.id });
      console.error(`Password reset email delivery failed: ${error.message}`);
      throw new ApiError(502, 'We could not send the reset email. Try again later or contact the administrator.');
    }
  }
  res.json({ success: true, message: 'If an account exists for that email, a password reset link has been sent.', data: null });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { email, token, password } = req.body;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const resetRecord = await PasswordResetToken.findOneAndDelete({ email, tokenHash, expiresAt: { $gt: new Date() } });
  if (!resetRecord) throw new ApiError(400, 'This reset link is invalid or expired. Request a new one.');
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await User.updateOne({ _id: resetRecord.userId, email }, { $set: { passwordHash }, $inc: { tokenVersion: 1 } });
  if (!result.matchedCount) throw new ApiError(400, 'This reset link is invalid or expired. Request a new one.');
  await PasswordResetToken.deleteMany({ userId: resetRecord.userId });
  res.json({ success: true, message: 'Password updated. You can now sign in with your new password.', data: null });
});

export const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash +tokenVersion');
  const valid = user && await bcrypt.compare(req.body.password, user.passwordHash);
  if (!valid) throw new ApiError(401, 'Email or password is incorrect.');
  res.json({ success: true, message: 'Signed in successfully.', data: { user: userPayload(user), token: generateToken(user) } });
});

export const me = asyncHandler(async (req, res) => res.json({ success: true, message: 'Account retrieved successfully.', data: { user: userPayload(req.user) } }));

export const logout = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user.id }, { $inc: { tokenVersion: 1 } });
  res.json({ success: true, message: 'Signed out successfully.', data: null });
});
