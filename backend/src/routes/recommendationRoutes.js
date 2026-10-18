import { Router } from 'express';
import { feedback, recommendations, skillGap, skillGapCareers, learningPath } from '../controllers/recommendationController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { feedbackSchema, recommendationQuerySchema, skillGapSchema, learningPathSchema } from '../validators/learningValidators.js';

const router = Router();
router.use(requireAuth);
router.get('/careers', skillGapCareers);
router.get('/', validateRequest(recommendationQuerySchema, 'query'), recommendations);
router.post('/skill-gap', validateRequest(skillGapSchema), skillGap);
router.post('/learning-path', validateRequest(learningPathSchema), learningPath);
router.post('/feedback', validateRequest(feedbackSchema), feedback);
export default router;
