import express from 'express';
import {
  getDashboardStats,
  getAllUsers,
  getUserById,
  updateUser,
  changeUserPassword,
  deleteUser,
  getReport,
} from '../controllers/adminController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

router.get('/stats', protect, admin, getDashboardStats);
router.get('/users', protect, admin, getAllUsers);
router.get('/users/:id', protect, admin, getUserById);
router.put('/users/:id', protect, admin, updateUser);
router.put('/users/:id/password', protect, admin, changeUserPassword);
router.delete('/users/:id', protect, admin, deleteUser);
router.get('/report', protect, admin, getReport);

export default router;
