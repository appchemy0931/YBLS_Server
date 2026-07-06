import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Coupon name is required'],
      trim: true,
    },
    image: {
      type: String,
      default: '',
    },
    amount: {
      type: Number,
      required: [true, 'Wallet credit amount is required'],
      min: 0,
    },
    price: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: 0,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired'],
      default: 'active',
    },
  },
  { timestamps: true }
);

const Coupon = mongoose.model('Coupon', couponSchema);
export default Coupon;
