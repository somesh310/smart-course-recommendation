import { Router } from 'express';
import { getMyProfile, updateMyPreferences, updateMyProfile } from '../controllers/userController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { preferencesSchema, profileSchema } from '../validators/userValidators.js';

const router = Router();
router.use(requireAuth);
router.get('/me', getMyProfile);
router.put('/me', validateRequest(profileSchema), updateMyProfile);
router.patch('/me/preferences', validateRequest(preferencesSchema), updateMyPreferences);
export default router;
