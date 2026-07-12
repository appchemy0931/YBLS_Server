import asyncHandler from 'express-async-handler';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import recordTransaction, { deductFromWallet } from '../utils/walletHelper.js';

const createOrder = asyncHandler(async (req, res) => {
  const { items, shippingAddress, payFromWallet } = req.body;

  if (!items || items.length === 0) {
    res.status(400);
    throw new Error('No order items');
  }

  let totalAmount = 0;
  const orderItems = [];

  for (const item of items) {
    const product = await Product.findById(item.productId);
    if (!product) {
      res.status(404);
      throw new Error(`Product not found: ${item.productId}`);
    }

    let unitPrice = product.price;
    let weightLabel = '';
    let variantStock = null;

    if (item.weightLabel && product.weights && product.weights.length > 0) {
      const weight = product.weights.find((w) => w.label === item.weightLabel);
      if (weight) {
        unitPrice = weight.price;
        weightLabel = weight.label;
        variantStock = weight.stock;
      }
    }

    const effectiveStock = variantStock !== null ? variantStock : product.stock;
    if (effectiveStock < item.qty) {
      res.status(400);
      throw new Error(`Insufficient stock for ${product.name}${weightLabel ? ` (${weightLabel})` : ''}`);
    }

    orderItems.push({
      productId: product._id,
      name: product.name,
      price: unitPrice,
      qty: item.qty,
      image: product.image,
      weightLabel,
    });
    totalAmount += unitPrice * item.qty;
  }

  let paidFromWallet = false;
  if (payFromWallet) {
    const user = await User.findById(req.user._id);
    const total = user.walletBalance + user.walletBonus;
    if (total < totalAmount) {
      res.status(400);
      throw new Error('Insufficient wallet balance');
    }
    deductFromWallet(user, totalAmount);
    await user.save();
    await recordTransaction(
      user._id,
      'PRODUCT_PAYMENT',
      -totalAmount,
      `Product order payment`,
      user.walletBalance + user.walletBonus
    );
    paidFromWallet = true;
  }

  const order = await Order.create({
    userId: req.user._id,
    items: orderItems,
    totalAmount,
    status: paidFromWallet ? 'Paid' : 'Pending',
    paidFromWallet,
    shippingAddress: shippingAddress || '',
  });

  for (const item of orderItems) {
    if (item.weightLabel) {
      await Product.updateOne(
        { _id: item.productId, 'weights.label': item.weightLabel },
        { $inc: { 'weights.$.stock': -item.qty, stock: -item.qty } }
      );
    } else {
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: -item.qty } });
    }
  }

  res.status(201).json({ success: true, order });
});

const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ userId: req.user._id })
    .populate('cancelledBy', 'name userId')
    .sort({ createdAt: -1 });
  res.json({ success: true, count: orders.length, orders });
});

const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  res.json({ success: true, order });
});

const getAllOrders = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = {};
  if (status && status !== 'All') filter.status = status;
  const orders = await Order.find(filter)
    .populate('userId', 'name userId email phone')
    .populate('cancelledBy', 'name userId')
    .sort({ createdAt: -1 });
  res.json({ success: true, count: orders.length, orders });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  const wasCancelled = order.status === 'Cancelled';

  if (status === 'Cancelled') {
    if (!reason || !reason.trim()) {
      res.status(400);
      throw new Error('A cancellation reason is required');
    }
    order.cancellationReason = reason.trim();
    order.cancelledBy = req.user._id;
    order.cancelledByRole = req.user.role;
    order.cancelledAt = new Date();

    if (!wasCancelled && order.paidFromWallet) {
      const user = await User.findById(order.userId);
      if (user) {
        user.walletBalance += order.totalAmount;
        await user.save();
        await recordTransaction(
          user._id,
          'REFUND',
          order.totalAmount,
          `Refund for cancelled order #${order._id.toString().slice(-8).toUpperCase()}`,
          user.walletBalance + user.walletBonus
        );
      }
    }
  }

  order.status = status;
  await order.save();
  res.json({ success: true, order });
});

const updateOrder = asyncHandler(async (req, res) => {
  const { status, shippingAddress, totalAmount, items, reason } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  const wasCancelled = order.status === 'Cancelled';
  const originalTotal = order.totalAmount;

  if (typeof shippingAddress === 'string') order.shippingAddress = shippingAddress;
  if (totalAmount !== undefined && totalAmount !== null && !Number.isNaN(Number(totalAmount))) {
    order.totalAmount = Number(totalAmount);
  }
  if (Array.isArray(items)) {
    order.items = items.map((it) => ({
      productId: it.productId,
      name: it.name,
      price: Number(it.price) || 0,
      qty: Number(it.qty) || 1,
      image: it.image || '',
      weightLabel: it.weightLabel || '',
    }));
  }

  if (status && status !== order.status) {
    if (status === 'Cancelled') {
      if (!reason || !reason.trim()) {
        res.status(400);
        throw new Error('A cancellation reason is required');
      }
      order.cancellationReason = reason.trim();
      order.cancelledBy = req.user._id;
      order.cancelledByRole = req.user.role;
      order.cancelledAt = new Date();

      if (!wasCancelled && order.paidFromWallet) {
        const user = await User.findById(order.userId);
        if (user) {
          user.walletBalance += originalTotal;
          await user.save();
          await recordTransaction(
            user._id,
            'REFUND',
            originalTotal,
            `Refund for cancelled order #${order._id.toString().slice(-8).toUpperCase()}`,
            user.walletBalance + user.walletBonus
          );
        }
      }
    }
    order.status = status;
  }

  const updated = await order.save();
  await updated.populate('userId', 'name userId email phone');
  await updated.populate('cancelledBy', 'name userId');
  res.json({ success: true, order: updated });
});

const deleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (order.paidFromWallet && order.status !== 'Cancelled') {
    const user = await User.findById(order.userId);
    if (user) {
      user.walletBalance += order.totalAmount;
      await user.save();
      await recordTransaction(
        user._id,
        'REFUND',
        order.totalAmount,
        `Refund for deleted order #${order._id.toString().slice(-8).toUpperCase()}`,
        user.walletBalance + user.walletBonus
      );
    }
  }

  await order.deleteOne();
  res.json({ success: true, message: 'Order deleted' });
});

export { createOrder, getMyOrders, getOrderById, getAllOrders, updateOrderStatus, updateOrder, deleteOrder };
