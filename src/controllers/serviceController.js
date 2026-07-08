import asyncHandler from 'express-async-handler';
import Service from '../models/Service.js';
import deleteImage from '../utils/deleteImage.js';

const SERVICE_CATEGORIES = [
  'Facial Wash',
  'Facial Treatment',
  'Therapy Massage',
  'Body Treatment',
  'Skin Care',
  'Beauty Package',
];

const getServices = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const filter = { status: 'active' };
  if (category && category !== 'All') filter.category = category;
  const services = await Service.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, count: services.length, categories: SERVICE_CATEGORIES, services });
});

const getServiceById = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) {
    res.status(404);
    throw new Error('Service not found');
  }
  res.json({ success: true, service });
});

const createService = asyncHandler(async (req, res) => {
  const service = await Service.create(req.body);
  res.status(201).json({ success: true, service });
});

const updateService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) {
    res.status(404);
    throw new Error('Service not found');
  }
  if (req.body.image !== undefined && req.body.image !== service.image) {
    deleteImage(service.image);
  }
  Object.assign(service, req.body);
  const updated = await service.save();
  res.json({ success: true, service: updated });
});

const deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) {
    res.status(404);
    throw new Error('Service not found');
  }
  deleteImage(service.image);
  await service.deleteOne();
  res.json({ success: true, message: 'Service deleted' });
});

export { SERVICE_CATEGORIES, getServices, getServiceById, createService, updateService, deleteService };
