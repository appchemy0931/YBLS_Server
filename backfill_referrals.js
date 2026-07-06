import dotenv from 'dotenv';
import connectDB from './src/config/db.js';
import User from './src/models/User.js';
import Referral from './src/models/Referral.js';
import WalletTransaction from './src/models/WalletTransaction.js';

dotenv.config();
await connectDB();

const REFERRAL_BONUS = 100;
const LEVEL_RATES = { 1: 0.05, 2: 0.03, 3: 0.02 };

const children = await User.find({ referredBy: { $nin: [null, ''] } });
console.log(`Found ${children.length} referred user(s) to backfill`);

let created = 0;
for (const child of children) {
  const parent = await User.findOne({ referralCode: child.referredBy });
  if (!parent) {
    console.log(`  SKIP ${child.email}: inviter code "${child.referredBy}" not found`);
    continue;
  }

  const grandparent = parent.referredBy ? await User.findOne({ referralCode: parent.referredBy }) : null;
  const greatGrandparent = grandparent && grandparent.referredBy ? await User.findOne({ referralCode: grandparent.referredBy }) : null;
  const chain = [
    { inviter: parent, level: 1 },
    { inviter: grandparent, level: 2 },
    { inviter: greatGrandparent, level: 3 },
  ];

  for (const { inviter: ancestor, level } of chain) {
    if (!ancestor) continue;
    const exists = await Referral.findOne({ inviterUserId: ancestor._id, newUserId: child._id, level });
    if (exists) continue;

    const reward = Math.round(REFERRAL_BONUS * LEVEL_RATES[level] * 100) / 100;
    if (reward <= 0) continue;

    ancestor.walletBonus += reward;
    await ancestor.save();

    await Referral.create({
      inviterUserId: ancestor._id,
      newUserId: child._id,
      referralCode: ancestor.referralCode,
      level,
      reward,
      createdAt: child.createdAt,
    });

    await WalletTransaction.create({
      userId: ancestor._id,
      type: 'REFERRAL_BONUS',
      amount: reward,
      description: `Level ${level} referral reward from ${child.name}`,
      balanceAfter: ancestor.walletBalance + ancestor.walletBonus,
      date: child.createdAt,
    });

    created++;
    console.log(`  L${level}: ${ancestor.email} <- ${child.email} (+RM${reward})`);
  }
}

console.log(`Done. Created ${created} referral record(s).`);
process.exit(0);
