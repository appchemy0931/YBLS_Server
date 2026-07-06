import express from 'express';
import {
  getWalletHistory,
  topUpWallet,
  getWalletBalance,
  getAllTransactions,
  deleteTransactions,
} from '../controllers/walletController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

router.get('/balance', protect, getWalletBalance);
router.post('/topup', protect, topUpWallet);
router.get('/history', protect, getWalletHistory);
router.get('/transactions', protect, admin, getAllTransactions);
router.delete('/transactions', protect, admin, deleteTransactions);

export default router;
