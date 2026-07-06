import asyncHandler from 'express-async-handler';
import User from '../models/User.js';
import Service from '../models/Service.js';
import Booking from '../models/Booking.js';
import RankingPurchase from '../models/RankingPurchase.js';
import Order from '../models/Order.js';
import Coupon from '../models/Coupon.js';
import WalletTransaction from '../models/WalletTransaction.js';
import Referral from '../models/Referral.js';
import Promotion from '../models/Promotion.js';

const buildDateFilter = (from, to) => {
  const filter = {};
  if (from) filter.$gte = new Date(from);
  if (to) {
    const endOfDay = new Date(to);
    endOfDay.setUTCHours(23, 59, 59, 999);
    filter.$lte = endOfDay;
  }
  return filter;
};

const getDashboardStats = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const hasRange = Boolean(from || to);
  const createdAtFilter = hasRange ? { createdAt: buildDateFilter(from, to) } : {};

  const totalUsers = await User.countDocuments({ role: 'customer' });
  const totalServices = await Service.countDocuments();
  const rankingRevenueMatch = { status: 'Approved' };
  if (hasRange) rankingRevenueMatch.createdAt = createdAtFilter.createdAt;

  const revenueFromRanking = await RankingPurchase.aggregate([
    { $match: rankingRevenueMatch },
    { $group: { _id: null, total: { $sum: '$price' } } },
  ]);

  const rankingRevenue = revenueFromRanking[0]?.total || 0;
  const totalBookings = await Booking.countDocuments(hasRange ? createdAtFilter : {});
  const totalOrders = await Order.countDocuments(hasRange ? createdAtFilter : {});
  const totalCoupons = await Coupon.countDocuments();

  const pendingBookings = await Booking.countDocuments({ status: 'Pending' });
  const confirmedBookings = await Booking.countDocuments({ status: 'Confirmed' });
  const completedBookings = await Booking.countDocuments({ status: 'Completed' });

  const bookingRevenueMatch = { status: { $in: ['Confirmed', 'Completed'] }, paidFromWallet: true };
  if (hasRange) bookingRevenueMatch.createdAt = createdAtFilter.createdAt;

  const revenueFromBookings = await Booking.aggregate([
    { $match: bookingRevenueMatch },
    { $group: { _id: null, total: { $sum: '$price' } } },
  ]);

  const orderRevenueMatch = { status: { $in: ['Paid', 'Shipped', 'Delivered'] } };
  if (hasRange) orderRevenueMatch.createdAt = createdAtFilter.createdAt;

  const revenueFromOrders = await Order.aggregate([
    { $match: orderRevenueMatch },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);

  const bookingRevenue = revenueFromBookings[0]?.total || 0;
  const orderRevenue = revenueFromOrders[0]?.total || 0;

  const recentBookings = await Booking.find()
    .populate('userId', 'name userId')
    .populate('serviceId', 'name')
    .sort({ createdAt: -1 })
    .limit(5);

  const recentOrders = await Order.find()
    .populate('userId', 'name userId')
    .sort({ createdAt: -1 })
    .limit(5);

  res.json({
    success: true,
    stats: {
      totalUsers,
      totalServices,
      rankingRevenue,
      totalBookings,
      totalOrders,
      totalCoupons,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      bookingRevenue,
      orderRevenue,
      totalRevenue: bookingRevenue + orderRevenue,
    },
    range: hasRange ? { from: from || null, to: to || null } : null,
    recentBookings,
    recentOrders,
  });
});

const getAllUsers = asyncHandler(async (req, res) => {
  const { role } = req.query;
  const filter = {};
  if (role && role !== 'All') filter.role = role;
  const users = await User.find(filter)
    .select('-password')
    .sort({ createdAt: -1 });
  res.json({ success: true, count: users.length, users });
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  const bookings = await Booking.find({ userId: user._id }).populate('serviceId', 'name').sort({ createdAt: -1 });
  const orders = await Order.find({ userId: user._id }).sort({ createdAt: -1 });
  const transactions = await WalletTransaction.find({ userId: user._id }).sort({ date: -1 });
  const referrals = await Referral.find({ inviterUserId: user._id }).populate('newUserId', 'name userId');
  res.json({ success: true, user, bookings, orders, transactions, referrals });
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  user.name = req.body.name || user.name;
  user.email = req.body.email || user.email;
  user.phone = req.body.phone || user.phone;
  user.role = req.body.role || user.role;
  user.isActive = req.body.isActive !== undefined ? req.body.isActive : user.isActive;
  if (req.body.walletBalance !== undefined) user.walletBalance = req.body.walletBalance;
  if (req.body.walletBonus !== undefined) user.walletBonus = req.body.walletBonus;
  const updated = await user.save();
  res.json({ success: true, user: updated });
});

const changeUserPassword = asyncHandler(async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters');
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: 'Password updated successfully' });
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  if (user.role === 'admin') {
    res.status(400);
    throw new Error('Cannot delete admin user');
  }
  await user.deleteOne();
  res.json({ success: true, message: 'User deleted' });
});

const getReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const hasRange = Boolean(from || to);
  const createdAtFilter = hasRange ? { createdAt: buildDateFilter(from, to) } : {};

  const completedServiceBookings = await Booking.find({
    status: 'Completed',
    bookingType: 'service',
    ...(hasRange ? createdAtFilter : {}),
  })
    .populate('userId', 'name userId email phone')
    .populate('serviceId', 'name category price')
    .sort({ createdAt: -1 });

  const completedPromotionBookings = await Booking.find({
    status: 'Completed',
    bookingType: 'promotion',
    ...(hasRange ? createdAtFilter : {}),
  })
    .populate('userId', 'name userId email phone')
    .populate('promotionId', 'title discount originalPrice')
    .sort({ createdAt: -1 });

  const paidOrders = await Order.find({
    status: 'Paid',
    ...(hasRange ? createdAtFilter : {}),
  })
    .populate('userId', 'name userId email phone')
    .sort({ createdAt: -1 });

  const rankingPurchases = await RankingPurchase.find({
    status: 'Approved',
    ...(hasRange ? createdAtFilter : {}),
  })
    .populate('userId', 'name userId email phone')
    .populate('reviewedBy', 'name userId')
    .sort({ createdAt: -1 });

  const serviceRevenue = completedServiceBookings.reduce((sum, b) => sum + (b.price || 0), 0);
  const promotionRevenue = completedPromotionBookings.reduce((sum, b) => sum + (b.price || 0), 0);
  const orderRevenue = paidOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const rankingRevenue = rankingPurchases.reduce((sum, r) => sum + (r.price || 0), 0);

  res.json({
    success: true,
    range: hasRange ? { from: from || null, to: to || null } : null,
    summary: {
      completedServiceBookings: completedServiceBookings.length,
      completedPromotionBookings: completedPromotionBookings.length,
      paidOrders: paidOrders.length,
      rankingPurchases: rankingPurchases.length,
      serviceRevenue,
      promotionRevenue,
      orderRevenue,
      rankingRevenue,
      totalRevenue: serviceRevenue + promotionRevenue + orderRevenue + rankingRevenue,
    },
    completedServiceBookings,
    completedPromotionBookings,
    paidOrders,
    rankingPurchases,
  });
});

export { getDashboardStats, getAllUsers, getUserById, updateUser, changeUserPassword, deleteUser, getReport };
