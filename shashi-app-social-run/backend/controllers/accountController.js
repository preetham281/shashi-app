const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Message = require('../models/Message');
const Backup = require('../models/Backup');
const Activity = require('../models/Activity');
const { signAuthToken } = require('../utils/authToken');

function codeHash(code){
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

function makeCode(){
  return String(crypto.randomInt(100000, 1000000));
}

function strongPasswordError(password){
  const value = String(password || '');
  if(value.length < 8 || value.length > 128){
    return 'Password must be 8-128 characters.';
  }
  if(!/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(value)){
    return 'Password must include at least one letter and one number.';
  }
  return '';
}

function safeUser(user){
  const value = user.toObject ? user.toObject() : user;
  delete value.password;
  delete value.authChallenge;
  delete value.tokenVersion;
  return value;
}

function tokenFor(user){
  return signAuthToken(user);
}

async function logActivity(req, user, type, detail){
  await Activity.create({
    user: user && user._id,
    username: user && user.username,
    type,
    detail,
    ip: req.ip || ''
  });
}

async function setChallenge(user, purpose){
  const code = makeCode();
  user.authChallenge = {
    purpose,
    codeHash: codeHash(code),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0
  };
  await user.save();
  return code;
}

function challengeResponse(message, code){
  return {
    message,
    expiresInMinutes: 10,
    ...(process.env.NODE_ENV === 'production' || !code ? {} : { testingCode: code })
  };
}

async function verifyChallenge(user, purpose, code){
  const challenge = user.authChallenge || {};
  if(challenge.purpose !== purpose || !challenge.expiresAt || challenge.expiresAt < new Date()){
    return 'Code expired. Request a new code.';
  }
  if((challenge.attempts || 0) >= 5){
    return 'Too many incorrect attempts. Request a new code.';
  }
  if(challenge.codeHash !== codeHash(code)){
    user.authChallenge.attempts = (challenge.attempts || 0) + 1;
    await user.save();
    return 'Incorrect code.';
  }
  user.authChallenge = undefined;
  await user.save();
  return '';
}

exports.requestPhoneOtp = async (req, res) => {
  try {
    const phone = String(req.body.phone || '').replace(/\D/g, '');
    if(!/^[0-9]{10,15}$/.test(phone)){
      return res.status(400).json({ message: 'Enter a valid mobile number.' });
    }
    const user = await User.findOne({ phone }).select('+tokenVersion');
    if(!user) return res.json(challengeResponse('If this mobile number exists, a code was sent.', ''));
    const code = await setChallenge(user, 'phone_login');
    await logActivity(req, user, 'otp', 'Phone login code requested');
    res.json(challengeResponse('If this mobile number exists, a code was sent.', code));
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.verifyPhoneOtp = async (req, res) => {
  try {
    const phone = String(req.body.phone || '').replace(/\D/g, '');
    const user = await User.findOne({ phone }).select('+tokenVersion');
    if(!user) return res.status(404).json({ message: 'Account not found.' });
    const error = await verifyChallenge(user, 'phone_login', req.body.code);
    if(error) return res.status(400).json({ message: error });
    await logActivity(req, user, 'login', 'Phone OTP login');
    res.json({ message: 'Login successful', token: tokenFor(user), user: safeUser(user) });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.requestPasswordReset = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const user = await User.findOne({ email }).select('+tokenVersion');
    if(!user) return res.json(challengeResponse('If this email exists, a password reset code was sent.', ''));
    const code = await setChallenge(user, 'password_reset');
    await logActivity(req, user, 'password_reset', 'Password reset requested');
    res.json(challengeResponse('If this email exists, a password reset code was sent.', code));
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const passwordError = strongPasswordError(password);
    if(passwordError) return res.status(400).json({ message: passwordError });
    const user = await User.findOne({ email }).select('+tokenVersion');
    if(!user) return res.status(404).json({ message: 'Account not found.' });
    const error = await verifyChallenge(user, 'password_reset', req.body.code);
    if(error) return res.status(400).json({ message: error });
    user.password = await bcrypt.hash(password, 12);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    await logActivity(req, user, 'password_reset', 'Password changed');
    res.json({ message: 'Password reset successful.' });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateSecurity = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.twoFactorEnabled = Boolean(req.body.twoFactorEnabled);
    user.twoFactorMethod = req.body.twoFactorMethod === 'phone' ? 'phone' : 'email';
    await user.save();
    await logActivity(req, user, 'security', `2FA ${user.twoFactorEnabled ? 'enabled' : 'disabled'}`);
    res.json({ message: 'Security settings saved.', user: safeUser(user) });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.verifyTwoFactor = async (req, res) => {
  try {
    const user = await User.findById(req.body.userId).select('+tokenVersion');
    if(!user) return res.status(404).json({ message: 'Account not found.' });
    const error = await verifyChallenge(user, 'two_factor', req.body.code);
    if(error) return res.status(400).json({ message: error });
    await logActivity(req, user, 'login', 'Two-factor login');
    res.json({ message: 'Login successful', token: tokenFor(user), user: safeUser(user) });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.issueTwoFactorChallenge = setChallenge;

exports.updatePrivacy = async (req, res) => {
  try {
    const privacy = {
      profileVisibility: ['everyone', 'friends', 'private'].includes(req.body.profileVisibility) ? req.body.profileVisibility : 'everyone',
      showOnlineStatus: Boolean(req.body.showOnlineStatus),
      allowMessagesFrom: ['everyone', 'friends', 'nobody'].includes(req.body.allowMessagesFrom) ? req.body.allowMessagesFrom : 'everyone'
    };
    const user = await User.findByIdAndUpdate(req.user.id, { privacy }, { new: true }).select('-password -authChallenge');
    res.json({ message: 'Privacy settings saved.', user });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createBackup = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('username');
    const messages = await Message.find({ $or: [{ sender: user.username }, { receiver: user.username }] }).sort({ createdAt: -1 }).limit(1000).lean();
    const backup = await Backup.findOneAndUpdate(
      { user: user._id },
      { username: user.username, settings: req.body.settings || {}, messages, messageCount: messages.length },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    await logActivity(req, user, 'backup', `Backed up ${messages.length} messages`);
    res.json({ message: 'Cloud backup completed.', backup });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getBackup = async (req, res) => {
  try {
    const backup = await Backup.findOne({ user: req.user.id }).lean();
    res.json(backup || { settings: {}, messages: [], messageCount: 0 });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.reportCrash = async (req, res) => {
  try {
    const user = req.user && await User.findById(req.user.id).select('username');
    await logActivity(req, user, 'crash', String(req.body.detail || 'Unknown client error').slice(0, 1000));
    res.status(201).json({ message: 'Crash report saved.' });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getActivity = async (req, res) => {
  try {
    const activity = await Activity.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(30);
    res.json(activity);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};
