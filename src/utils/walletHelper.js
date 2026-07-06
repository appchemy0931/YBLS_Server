import WalletTransaction from '../models/WalletTransaction.js';
import User from '../models/User.js';
import Referral from '../models/Referral.js';

const LEVEL_RATES = { 1: 0.05, 2: 0.03, 3: 0.02 };

const recordTransaction = async (userId, type, amount, description, balanceAfter) => {
  await WalletTransaction.create({
    userId,
    type,
    amount,
    description,
    balanceAfter,
    date: Date.now(),
  });
};

const deductFromWallet = (user, amount) => {
  const fromBalance = Math.min(user.walletBalance, amount);
  const remaining = amount - fromBalance;
  const fromBonus = Math.min(user.walletBonus, remaining);
  user.walletBalance -= fromBalance;
  user.walletBonus -= fromBonus;
  return { fromBalance, fromBonus };
};

const distributeReferralRewards = async (childUser, baseAmount, descriptionPrefix = 'Level') => {
  if (!childUser.referredBy || baseAmount <= 0) return;

  const parent = await User.findOne({ referralCode: childUser.referredBy });
  if (!parent) return;

  const grandparent = parent.referredBy ? await User.findOne({ referralCode: parent.referredBy }) : null;
  const greatGrandparent =
    grandparent && grandparent.referredBy ? await User.findOne({ referralCode: grandparent.referredBy }) : null;

  const chain = [
    { inviter: parent, level: 1 },
    { inviter: grandparent, level: 2 },
    { inviter: greatGrandparent, level: 3 },
  ];

  for (const { inviter: ancestor, level } of chain) {
    if (!ancestor) continue;
    const reward = Math.round(baseAmount * LEVEL_RATES[level] * 100) / 100;
    if (reward > 0) {
      ancestor.walletBonus += reward;
      await ancestor.save();

      await Referral.create({
        inviterUserId: ancestor._id,
        newUserId: childUser._id,
        referralCode: ancestor.referralCode,
        level,
        reward,
      });

      await recordTransaction(
        ancestor._id,
        'REFERRAL_BONUS',
        reward,
        `${descriptionPrefix} ${level} referral reward from ${childUser.name}`,
        ancestor.walletBalance + ancestor.walletBonus
      );
    }
  }
};

export { deductFromWallet, distributeReferralRewards };
export default recordTransaction;
