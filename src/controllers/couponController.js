import asyncHandler from 'express-async-handler';
import Coupon from '../models/Coupon.js';
import User from '../models/User.js';
import recordTransaction, { deductFromWallet } from '../utils/walletHelper.js';

const getCoupons = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find().sort({ amount: 1 });
  const activeCoupons = coupons.map((c) => ({
    ...c.toObject(),
    isExpired: c.expiryDate < new Date(),
  }));
  res.json({ success: true, count: activeCoupons.length, coupons: activeCoupons });
});

const getCouponById = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) {
    res.status(404);
    throw new Error('Coupon not found');
  }
  res.json({ success: true, coupon });
});

const createCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.create(req.body);
  res.status(201).json({ success: true, coupon });
});

const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) {
    res.status(404);
    throw new Error('Coupon not found');
  }
  Object.assign(coupon, req.body);
  const updated = await coupon.save();
  res.json({ success: true, coupon: updated });
});

const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) {
    res.status(404);
    throw new Error('Coupon not found');
  }
  await coupon.deleteOne();
  res.json({ success: true, message: 'Coupon deleted' });
});

const purchaseCoupon = asyncHandler(async (req, res) => {
  const { couponId } = req.body;
  const coupon = await Coupon.findById(couponId);
  if (!coupon) {
    res.status(404);
    throw new Error('Coupon not found');
  }
  if (coupon.expiryDate < new Date()) {
    res.status(400);
    throw new Error('Coupon has expired');
  }

  const user = await User.findById(req.user._id);
  const total = user.walletBalance + user.walletBonus;
  if (total < coupon.price) {
    res.status(400);
    throw new Error('Insufficient wallet balance to purchase this coupon');
  }

  deductFromWallet(user, coupon.price);
  user.walletBalance += coupon.amount;
  await user.save();

  await recordTransaction(
    user._id,
    'COUPON_PURCHASE',
    -coupon.price,
    `Purchased coupon: ${coupon.name}`,
    user.walletBalance + user.walletBonus
  );
  await recordTransaction(
    user._id,
    'TOPUP',
    coupon.amount,
    `Coupon credit: ${coupon.name}`,
    user.walletBalance + user.walletBonus
  );

  res.json({
    success: true,
    message: `Coupon purchased successfully. RM${coupon.amount} added to your wallet.`,
    walletBalance: user.walletBalance,
  });
});

export { getCoupons, getCouponById, createCoupon, updateCoupon, deleteCoupon, purchaseCoupon };
