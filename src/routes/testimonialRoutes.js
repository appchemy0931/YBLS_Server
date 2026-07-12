import express from 'express';
import {
  getTestimonials,
  getAllTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
} from '../controllers/testimonialController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

router.route('/').get(getTestimonials).post(protect, admin, createTestimonial);
router.route('/admin/all').get(protect, admin, getAllTestimonials);
router.route('/:id').get(getTestimonialById).put(protect, admin, updateTestimonial).delete(protect, admin, deleteTestimonial);

export default router;
