import fs from 'fs';
import path from 'path';
import { deleteFileById, isAvatarPath } from './gridfs.js';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

/**
 * Safely delete an uploaded image.
 * - GridFS avatars stored as "/uploads/avatar/<id>" are removed from the
 *   MongoDB fs.files / fs.chunks collections.
 * - Other images (disk-based, "/uploads/<filename>") are removed from disk.
 * Silently ignores missing files / invalid paths so it never breaks the request.
 */
const deleteImage = (imagePath) => {
  if (!imagePath || typeof imagePath !== 'string') return;
  if (isAvatarPath(imagePath)) {
    const id = imagePath.slice('/uploads/avatar/'.length).split(/[/?#]/)[0];
    return deleteFileById(id);
  }
  let filename = imagePath;
  if (filename.startsWith('/uploads/')) filename = filename.slice('/uploads/'.length);
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) return;
  const full = path.join(UPLOAD_DIR, filename);
  fs.unlink(full, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error(`Failed to delete image ${filename}:`, err.message);
    }
  });
};

export default deleteImage;
