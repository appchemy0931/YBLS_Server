import express from 'express';
import {
  getRankingInfo,
  requestRanking,
  getAllRequests,
  approveRequest,
  rejectRequest,
} from '../controllers/rankingController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getRankingInfo);
router.post('/purchase', protect, requestRanking);

router.get('/requests', protect, admin, getAllRequests);
router.put('/requests/:id/approve', protect, admin, approveRequest);
router.put('/requests/:id/reject', protect, admin, rejectRequest);

export default router;
