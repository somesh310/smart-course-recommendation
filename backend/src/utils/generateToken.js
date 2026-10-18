import jwt from 'jsonwebtoken';

export function generateToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  return jwt.sign({ sub: user.id, role: user.role, ver: user.tokenVersion || 0 }, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}
