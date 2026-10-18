import { Router } from 'express';
import { enroll, getLearningItem, listLearning, logStudyTime, removeEnrollment, updateProgress } from '../controllers/enrollmentController.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { courseIdParamSchema, paginationSchema, progressSchema, studyTimeSchema } from '../validators/learningValidators.js';
import { enrollmentSchema } from '../validators/enrollmentValidators.js';

const router = Router();
router.use(requireAuth);
router.get('/', validateRequest(paginationSchema, 'query'), listLearning);
router.post('/enroll', validateRequest(enrollmentSchema), enroll);
router.get('/:courseId', validateRequest(courseIdParamSchema, 'params'), getLearningItem);
router.patch('/:courseId/progress', validateRequest(courseIdParamSchema, 'params'), validateRequest(progressSchema), updateProgress);
router.patch('/:courseId/study-time', validateRequest(courseIdParamSchema, 'params'), validateRequest(studyTimeSchema), logStudyTime);
router.delete('/:courseId', validateRequest(courseIdParamSchema, 'params'), removeEnrollment);
export default router;
