import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Service from '../models/Service.js';
import Product from '../models/Product.js';
import Coupon from '../models/Coupon.js';
import { generateReferralCode, generateUserId } from './referralCode.js';

dotenv.config();
await connectDB();

const seedData = async () => {
  try {
    await User.deleteMany();
    await Service.deleteMany();
    await Product.deleteMany();
    await Coupon.deleteMany();

    const admin = await User.create({
      userId: 'ADMIN001',
      name: 'Admin',
      email: 'admin@ybls.com',
      phone: '0100000000',
      password: 'admin123',
      role: 'admin',
      referralCode: await generateReferralCode(),
      walletBalance: 10000,
    });

    const customer = await User.create({
      userId: 'YB00001',
      name: 'Test Customer',
      email: 'customer@ybls.com',
      phone: '0123456789',
      password: 'customer123',
      role: 'customer',
      referralCode: await generateReferralCode(),
      walletBalance: 500,
      walletBonus: 100,
    });

    console.log('Users seeded:', admin.email, customer.email);

    const services = await Service.insertMany([
      { name: 'Deep Cleansing Facial Wash', category: 'Facial Wash', description: 'A refreshing deep cleanse facial that removes impurities and revitalizes your skin.', duration: 45, price: 80, status: 'active', image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600' },
      { name: 'Glow Radiance Facial Wash', category: 'Facial Wash', description: 'Brightening facial wash for a radiant glow.', duration: 30, price: 60, status: 'active', image: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600' },
      { name: 'Premium Facial Treatment', category: 'Facial Treatment', description: 'Luxury facial treatment with premium serums and masks.', duration: 90, price: 250, status: 'active', image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600' },
      { name: 'Anti-Aging Facial Treatment', category: 'Facial Treatment', description: 'Advanced anti-aging treatment to reduce fine lines.', duration: 75, price: 200, status: 'active', image: 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=600' },
      { name: 'Aromatherapy Massage', category: 'Therapy Massage', description: 'Relaxing full-body massage with essential oils.', duration: 60, price: 150, status: 'active', image: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=600' },
      { name: 'Hot Stone Therapy Massage', category: 'Therapy Massage', description: 'Therapeutic hot stone massage for deep muscle relief.', duration: 90, price: 180, status: 'active', image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600' },
      { name: 'Full Body Scrub Treatment', category: 'Body Treatment', description: 'Exfoliating body scrub with hydrating moisturizer.', duration: 60, price: 120, status: 'active', image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600' },
      { name: 'Body Detox Wrap', category: 'Body Treatment', description: 'Detoxifying body wrap for healthy glowing skin.', duration: 75, price: 160, status: 'active', image: 'https://images.unsplash.com/photo-1591343395082-e120087004b4?w=600' },
      { name: 'Advanced Skin Care Consultation', category: 'Skin Care', description: 'Personalized skin care analysis and treatment plan.', duration: 45, price: 100, status: 'active', image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600' },
      { name: 'Chemical Peel Treatment', category: 'Skin Care', description: 'Professional chemical peel for skin renewal.', duration: 60, price: 220, status: 'active', image: 'https://images.unsplash.com/photo-1571781565036-d3f759be73e4?w=600' },
      { name: 'Royal Beauty Package', category: 'Beauty Package', description: 'Complete beauty package: facial, massage, and body treatment.', duration: 180, price: 500, status: 'active', image: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=600' },
      { name: 'Bridal Beauty Package', category: 'Beauty Package', description: 'Pre-bridal complete beauty treatment package.', duration: 240, price: 800, status: 'active', image: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600' },
    ]);

    const products = await Product.insertMany([
      { name: 'Hydrating Face Serum', description: 'Deep hydration serum with hyaluronic acid for all skin types.', price: 89, stock: 50, category: 'Skincare', status: 'active', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600' },
      { name: 'Vitamin C Brightening Cream', description: 'Brightening cream enriched with Vitamin C for radiant skin.', price: 120, stock: 30, category: 'Skincare', status: 'active', image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600' },
      { name: 'Gentle Foaming Cleanser', description: 'Daily gentle cleanser for sensitive skin.', price: 45, stock: 100, category: 'Skincare', status: 'active', image: 'https://images.unsplash.com/photo-1556228852-80b6e5eeff06?w=600' },
      { name: 'Luxury Lipstick Set', description: 'Set of 5 premium matte lipsticks in nude shades.', price: 150, stock: 25, category: 'Beauty Product', status: 'active', image: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=600' },
      { name: 'Professional Makeup Brush Kit', description: '12-piece professional brush set with travel case.', price: 200, stock: 40, category: 'Beauty Product', status: 'active', image: 'https://images.unsplash.com/photo-1583241800698-9c2e0d5d2116?w=600' },
      { name: '24K Gold Eye Mask', description: 'Anti-aging gold eye masks for reducing puffiness.', price: 75, stock: 60, category: 'Beauty Product', status: 'active', image: 'https://images.unsplash.com/photo-1612817288484-6f916006741a?w=600' },
      { name: 'Hair Repair Treatment Oil', description: 'Nourishing hair oil for damaged and dry hair.', price: 65, stock: 80, category: 'Treatment Product', status: 'active', image: 'https://images.unsplash.com/photo-1626202378011-4b0bf3a99fcd?w=600' },
      { name: 'Acne Treatment Gel', description: 'Targeted acne treatment with salicylic acid.', price: 55, stock: 70, category: 'Treatment Product', status: 'active', image: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=600' },
      { name: 'Cellulite Reduction Cream', description: 'Body cream for firming and reducing cellulite.', price: 95, stock: 35, category: 'Treatment Product', status: 'active', image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=600' },
    ]);

    const coupons = await Coupon.insertMany([
      { name: 'RM50 Top-Up Coupon', amount: 50, price: 45, expiryDate: new Date('2026-12-31'), status: 'active' },
      { name: 'RM100 Top-Up Coupon', amount: 100, price: 90, expiryDate: new Date('2026-12-31'), status: 'active' },
      { name: 'RM200 Top-Up Coupon', amount: 200, price: 175, expiryDate: new Date('2026-12-31'), status: 'active' },
    ]);

    console.log('Services seeded:', services.length);
    console.log('Products seeded:', products.length);
    console.log('Coupons seeded:', coupons.length);
    console.log('\n--- Login Credentials ---');
    console.log('Admin:    admin@ybls.com / admin123');
    console.log('Customer: customer@ybls.com / customer123');

    process.exit();
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
