import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import enrollmentRoutes from './routes/enrollmentRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import learningResourceRoutes from './routes/learningResourceRoutes.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';
import { notFoundMiddleware } from './middleware/notFoundMiddleware.js';

const app = express();
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: (origin, callback) => callback(null, !origin || origin === allowedOrigin), credentials: false }));
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', { skip: (_req, res) => res.statusCode >= 400 }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message: 'Too many authentication attempts. Try again later.', errors: [] } });
app.get('/api/health', (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    success: connected,
    message: connected ? 'API is healthy.' : 'Database is unavailable.',
    data: { database: connected ? 'connected' : 'disconnected' },
  });
});
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/verify-registration', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/auth/resend-registration-otp', rateLimit({ windowMs: 15 * 60 * 1000, limit: 3, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/auth/reset-password', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/learning', enrollmentRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/learning-content', learningResourceRoutes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
