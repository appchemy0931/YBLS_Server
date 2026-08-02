import User from '../models/User.js';

const generateReferralCode = async () => {
  let code;
  let exists = true;
  while (exists) {
    code = 'BEAUTY' + Math.floor(100000 + Math.random() * 900000);
    exists = await User.exists({ referralCode: code });
  }
  return code;
};

const generateUserId = async () => {
  const count = await User.countDocuments();
  let num = count + 1;
  let exists = true;
  while (exists) {
    const userId = `YB${String(num).padStart(5, '0')}`;
    exists = await User.exists({ userId });
    if (!exists) return userId;
    num++;
  }
};

export { generateReferralCode, generateUserId };
