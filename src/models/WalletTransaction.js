import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['TOPUP', 'BOOKING_PAYMENT', 'PRODUCT_PAYMENT', 'REFUND', 'REFERRAL_BONUS', 'COUPON_PURCHASE', 'RANKING_PURCHASE', 'RANKING_BONUS', 'SIGNUP_BONUS'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    balanceAfter: {
      type: Number,
    },
    walletBalanceAfter: {
      type: Number,
    },
    walletBonusAfter: {
      type: Number,
    },
    paidFromBalance: {
      type: Number,
      default: 0,
    },
    paidFromBonus: {
      type: Number,
      default: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'referenceModel',
      default: null,
    },
    referenceModel: {
      type: String,
      enum: ['Booking', 'Order', 'RankingPurchase', null],
      default: null,
    },
  },
  { timestamps: true }
);

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);
export default WalletTransaction;
