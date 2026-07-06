import express from 'express';
import { getReferralInfo, getReferralQRCode, getAllReferrals } from '../controllers/referralController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

router.get('/', protect, getReferralInfo);
router.get('/qrcode', protect, getReferralQRCode);
router.get('/all', protect, admin, getAllReferrals);

export default router;
