import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

/**
 * Safely delete an uploaded image file from the uploads directory.
 * Accepts either a relative path like "/uploads/file.jpg" or a bare filename.
 * Silently ignores missing files / invalid paths so it never breaks the request.
 */
const deleteImage = (imagePath) => {
  if (!imagePath || typeof imagePath !== 'string') return;
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
