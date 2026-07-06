import asyncHandler from 'express-async-handler';
import Booking from '../models/Booking.js';
import Service from '../models/Service.js';
import Promotion from '../models/Promotion.js';
import User from '../models/User.js';
import recordTransaction from '../utils/walletHelper.js';

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30',
];

const WALLET_DISCOUNT_RATES = { 2: 0.1, 3: 0.12, 4: 0.15, 5: 0.2 };

const getAvailableSlots = asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!date) {
    res.status(400);
    throw new Error('Date is required');
  }
  const booked = await Booking.find({
    bookingDate: date,
    status: { $in: ['Pending', 'Confirmed'] },
  }).select('bookingTime');
  const occupied = booked.map((b) => b.bookingTime);
  const slots = TIME_SLOTS.map((time) => ({
    time,
    available: !occupied.includes(time),
  }));
  res.json({ success: true, slots });
});

const createBooking = asyncHandler(async (req, res) => {
  const { serviceId, promotionId, bookingDate, bookingTime, notes, payFromWallet, splitPayment } = req.body;

  let price;
  let name;
  let bookingType = 'service';
  let serviceRef = null;
  let promotionRef = null;

  if (promotionId) {
    const promotion = await Promotion.findById(promotionId);
    if (!promotion) {
      res.status(404);
      throw new Error('Promotion not found');
    }
    price = +(promotion.originalPrice * (1 - promotion.discount / 100)).toFixed(2);
    name = promotion.title;
    bookingType = 'promotion';
    promotionRef = promotion._id;
  } else {
    const service = await Service.findById(serviceId);
    if (!service) {
      res.status(404);
      throw new Error('Service not found');
    }
    price = service.price;
    name = service.name;
    serviceRef = service._id;
  }

  const existing = await Booking.findOne({
    userId: req.user._id,
    bookingDate,
    bookingTime,
    status: { $in: ['Pending', 'Confirmed'] },
  });
  if (existing) {
    res.status(400);
    throw new Error('You already have a booking at this time');
  }

  const slotTaken = await Booking.findOne({
    bookingDate,
    bookingTime,
    status: { $in: ['Pending', 'Confirmed'] },
  });
  if (slotTaken) {
    res.status(400);
    throw new Error('This time slot is already booked');
  }

  let paymentMethod = 'cash';
  if (splitPayment) {
    paymentMethod = 'split';
  } else if (payFromWallet) {
    paymentMethod = 'wallet';
  }

  const booking = await Booking.create({
    userId: req.user._id,
    serviceId: serviceRef,
    promotionId: promotionRef,
    bookingType,
    serviceName: name,
    bookingDate,
    bookingTime,
    price,
    notes: notes || '',
    paidFromWallet: false,
    paidFromBalance: 0,
    paidFromBonus: 0,
    paymentMethod,
  });

  res.status(201).json({ success: true, booking });
});

const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ userId: req.user._id })
    .populate('serviceId', 'name category image duration')
    .populate('promotionId', 'title image discount originalPrice')
    .populate('cancelledBy', 'name userId')
    .sort({ bookingDate: -1, bookingTime: 1 });
  res.json({ success: true, count: bookings.length, bookings });
});

const cancelBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }
  if (booking.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized');
  }
  if (booking.status === 'Completed' || booking.status === 'Cancelled') {
    res.status(400);
    throw new Error('Cannot cancel this booking');
  }
  const { reason } = req.body;
  if (!reason || !reason.trim()) {
    res.status(400);
    throw new Error('A cancellation reason is required');
  }
  booking.status = 'Cancelled';
  booking.cancellationReason = reason.trim();
  booking.cancelledBy = req.user._id;
  booking.cancelledByRole = req.user.role;
  booking.cancelledAt = new Date();
  await booking.save();

  res.json({ success: true, message: 'Booking cancelled', booking });
});

const getAllBookings = asyncHandler(async (req, res) => {
  const { status, date } = req.query;
  const filter = {};
  if (status && status !== 'All') filter.status = status;
  if (date) filter.bookingDate = date;
  const bookings = await Booking.find(filter)
    .populate('userId', 'name userId phone')
    .populate('serviceId', 'name category image')
    .populate('promotionId', 'title image discount originalPrice')
    .populate('cancelledBy', 'name userId')
    .sort({ bookingDate: -1, bookingTime: 1 });
  res.json({ success: true, count: bookings.length, bookings });
});

