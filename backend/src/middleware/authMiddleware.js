import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Authentication required.');
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); } catch { throw new ApiError(401, 'Invalid or expired access token.'); }
  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user) throw new ApiError(401, 'Account is no longer available.');
  if ((payload.ver || 0) !== user.tokenVersion) throw new ApiError(401, 'Access token has been revoked.');
  req.user = user;
  next();
});

export function requireRole(...roles) {
  return (req, _res, next) => roles.includes(req.user?.role) ? next() : next(new ApiError(403, 'You do not have permission to perform this action.'));
}
