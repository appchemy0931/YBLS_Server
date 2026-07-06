import mongoose from 'mongoose';

const rankingPurchaseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tier: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    price: {
      type: Number,
      required: true,
    },
    tierName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected'],
      default: 'Pending',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const RankingPurchase = mongoose.model('RankingPurchase', rankingPurchaseSchema);
export default RankingPurchase;
