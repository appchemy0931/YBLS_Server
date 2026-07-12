import asyncHandler from 'express-async-handler';
import Product from '../models/Product.js';
import deleteImage from '../utils/deleteImage.js';

const PRODUCT_CATEGORIES = ['Skincare', 'Beauty Product', 'Treatment Product'];

const getProducts = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const filter = { status: 'active' };
  if (category && category !== 'All') filter.category = category;
  const products = await Product.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, count: products.length, categories: PRODUCT_CATEGORIES, products });
});

const getAllProducts = asyncHandler(async (req, res) => {
  const products = await Product.find({}).sort({ createdAt: -1 });
  res.json({ success: true, count: products.length, categories: PRODUCT_CATEGORIES, products });
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  res.json({ success: true, product });
});

const createProduct = asyncHandler(async (req, res) => {
  const product = await Product.create(req.body);
  res.status(201).json({ success: true, product });
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  if (req.body.image !== undefined && req.body.image !== product.image) {
    deleteImage(product.image);
  }
  Object.assign(product, req.body);
  const updated = await product.save();
  res.json({ success: true, product: updated });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }
  deleteImage(product.image);
  await product.deleteOne();
  res.json({ success: true, message: 'Product deleted' });
});

export { PRODUCT_CATEGORIES, getProducts, getAllProducts, getProductById, createProduct, updateProduct, deleteProduct };
