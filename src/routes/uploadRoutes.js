import express from 'express';
import asyncHandler from 'express-async-handler';
import upload from '../middleware/upload.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

router.post('/', protect, admin, upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No image file provided');
  }
  res.json({ success: true, image: `/uploads/${req.file.filename}` });
}));

export default router;
