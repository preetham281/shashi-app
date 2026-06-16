const User = require('../models/User');
const bcrypt = require('bcrypt');
const Activity = require('../models/Activity');
const { issueTwoFactorChallenge } = require('./accountController');
const { signAuthToken } = require('../utils/authToken');
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('ShashiDummyPassword123', 12);

function validateAuthInput({ username, email, phone, password }, mode){
  const errors = [];

  if(mode === 'signup' && !/^[a-zA-Z0-9_]{3,24}$/.test(username || '')){
    errors.push('Username must be 3-24 letters, numbers, or underscores.');
  }

  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')){
    errors.push('Valid email is required.');
  }

  if(!/^[0-9]{10,15}$/.test(phone || '')){
    errors.push('Mobile number must be 10-15 digits.');
  }

  if(!password || password.length < 8 || password.length > 128){
    errors.push('Password must be 8-128 characters.');
  }

  if(mode === 'signup' && password && !/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(password)){
    errors.push('Password must include at least one letter and one number.');
  }

  return errors;
}

exports.signup = async (req, res) => {

  try {

    const { username, email, phone, password } = req.body;
    const errors = validateAuthInput({ username, email, phone, password }, 'signup');

    if(errors.length){
      return res.status(400).json({ message: errors.join(' ') });
    }

    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username },
        { phone }
      ]
    });

    if(existingUser){
      return res.status(400).json({
        message: 'Email or username already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      username,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword
    });

    const safeUser = user.toObject();
    delete safeUser.password;
    delete safeUser.tokenVersion;

    res.status(201).json({
      message: 'Signup successful',
      user: safeUser
    });

  } catch(error){

    res.status(500).json({
      message: error.message
    });

  }

};

exports.login = async (req, res) => {

  try {

    const { email, phone, password } = req.body;
    const errors = validateAuthInput({ email, phone, password }, 'login');

    if(errors.length){
      return res.status(400).json({ message: errors.join(' ') });
    }

    const user = await User.findOne({ email: email.toLowerCase(), phone }).select('+password +tokenVersion');

    const match = await bcrypt.compare(password, user ? user.password : DUMMY_PASSWORD_HASH);

    if(!user || !match){
      return res.status(401).json({
        message: 'Invalid login details'
      });
    }

    if(user.twoFactorEnabled){
      const code = await issueTwoFactorChallenge(user, 'two_factor');
      return res.json({
        message: 'Two-factor code required.',
        requiresTwoFactor: true,
        userId: user._id,
        method: user.twoFactorMethod,
        ...(process.env.NODE_ENV === 'production' ? {} : { testingCode: code })
      });
    }

    const token = signAuthToken(user);

    await User.findByIdAndUpdate(user._id, {
      online: true,
      lastSeen: new Date()
    });

    await Activity.create({
      user: user._id,
      username: user.username,
      type: 'login',
      detail: 'Email and password login',
      ip: req.ip || ''
    });

    const safeUser = user.toObject();
    safeUser.online = true;
    delete safeUser.password;
    delete safeUser.tokenVersion;

    res.json({
      message: 'Login successful',
      token,
      user: safeUser
    });

  } catch(error){

    res.status(500).json({
      message: error.message
    });

  }

};

exports.me = async (req, res) => {

  try {

    const user = await User.findById(req.user.id).select('-password -authChallenge');

    if(!user){
      return res.status(404).json({
        message: 'User not found'
      });
    }

    res.json(user);

  } catch(error){

    res.status(500).json({
      message: error.message
    });

  }

};

exports.updateProfile = async (req, res) => {

  try {

    const { username, email, phone, about = '', bio = '' } = req.body;
    const errors = validateAuthInput({ username, email, phone, password: 'valid-password' }, 'signup');

    if(errors.length){
      return res.status(400).json({ message: errors.join(' ') });
    }

    if(!username || !email || !phone){
      return res.status(400).json({
        message: 'Username, email and mobile number are required'
      });
    }

    const existingUser = await User.findOne({
      _id: { $ne: req.user.id },
      $or: [
        { username },
        { email: email.toLowerCase() },
        { phone }
      ]
    });

    if(existingUser){
      return res.status(400).json({
        message: 'Email or username already exists'
      });
    }

    const existingCurrentUser = await User.findById(req.user.id).select('about bio');
    const nextAbout = String(about || '').trim().slice(0, 140);
    const nextBio = String(bio || '').trim().slice(0, 220);
    const aboutChanged = existingCurrentUser && existingCurrentUser.about !== nextAbout;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        username,
        email: email.toLowerCase(),
        phone,
        about: nextAbout,
        bio: nextBio,
        ...(aboutChanged ? { aboutUpdatedAt: new Date() } : {})
      },
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    res.json({
      message: 'Profile updated',
      user
    });

  } catch(error){

    res.status(500).json({
      message: error.message
    });

  }

};

exports.uploadProfilePhoto = async (req, res) => {

  try {

    if(!req.file){
      return res.status(400).json({
        message: 'Profile photo is required'
      });
    }

    const profilePhoto = `/uploads/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profilePhoto },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Profile photo updated',
      user
    });

  } catch(error){

    res.status(500).json({
      message: error.message
    });

  }

};

exports.getUsers = async (req, res) => {

  try {

    const current = await User.findById(req.user.id).select('username friends');
    const users = await User.find({ _id: { $ne: req.user.id } })
      .select('username phone profilePhoto online lastSeen friends followers following about bio aboutUpdatedAt privacy')
      .sort({ online: -1, username: 1 })
      .lean();

    res.json(users.map((user) => {
      const value = { ...user };
      const isFriend = current && (
        current.friends.includes(user.username) ||
        user.friends.includes(current.username)
      );
      if(value.privacy && value.privacy.profileVisibility === 'private' && !isFriend){
        value.about = '';
        value.bio = '';
        value.profilePhoto = '';
      }
      if(value.privacy && value.privacy.showOnlineStatus === false && !isFriend){
        value.online = false;
        delete value.lastSeen;
      }
      return value;
    }));

  } catch(error){

    res.status(500).json({
      message: error.message
    });

  }

};

exports.logout = async (req, res) => {

  try {

    await User.findByIdAndUpdate(req.user.id, {
      $set: {
        online: false,
        lastSeen: new Date()
      },
      $inc: {
        tokenVersion: 1
      }
    });

    res.json({
      message: 'Logout successful'
    });

  } catch(error){

    res.status(500).json({
      message: error.message
    });

  }

};
