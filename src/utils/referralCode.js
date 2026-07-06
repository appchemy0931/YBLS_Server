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
  return `YB${String(count + 1).padStart(5, '0')}`;
};

export { generateReferralCode, generateUserId };
