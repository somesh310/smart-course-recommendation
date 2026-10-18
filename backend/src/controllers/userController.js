import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getMyProfile = asyncHandler(async (req, res) => res.json({ success: true, message: 'Profile retrieved successfully.', data: { user: req.user.toJSON() } }));
export const updateMyProfile = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user.id, { $set: req.body }, { new: true, runValidators: true });
  res.json({ success: true, message: 'Profile updated successfully.', data: { user: user.toJSON() } });
});
export const updateMyPreferences = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user.id, { $set: req.body }, { new: true, runValidators: true });
  res.json({ success: true, message: 'Learning preferences updated successfully.', data: { user: user.toJSON() } });
});
