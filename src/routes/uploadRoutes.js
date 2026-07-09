import express from 'express';
import asyncHandler from 'express-async-handler';
import path from 'path';
import upload, { avatarUpload } from '../middleware/upload.js';
import { protect, admin } from '../middleware/auth.js';
import { uploadFileFromBuffer } from '../utils/gridfs.js';

const router = express.Router();

router.post('/', protect, admin, upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No image file provided');
  }
  res.json({ success: true, image: `/uploads/${req.file.filename}` });
}));

// Upload (or replace) avatar into MongoDB GridFS (fs.files / fs.chunks).
router.post('/avatar', protect, avatarUpload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error('No image file provided');
  }
  const ext = path.extname(req.file.originalname) || '';
  const filename = `avatar-${req.user._id}-${Date.now()}${ext}`;
  const fileId = await uploadFileFromBuffer(
    req.file.buffer,
    filename,
    req.file.mimetype,
    { userId: String(req.user._id), kind: 'avatar' }
  );
  const imagePath = `/uploads/avatar/${fileId}`;
  res.json({ success: true, image: imagePath });
}));

export default router;