const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  const wasCancelled = booking.status === 'Cancelled';
  const previousStatus = booking.status;

  if (status === 'Cancelled') {
    if (!reason || !reason.trim()) {
      res.status(400);
      throw new Error('A cancellation reason is required');
    }
    booking.cancellationReason = reason.trim();
    booking.cancelledBy = req.user._id;
    booking.cancelledByRole = req.user.role;
    booking.cancelledAt = new Date();

    if (!wasCancelled && booking.paidFromWallet) {
      const user = await User.findById(booking.userId);
      if (user) {
        const refundBalance = booking.paidFromBalance || 0;
        const refundBonus = booking.paidFromBonus || 0;
        const refundAmount = refundBalance + refundBonus > 0 ? refundBalance + refundBonus : booking.price;
        if (refundBalance + refundBonus > 0) {
          user.walletBalance += refundBalance;
          user.walletBonus += refundBonus;
        } else {
          user.walletBalance += booking.price;
        }
        await user.save();
        await recordTransaction(
          user._id,
          'REFUND',
          refundAmount,
          `Refund for cancelled booking - ${booking.serviceName}`,
          user.walletBalance + user.walletBonus
        );
        booking.paidFromWallet = false;
        booking.paidFromBalance = 0;
        booking.paidFromBonus = 0;
      }
    }
  }

  if (
    status === 'Completed' &&
    previousStatus !== 'Completed' &&
    !booking.paidFromWallet &&
    booking.paymentMethod &&
    booking.paymentMethod !== 'cash'
  ) {
    const user = await User.findById(booking.userId);
    if (user) {
      if (booking.paymentMethod === 'split') {
        const bonusRate = user.customerRanking === 1 ? 0.3 : 0.5;
        const bonusCap = Math.round(booking.price * bonusRate * 100) / 100;
        if (user.customerRanking === 1 && user.walletBonus < bonusCap) {
          res.status(400);
          throw new Error('Insufficient wallet bonus. 30% bonus coverage is required for 1-star split payment');
        }
        const fromBonus = Math.min(user.walletBonus, bonusCap);
        const fromBalance = +(booking.price - fromBonus).toFixed(2);
        if (user.walletBalance < fromBalance) {
          res.status(400);
          throw new Error('Insufficient wallet balance for split payment');
        }
        user.walletBalance -= fromBalance;
        user.walletBonus -= fromBonus;
        await user.save();
        booking.paidFromWallet = true;
        booking.paidFromBalance = fromBalance;
        booking.paidFromBonus = fromBonus;
        await recordTransaction(
          user._id,
          'BOOKING_PAYMENT',
          -booking.price,
          `Booking payment (RM${fromBalance} balance + RM${fromBonus} bonus) for ${booking.serviceName}`,
          user.walletBalance + user.walletBonus
        );
      } else if (booking.paymentMethod === 'wallet') {
        const walletDiscountRate =
          booking.bookingType === 'promotion' ? 0 : WALLET_DISCOUNT_RATES[user.customerRanking] || 0;
        const amountToPay = Math.round(booking.price * (1 - walletDiscountRate) * 100) / 100;
        if (user.walletBalance < amountToPay) {
          res.status(400);
          throw new Error('Insufficient wallet balance');
        }
        user.walletBalance -= amountToPay;
        await user.save();
        booking.paidFromWallet = true;
        booking.paidFromBalance = amountToPay;
        booking.paidFromBonus = 0;
        await recordTransaction(
          user._id,
          'BOOKING_PAYMENT',
          -amountToPay,
          walletDiscountRate > 0
            ? `Booking payment for ${booking.serviceName} (${Math.round(walletDiscountRate * 100)}% ${user.customerRanking}-star wallet discount applied)`
            : `Booking payment for ${booking.serviceName}`,
          user.walletBalance + user.walletBonus
        );
      }
    }
  }

  booking.status = status;
  await booking.save();
  res.json({ success: true, booking });
});

const deleteBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    res.status(404);
    throw new Error('Booking not found');
  }

  if (booking.paidFromWallet && booking.status !== 'Cancelled') {
    const user = await User.findById(booking.userId);
    if (user) {
      const refundBalance = booking.paidFromBalance || 0;
      const refundBonus = booking.paidFromBonus || 0;
      const refundAmount = refundBalance + refundBonus > 0 ? refundBalance + refundBonus : booking.price;
      if (refundBalance + refundBonus > 0) {
        user.walletBalance += refundBalance;
        user.walletBonus += refundBonus;
      } else {
        user.walletBalance += booking.price;
      }
      await user.save();
        await recordTransaction(
          user._id,
          'REFUND',
          refundAmount,
          `Refund for deleted booking - ${booking.serviceName}`,
          user.walletBalance + user.walletBonus
        );
    }
  }

  await booking.deleteOne();
  res.json({ success: true, message: 'Booking deleted' });
});

export {
  TIME_SLOTS,
  getAvailableSlots,
  createBooking,
  getMyBookings,
  cancelBooking,
  getAllBookings,
  updateBookingStatus,
  deleteBooking,
};
