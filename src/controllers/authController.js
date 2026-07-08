import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import { generateReferralCode, generateUserId } from '../utils/referralCode.js';
import recordTransaction from '../utils/walletHelper.js';
import deleteImage from '../utils/deleteImage.js';

const SIGNUP_BONUS = 100;

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, phone, password, referralCode } = req.body;

  if (!name || !email || !phone || !password) {
    res.status(400);
    throw new Error('Please provide all required fields');
  }

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(400);
    throw new Error('Email already registered');
  }

  const newReferralCode = await generateReferralCode();
  const userId = await generateUserId();

  const user = await User.create({
    userId,
    name,
    email,
    phone,
    password,
    referralCode: newReferralCode,
    referredBy: referralCode || null,
  });

  // New customer sign-up bonus — granted to every new customer
  user.walletBonus += SIGNUP_BONUS;
  await user.save();

  await recordTransaction(
    user._id,
    'SIGNUP_BONUS',
    SIGNUP_BONUS,
    'New customer sign-up bonus',
    user.walletBalance + user.walletBonus
  );

  res.status(201).json({
    success: true,
    _id: user._id,
    userId: user.userId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    walletBalance: user.walletBalance,
    walletBonus: user.walletBonus,
    referralCode: user.referralCode,
    customerRanking: user.customerRanking || 0,
    token: generateToken(user._id),
  });
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error('Account is deactivated');
  }

  res.json({
    success: true,
    _id: user._id,
    userId: user.userId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    walletBalance: user.walletBalance,
    walletBonus: user.walletBonus,
    referralCode: user.referralCode,
    profileImage: user.profileImage,
    customerRanking: user.customerRanking || 0,
    token: generateToken(user._id),
  });
});

const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({
    success: true,
    _id: user._id,
    userId: user.userId,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    walletBalance: user.walletBalance,
    walletBonus: user.walletBonus,
    referralCode: user.referralCode,
    referredBy: user.referredBy,
    profileImage: user.profileImage,
    customerRanking: user.customerRanking || 0,
  });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  user.name = req.body.name || user.name;
  user.phone = req.body.phone || user.phone;
  if (req.body.profileImage !== undefined && req.body.profileImage !== user.profileImage) {
    deleteImage(user.profileImage);
    user.profileImage = req.body.profileImage;
  }
  const updated = await user.save();
  res.json({
    success: true,
    _id: updated._id,
    userId: updated.userId,
    name: updated.name,
    email: updated.email,
    phone: updated.phone,
    role: updated.role,
    walletBalance: updated.walletBalance,
    walletBonus: updated.walletBonus,
    referralCode: updated.referralCode,
    profileImage: updated.profileImage,
    customerRanking: updated.customerRanking || 0,
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  if (!(await user.matchPassword(currentPassword))) {
    res.status(400);
    throw new Error('Current password is incorrect');
  }
  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: 'Password updated successfully' });
});

export { registerUser, loginUser, getProfile, updateProfile, changePassword };
