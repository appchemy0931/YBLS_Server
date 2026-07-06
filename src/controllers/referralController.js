import asyncHandler from 'express-async-handler';
import QRCode from 'qrcode';
import User from '../models/User.js';
import Referral from '../models/Referral.js';

const getReferralInfo = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const referralCode = user.referralCode;
  const referralUrl = `${process.env.APP_URL || 'https://ybls.com'}/register?ref=${referralCode}`;

  const level1Users = await User.find({ referredBy: referralCode })
    .select('name userId referralCode createdAt')
    .sort({ createdAt: -1 });

  const level1Codes = level1Users.map((u) => u.referralCode);
  const level2Users = level1Codes.length
    ? await User.find({ referredBy: { $in: level1Codes } })
        .select('name userId referralCode createdAt')
        .sort({ createdAt: -1 })
    : [];

  const level2Codes = level2Users.map((u) => u.referralCode);
  const level3Users = level2Codes.length
    ? await User.find({ referredBy: { $in: level2Codes } })
        .select('name userId referralCode createdAt')
        .sort({ createdAt: -1 })
    : [];

  const rewardRecords = await Referral.find({ inviterUserId: user._id });
  const rewardByUser = new Map();
  for (const r of rewardRecords) {
    const key = r.newUserId.toString();
    rewardByUser.set(key, (rewardByUser.get(key) || 0) + r.reward);
  }

  const buildEntry = (child, level) => ({
    _id: child._id,
    inviterUserId: user._id,
    newUserId: { _id: child._id, name: child.name, userId: child.userId },
    referralCode,
    level,
    reward: rewardByUser.get(child._id.toString()) || 0,
    createdAt: child.createdAt,
  });

  const referrals = [
    ...level1Users.map((u) => buildEntry(u, 1)),
    ...level2Users.map((u) => buildEntry(u, 2)),
    ...level3Users.map((u) => buildEntry(u, 3)),
  ];

  const totalReward = rewardRecords.reduce((sum, r) => sum + r.reward, 0);

  res.json({
    success: true,
    referralCode,
    referralUrl,
    stats: {
      level1: level1Users.length,
      level2: level2Users.length,
      level3: level3Users.length,
      totalReferrals: referrals.length,
      totalReward,
    },
    referrals,
    directReferrals: referrals.filter((r) => r.level === 1),
  });
});

const getReferralQRCode = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const referralUrl = `${process.env.APP_URL || 'https://ybls.com'}/register?ref=${user.referralCode}`;
  const qrDataUrl = await QRCode.toDataURL(referralUrl, {
    width: 300,
    margin: 2,
    color: { dark: '#9B6B43', light: '#FFF8F3' },
  });
  res.json({ success: true, referralUrl, qrCode: qrDataUrl, referralCode: user.referralCode });
});

const getAllReferrals = asyncHandler(async (req, res) => {
  const referrals = await Referral.find()
    .populate('inviterUserId', 'name userId')
    .populate('newUserId', 'name userId')
    .sort({ createdAt: -1 });
  res.json({ success: true, count: referrals.length, referrals });
});

export { getReferralInfo, getReferralQRCode, getAllReferrals };
