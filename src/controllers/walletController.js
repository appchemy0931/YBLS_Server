import asyncHandler from 'express-async-handler';
import QRCode from 'qrcode';
import WalletTransaction from '../models/WalletTransaction.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import Order from '../models/Order.js';
import recordTransaction from '../utils/walletHelper.js';

const getWalletHistory = asyncHandler(async (req, res) => {
  const { type } = req.query;
  const filter = { userId: req.user._id };
  if (type && type !== 'All') filter.type = type;
  const transactions = await WalletTransaction.find(filter)
    .populate('referenceId')
    .sort({ date: -1 });
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
    .populate('userId', 'name userId customerRanking walletBalance walletBonus email phone')
    .populate('referenceId')
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

const getTransactionReceipt = asyncHandler(async (req, res) => {
  const tx = await WalletTransaction.findById(req.params.id);
  if (!tx) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  if (tx.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to view this receipt');
  }

  const user = await User.findById(tx.userId).select('name userId email phone customerRanking');

  const rawHex = (tx.referenceId || tx._id).toString();
  const rawNum = parseInt(rawHex.slice(-6), 16);
  const invoiceNo = String(rawNum % 900000 + 100000);
  const orderNo = String((parseInt(rawHex.slice(-4), 16) % 50) + 1).padStart(2, '0');

  const txDate = new Date(tx.date || tx.createdAt);
  const day = String(txDate.getDate()).padStart(2, '0');
  const month = String(txDate.getMonth() + 1).padStart(2, '0');
  const year = txDate.getFullYear();
  const hours = String(txDate.getHours()).padStart(2, '0');
  const mins = String(txDate.getMinutes()).padStart(2, '0');
  const formattedDate = `${day}/${month}/${year} ${hours}:${mins}`;

  const merchant = {
    name: 'Young Beauty Lovers Service',
    branch: 'Young Beauty Lovers Service - Taman Midah',
    cafeName: 'Young Beauty Lovers Service',
    shopName: 'Young Beauty Lovers Service',
    regNo: '201803414820',
    address: 'No 37, Ground Floor, Jalan Medan Midah, Taman Midah, 56000 Cheras, Kuala Lumpur, Malaysia',
    phone: '+60 11 2088 1183',
    email: 'Evonnechong0224@gmail.com',
  };

  let items = [];
  let tablePax = 'Table Pax: 1';
  let cashier = 'Amri';
  let paidBalance = Math.abs(tx.amount);
  let paidBonus = 0;
  let subtotal = Math.abs(tx.amount);
  let discount = 0;
  let serviceCharge = 0;
  let rounding = 0.00;

  if (tx.type === 'BOOKING_PAYMENT') {
    let booking = null;
    if (tx.referenceId && tx.referenceModel === 'Booking') {
      booking = await Booking.findById(tx.referenceId).populate('serviceId promotionId');
    }
    if (!booking) {
      booking = await Booking.findOne({
        userId: tx.userId,
        $or: [
          { paidFromWallet: true },
          { status: 'Completed' },
        ],
      }).sort({ createdAt: -1 });
    }

    if (booking) {
      tablePax = `Table Pax: 1`;
      paidBalance = (booking.paidFromBalance !== undefined && booking.paidFromBalance > 0) ? booking.paidFromBalance : (tx.paidFromBalance > 0 ? tx.paidFromBalance : Math.abs(tx.amount));
      paidBonus = (booking.paidFromBonus !== undefined && booking.paidFromBonus > 0) ? booking.paidFromBonus : (tx.paidFromBonus > 0 ? tx.paidFromBonus : 0);
      const originalPrice = booking.price || (paidBalance + paidBonus) || Math.abs(tx.amount);
      subtotal = originalPrice;
      discount = paidBonus > 0 ? paidBonus : (paidBalance < originalPrice ? +(originalPrice - paidBalance).toFixed(2) : 0);

      let code = 'SV01';
      if (booking.serviceId && booking.serviceId.category) {
        code = `${booking.serviceId.category.slice(0, 2).toUpperCase()}01`;
      } else if (booking.bookingType === 'promotion') {
        code = 'PR01';
      }

      items.push({
        code,
        name: (booking.serviceName || 'SV01 MTS MESOTHERAPY REPAIR ( DEEP )').toUpperCase(),
        detail: `(Slot: ${booking.bookingDate || '2026-08-14'} ${booking.bookingTime || '13:00'}) (${originalPrice.toFixed(2)}/ea)`,
        qty: 1,
        unitPrice: originalPrice,
        price: originalPrice,
      });
    } else {
      const descMatch = tx.description ? tx.description.match(/RM\s*([\d.]+)\s*balance\s*\+\s*RM\s*([\d.]+)\s*bonus/i) : null;
      if (descMatch) {
        paidBalance = parseFloat(descMatch[1]) || 0;
        paidBonus = parseFloat(descMatch[2]) || 0;
      } else {
        paidBalance = tx.paidFromBalance > 0 ? tx.paidFromBalance : Math.abs(tx.amount);
        paidBonus = tx.paidFromBonus > 0 ? tx.paidFromBonus : 0;
      }
      const originalPrice = (paidBalance + paidBonus) || Math.abs(tx.amount);
      subtotal = originalPrice;
      discount = paidBonus;

      let serviceTitle = 'SV01 MTS MESOTHERAPY REPAIR ( DEEP )';
      const match = tx.description.match(/for\s+(.*)$/i);
      if (match && match[1]) {
        serviceTitle = match[1].trim();
      }

      items.push({
        code: 'SV01',
        name: serviceTitle.toUpperCase(),
        detail: `(Slot: ${new Date(tx.date).toLocaleDateString()} 13:00) (${originalPrice.toFixed(2)}/ea)`,
        qty: 1,
        unitPrice: originalPrice,
        price: originalPrice,
      });
    }
  } else if (tx.type === 'PRODUCT_PAYMENT') {
    let order = null;
    if (tx.referenceId && tx.referenceModel === 'Order') {
      order = await Order.findById(tx.referenceId);
    }
    if (!order) {
      order = await Order.findOne({
        userId: tx.userId,
        paidFromWallet: true,
      }).sort({ createdAt: -1 });
    }

    if (order && order.items && order.items.length > 0) {
      tablePax = order.selfCollect ? 'Pickup: Self Collect' : 'Delivery';
      paidBalance = (order.paidFromBalance !== undefined && order.paidFromBalance > 0) ? order.paidFromBalance : (tx.paidFromBalance > 0 ? tx.paidFromBalance : Math.abs(tx.amount));
      paidBonus = (order.paidFromBonus !== undefined && order.paidFromBonus > 0) ? order.paidFromBonus : (tx.paidFromBonus > 0 ? tx.paidFromBonus : 0);
      items = order.items.map((it, idx) => ({
        code: `P0${idx + 1}`,
        name: it.name.toUpperCase(),
        detail: it.weightLabel ? `(${it.weightLabel}) (${Number(it.price).toFixed(2)}/ea)` : `(${Number(it.price).toFixed(2)}/ea)`,
        qty: it.qty,
        unitPrice: Number(it.price),
        price: Number(it.price) * Number(it.qty),
      }));
      subtotal = items.reduce((sum, it) => sum + it.price, 0);
      discount = paidBonus;
    } else {
      const descMatch = tx.description ? tx.description.match(/RM\s*([\d.]+)\s*balance\s*\+\s*RM\s*([\d.]+)\s*bonus/i) : null;
      if (descMatch) {
        paidBalance = parseFloat(descMatch[1]) || 0;
        paidBonus = parseFloat(descMatch[2]) || 0;
      } else {
        paidBalance = tx.paidFromBalance > 0 ? tx.paidFromBalance : Math.abs(tx.amount);
        paidBonus = tx.paidFromBonus > 0 ? tx.paidFromBonus : 0;
      }
      subtotal = (paidBalance + paidBonus) || Math.abs(tx.amount);
      discount = paidBonus;

      items.push({
        code: 'P01',
        name: 'BEAUTY PRODUCTS PURCHASE',
        detail: `(${subtotal.toFixed(2)}/ea)`,
        qty: 1,
        unitPrice: subtotal,
        price: subtotal,
      });
    }
  } else {
    items.push({
      code: 'TX01',
      name: (tx.description || 'Wallet Transaction').toUpperCase(),
      detail: `(${Math.abs(tx.amount).toFixed(2)}/ea)`,
      qty: 1,
      unitPrice: Math.abs(tx.amount),
      price: Math.abs(tx.amount),
    });
  }

  const totalQty = items.reduce((sum, it) => sum + (it.qty || 1), 0);
  const total = paidBalance > 0 ? paidBalance : Math.max(0, subtotal - discount);

  let qrCodeData = '';
  try {
    const qrUrl = `${process.env.APP_URL || 'https://ybls.com'}/receipt/${tx._id}`;
    qrCodeData = await QRCode.toDataURL(qrUrl, { margin: 1, width: 180 });
  } catch {
    qrCodeData = '';
  }

  const receipt = {
    _id: tx._id,
    type: tx.type,
    invoiceNo,
    orderNo,
    date: tx.date,
    formattedDate,
    cashier,
    tablePax,
    merchant,
    customer: {
      name: user?.name || 'Valued Customer',
      userId: user?.userId || '',
      phone: user?.phone || '',
      ranking: user?.customerRanking || 0,
    },
    items,
    summary: {
      totalQty,
      subtotal,
      discount,
      serviceCharge,
      rounding,
      total,
      paidBalance,
      paidBonus,
      paymentMethod: 'MY DEBIT',
      change: 0.00,
    },
    qrCode: qrCodeData,
  };

  res.json({ success: true, receipt });
});

export {
  getWalletHistory,
  topUpWallet,
  getWalletBalance,
  getAllTransactions,
  deleteTransactions,
  getTransactionReceipt,
};

