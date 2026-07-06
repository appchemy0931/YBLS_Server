import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema(
  {
    inviterUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    newUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    referralCode: {
      type: String,
      required: true,
    },
    level: {
      type: Number,
      required: true,
      enum: [1, 2, 3],
    },
    reward: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

const Referral = mongoose.model('Referral', referralSchema);
export default Referral;
