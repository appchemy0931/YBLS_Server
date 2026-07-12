import asyncHandler from 'express-async-handler';
import Testimonial from '../models/Testimonial.js';
import deleteImage from '../utils/deleteImage.js';

const getTestimonials = asyncHandler(async (req, res) => {
  const testimonials = await Testimonial.find({ status: 'active' }).sort({ createdAt: -1 });
  res.json({ success: true, count: testimonials.length, testimonials });
});

const getAllTestimonials = asyncHandler(async (req, res) => {
  const testimonials = await Testimonial.find({}).sort({ createdAt: -1 });
  res.json({ success: true, count: testimonials.length, testimonials });
});

const getTestimonialById = asyncHandler(async (req, res) => {
  const testimonial = await Testimonial.findById(req.params.id);
  if (!testimonial) {
    res.status(404);
    throw new Error('Testimonial not found');
  }
  res.json({ success: true, testimonial });
});

const createTestimonial = asyncHandler(async (req, res) => {
  const testimonial = await Testimonial.create(req.body);
  res.status(201).json({ success: true, testimonial });
});

const updateTestimonial = asyncHandler(async (req, res) => {
  const testimonial = await Testimonial.findById(req.params.id);
  if (!testimonial) {
    res.status(404);
    throw new Error('Testimonial not found');
  }
  if (req.body.image !== undefined && req.body.image !== testimonial.image) {
    deleteImage(testimonial.image);
  }
  Object.assign(testimonial, req.body);
  const updated = await testimonial.save();
  res.json({ success: true, testimonial: updated });
});

const deleteTestimonial = asyncHandler(async (req, res) => {
  const testimonial = await Testimonial.findById(req.params.id);
  if (!testimonial) {
    res.status(404);
    throw new Error('Testimonial not found');
  }
  deleteImage(testimonial.image);
  await testimonial.deleteOne();
  res.json({ success: true, message: 'Testimonial deleted' });
});

export {
  getTestimonials,
  getAllTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
};
