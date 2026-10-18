import mongoose from 'mongoose';
import ApiError from '../utils/ApiError.js';

export function errorMiddleware(err, _req, res, _next) {
  if (res.headersSent) return;
  let status = err.statusCode || 500;
  let message = err.message || 'Internal server error.';
  let errors = err.errors || [];
  if (err instanceof mongoose.Error.ValidationError) {
    status = 400; message = 'Database validation failed.';
    errors = Object.values(err.errors).map((item) => ({ path: item.path, message: item.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400; message = 'Invalid identifier.'; errors = [];
  } else if (err?.code === 11000) {
    status = 409; message = 'A record with that unique value already exists.'; errors = [];
  } else if (!(err instanceof ApiError) && status === 500) {
    message = process.env.NODE_ENV === 'production' ? 'Internal server error.' : message;
    errors = [];
  }
  if (status >= 500) console.error(err);
  res.status(status).json({ success: false, message, errors });
}
