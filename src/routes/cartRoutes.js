import express from 'express';
import { protect } from '../middleware/auth.js';
import { getCart, saveCart, clearCart } from '../controllers/cartController.js';

const router = express.Router();

router.get('/my', protect, getCart);
router.put('/', protect, saveCart);
router.delete('/', protect, clearCart);

export default router;
