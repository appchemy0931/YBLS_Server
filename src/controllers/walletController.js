import asyncHandler from 'express-async-handler';
import WalletTransaction from '../models/WalletTransaction.js';
import User from '../models/User.js';
import recordTransaction from '../utils/walletHelper.js';

const getWalletHistory = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const filter = { userId: req.user._id };
  if (type && type !== 'All') filter.type = type;
  const transactions = await WalletTransaction.find(filter).sort({ date: -1 });
  res.json({ success: true, count: transactions.length, transactions });
});

const topUpWallet = asyncHandler(async (req, res) => {
  const { amount, method } = req.body;
  if (!amount || amount <= 0) {
    res.status(400);
    throw new Error('Invalid amount');
  }
  const user = await User.findById(req.user._id);
  user.walletBalance += amount;
  await user.save();
  await recordTransaction(
    user._id,
    'TOPUP',
    amount,
    `Wallet top-up via ${method || 'bank transfer'}`,
    user.walletBalance + user.walletBonus
  );

  res.json({
    success: true,
    message: 'Wallet topped up successfully',
    walletBalance: user.walletBalance,
  });
});

const getWalletBalance = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('walletBalance walletBonus');
  res.json({ success: true, walletBalance: user.walletBalance, walletBonus: user.walletBonus });
});

const getAllTransactions = asyncHandler(async (req, res) => {
  const { type, from, to } = req.query;
  const filter = {};
  if (type && type !== 'All') filter.type = type;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setUTCHours(23, 59, 59, 999);
      filter.date.$lte = toDate;
    }
  }
  const transactions = await WalletTransaction.find(filter)
    .populate('userId', 'name userId')
    .sort({ date: -1 });
  res.json({ success: true, count: transactions.length, transactions });
});

const deleteTransactions = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400);
    throw new Error('No transaction IDs provided');
  }
  const result = await WalletTransaction.deleteMany({ _id: { $in: ids } });
  res.json({ success: true, message: 'Transactions deleted', deletedCount: result.deletedCount });
});

export { getWalletHistory, topUpWallet, getWalletBalance, getAllTransactions, deleteTransactions };
