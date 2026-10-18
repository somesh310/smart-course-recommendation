import { Router } from 'express';
import { createCourse, deleteCourse, getCourse, listCourses, updateCourse } from '../controllers/courseController.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { courseQuerySchema, courseSchema, idParamSchema } from '../validators/courseValidators.js';

const router = Router();
router.get('/', validateRequest(courseQuerySchema, 'query'), listCourses);
router.get('/:id', validateRequest(idParamSchema, 'params'), getCourse);
router.post('/', requireAuth, requireRole('admin'), validateRequest(courseSchema), createCourse);
router.put('/:id', requireAuth, requireRole('admin'), validateRequest(idParamSchema, 'params'), validateRequest(courseSchema), updateCourse);
router.delete('/:id', requireAuth, requireRole('admin'), validateRequest(idParamSchema, 'params'), deleteCourse);
export default router;
