import asyncHandler from 'express-async-handler';
import Promotion from '../models/Promotion.js';

const getPromotions = asyncHandler(async (req, res) => {
  const promotions = await Promotion.find().sort({ createdAt: -1 });
  res.json({ success: true, count: promotions.length, promotions });
});

const getPromotionById = asyncHandler(async (req, res) => {
  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) {
    res.status(404);
    throw new Error('Promotion not found');
  }
  res.json({ success: true, promotion });
});

const createPromotion = asyncHandler(async (req, res) => {
  const promotion = await Promotion.create(req.body);
  res.status(201).json({ success: true, promotion });
});

const updatePromotion = asyncHandler(async (req, res) => {
  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) {
    res.status(404);
    throw new Error('Promotion not found');
  }
  Object.assign(promotion, req.body);
  const updated = await promotion.save();
  res.json({ success: true, promotion: updated });
});

const deletePromotion = asyncHandler(async (req, res) => {
  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) {
    res.status(404);
    throw new Error('Promotion not found');
  }
  await promotion.deleteOne();
  res.json({ success: true, message: 'Promotion deleted' });
});

export { getPromotions, getPromotionById, createPromotion, updatePromotion, deletePromotion };
