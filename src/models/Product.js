import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: 0,
      default: 0,
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    image: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      required: true,
      enum: ['Skincare', 'Beauty Product', 'Treatment Product'],
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    weights: {
      type: [
        {
          label: { type: String, trim: true },
          stock: { type: Number, min: 0, default: 0 },
          price: { type: Number, min: 0, default: 0 },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

const Product = mongoose.model('Product', productSchema);
export default Product;
