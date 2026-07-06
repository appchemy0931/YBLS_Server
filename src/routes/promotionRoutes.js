import express from 'express';
import {
  getPromotions,
  getPromotionById,
  createPromotion,
  updatePromotion,
  deletePromotion,
} from '../controllers/promotionController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

router.route('/').get(getPromotions).post(protect, admin, createPromotion);
router.route('/:id').get(getPromotionById).put(protect, admin, updatePromotion).delete(protect, admin, deletePromotion);

export default router;
