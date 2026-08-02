import asyncHandler from 'express-async-handler';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';

const toCartItem = (item) => {
  const product = item.productId;
  const weightLabel = item.weightLabel || '';
  const weightVariant = product?.weights?.find((w) => w.label === weightLabel) || null;

  return {
    product,
    qty: item.qty,
    ...(weightVariant ? { weightVariant } : {}),
  };
};

const getCart = asyncHandler(async (req, res) => {
  let cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');

  if (!cart) {
    return res.json({ success: true, cart: [] });
  }

  // Remove invalid items (deleted products or weight labels that no longer exist)
  const validItems = cart.items.filter((item) => {
    const product = item.productId;
    if (!product) return false;
    const weightLabel = item.weightLabel || '';
    if (weightLabel && !product.weights?.some((w) => w.label === weightLabel)) return false;
    return true;
  });

  if (validItems.length !== cart.items.length) {
    cart.items = validItems;
    await cart.save();
  }

  res.json({ success: true, cart: validItems.map(toCartItem) });
});

const saveCart = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    res.status(400);
    throw new Error('Invalid cart items');
  }

  const sanitizedItems = [];
  for (const item of items) {
    if (!item.productId || !item.qty || item.qty < 1) continue;
    const product = await Product.findById(item.productId);
    if (!product) continue;
    const weightLabel = item.weightLabel || '';
    if (weightLabel && !product.weights?.some((w) => w.label === weightLabel)) continue;
    sanitizedItems.push({ productId: product._id, qty: item.qty, weightLabel });
  }

  if (sanitizedItems.length === 0) {
    await Cart.findOneAndDelete({ userId: req.user._id });
    return res.json({ success: true, cart: [] });
  }

  const cart = await Cart.findOneAndUpdate(
    { userId: req.user._id },
    { userId: req.user._id, items: sanitizedItems },
    { new: true, upsert: true }
  ).populate('items.productId');

  res.json({ success: true, cart: cart.items.map(toCartItem) });
});

const clearCart = asyncHandler(async (req, res) => {
  await Cart.findOneAndDelete({ userId: req.user._id });
  res.json({ success: true, cart: [] });
});

export { getCart, saveCart, clearCart };
