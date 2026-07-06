import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import RankingPurchase from '../models/RankingPurchase.js';
import recordTransaction, { distributeReferralRewards } from '../utils/walletHelper.js';

const REPEAT_RANKING_BONUS = 100;

const RANKING_TIERS = [
  { tier: 1, stars: 1, price: 600, name: 'Bronze' },
  { tier: 2, stars: 2, price: 1500, name: 'Silver' },
  { tier: 3, stars: 3, price: 3000, name: 'Gold' },
  { tier: 4, stars: 4, price: 6000, name: 'Platinum' },
  { tier: 5, stars: 5, price: 10000, name: 'Diamond' },
];

const getRankingInfo = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('customerRanking');
  const myRequests = await RankingPurchase.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20);
  res.json({
    success: true,
    currentRanking: user.customerRanking || 0,
    tiers: RANKING_TIERS,
    myRequests,
  });
});

const requestRanking = asyncHandler(async (req, res) => {
  const { tier } = req.body;
  const tierNum = Number(tier);

  const selected = RANKING_TIERS.find((t) => t.tier === tierNum);
  if (!selected) {
    res.status(400);
    throw new Error('Invalid ranking tier. Please choose a tier from 1 to 5.');
  }

  const request = await RankingPurchase.create({
    userId: req.user._id,
    tier: selected.tier,
    price: selected.price,
    tierName: selected.name,
    status: 'Pending',
  });

  res.status(201).json({
    success: true,
    message: `Your ${selected.stars}-star (${selected.name}) ranking purchase request has been submitted. It will be processed once an admin approves it.`,
    request,
  });
});

const getAllRequests = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status && status !== 'All') filter.status = status;
  const requests = await RankingPurchase.find(filter)
    .populate('userId', 'name userId email phone')
    .populate('reviewedBy', 'name userId')
    .sort({ createdAt: -1 });
  res.json({ success: true, count: requests.length, requests });
});

const approveRequest = asyncHandler(async (req, res) => {
  const request = await RankingPurchase.findById(req.params.id);
  if (!request) {
    res.status(404);
    throw new Error('Ranking purchase request not found');
  }
  if (request.status !== 'Pending') {
    res.status(400);
    throw new Error(`This request has already been ${request.status.toLowerCase()}.`);
  }

  const user = await User.findById(request.userId);
  if (!user) {
    res.status(404);
    throw new Error('Customer account not found');
  }

  const previous = user.customerRanking || 0;
  const qualifiesBonus = previous > 0 && request.tier >= 2;

  user.walletBalance += request.price;
  if (qualifiesBonus) user.walletBonus += REPEAT_RANKING_BONUS;
  user.customerRanking = Math.max(previous, request.tier);
  await user.save();

  await recordTransaction(
    user._id,
    'RANKING_PURCHASE',
    request.price,
    `Approved ${request.tier}-star (${request.tierName}) customer ranking purchase`,
    user.walletBalance + user.walletBonus
  );

  if (qualifiesBonus) {
    await recordTransaction(
      user._id,
      'RANKING_BONUS',
      REPEAT_RANKING_BONUS,
      `RM${REPEAT_RANKING_BONUS} repeat ranking bonus for ${request.tier}-star (${request.tierName}) purchase`,
      user.walletBalance + user.walletBonus
    );
  }

  await distributeReferralRewards(user, request.price, 'Level');

  request.status = 'Approved';
  request.reviewedBy = req.user._id;
  request.reviewedAt = Date.now();
  await request.save();

  res.json({
    success: true,
    message: qualifiesBonus
      ? `Request approved. RM${request.price} added to ${user.name}'s wallet, ranking set to ${request.tier}-star, plus RM${REPEAT_RANKING_BONUS} repeat ranking bonus.`
      : `Request approved. RM${request.price} added to ${user.name}'s wallet and ranking set to ${request.tier}-star.`,
    request,
  });
});

const rejectRequest = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const request = await RankingPurchase.findById(req.params.id);
  if (!request) {
    res.status(404);
    throw new Error('Ranking purchase request not found');
  }
  if (request.status !== 'Pending') {
    res.status(400);
    throw new Error(`This request has already been ${request.status.toLowerCase()}.`);
  }

  request.status = 'Rejected';
  request.rejectionReason = reason || '';
  request.reviewedBy = req.user._id;
  request.reviewedAt = Date.now();
  await request.save();

  res.json({
    success: true,
    message: 'Request rejected. No changes were made to the customer account.',
    request,
  });
});

export { getRankingInfo, requestRanking, getAllRequests, approveRequest, rejectRequest, RANKING_TIERS };
