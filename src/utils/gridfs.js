import mongoose from 'mongoose';
import { Readable } from 'stream';

let bucket = null;

const getBucket = () => {
  if (!bucket) {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB connection not ready');
    }
    const db = mongoose.connection.db;
    bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: 'fs' });
  }
  return bucket;
};

const toObjectId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    if (!/^[0-9a-fA-F]{24}$/.test(value)) return null;
    return new mongoose.Types.ObjectId(value);
  }
  return value;
};

const uploadFileFromBuffer = (buffer, filename, contentType, metadata = {}) => {
  return new Promise((resolve, reject) => {
    const b = getBucket();
    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);
    const uploadStream = b.openUploadStream(filename, {
      contentType,
      metadata: { uploadedAt: new Date(), ...metadata },
    });
    readableStream
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => resolve(uploadStream.id));
  });
};

const deleteFileById = async (fileId) => {
  const id = toObjectId(fileId);
  if (!id) return;
  try {
    await getBucket().delete(id);
  } catch (err) {
    if (err && /FileNotFound/i.test(err.message)) return;
    console.error('Failed to delete GridFS file:', err.message);
  }
};

const findFileById = async (fileId) => {
  const id = toObjectId(fileId);
  if (!id) return null;
  const files = await getBucket().find({ _id: id }).limit(1).toArray();
  return files[0] || null;
};

const openDownloadStream = (fileId) => {
  const id = toObjectId(fileId);
  return getBucket().openDownloadStream(id);
};

const AVATAR_PATH_PREFIX = '/uploads/avatar/';

const extractAvatarId = (imagePath) => {
  if (!imagePath || typeof imagePath !== 'string') return null;
  if (!imagePath.startsWith(AVATAR_PATH_PREFIX)) return null;
  const id = imagePath.slice(AVATAR_PATH_PREFIX.length).split(/[/?#]/)[0];
  return /^[0-9a-fA-F]{24}$/.test(id) ? id : null;
};

const isAvatarPath = (imagePath) =>
  !!imagePath && typeof imagePath === 'string' && imagePath.startsWith(AVATAR_PATH_PREFIX);

const serveAvatar = async (req, res) => {
  const fileId = req.params.id;
  if (!/^[0-9a-fA-F]{24}$/.test(fileId)) {
    res.status(400);
    throw new Error('Invalid avatar file id');
  }
  const file = await findFileById(fileId);
  if (!file) {
    res.status(404);
    throw new Error('Avatar not found');
  }
  res.set('Content-Type', file.contentType || 'application/octet-stream');
  res.set('Content-Length', file.length);
  res.set('Cache-Control', 'public, max-age=86400');
  openDownloadStream(fileId).on('error', () => {
    if (!res.headersSent) res.status(500).end();
  }).pipe(res);
};

export {
  getBucket,
  uploadFileFromBuffer,
  deleteFileById,
  findFileById,
  openDownloadStream,
  extractAvatarId,
  isAvatarPath,
  serveAvatar,
  AVATAR_PATH_PREFIX,
};
