import 'dotenv/config';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';

const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;
const name = process.env.SEED_ADMIN_NAME?.trim() || 'Course Administrator';

if (!email || !password) throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in backend/.env first.');
if (password.length < 8) throw new Error('SEED_ADMIN_PASSWORD must contain at least 8 characters.');

try {
  await connectDatabase();
  const passwordHash = await bcrypt.hash(password, 12);
  await User.updateOne(
    { email },
    { $set: { email, name, passwordHash, role: 'admin', emailVerified: true } },
    { upsert: true, setDefaultsOnInsert: true },
  );
  console.log('Admin account provisioned. You can now sign in with the credentials in backend/.env.');
} finally {
  await disconnectDatabase();
}
