const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendPushToUser, getFirebaseAdmin } = require('../services/pushService');

exports.createNotification = async (req, res) => {
  try {
    const actor = await User.findById(req.user.id).select('username');
    const notification = await Notification.create({ ...req.body, sender: actor.username });
    const push = await sendPushToUser(notification.recipient, {
      title: 'shashi',
      body: notification.text,
      type: notification.type,
      sender: notification.sender
    });
    notification.pushSent = push.sent > 0;
    await notification.save();
    res.status(201).json(notification);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('username');
    if(!user || user.username !== req.params.username){
      return res.status(403).json({ message: 'You can only view your own notifications' });
    }
    const notifications = await Notification.find({
      recipient: req.params.username
    }).sort({ createdAt: -1 }).limit(50);

    res.json(notifications);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markNotificationsRead = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('username');
    if(!user || user.username !== req.params.username){
      return res.status(403).json({ message: 'You can only update your own notifications' });
    }
    await Notification.updateMany(
      { recipient: req.params.username },
      { read: true }
    );

    res.json({ message: 'Notifications marked as read' });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.registerPushToken = async (req, res) => {
  try {
    const { username, token } = req.body;
    if(!username || !token){
      return res.status(400).json({ message: 'Username and push token are required' });
    }
    const user = await User.findById(req.user.id).select('username');
    if(!user || user.username !== username){
      return res.status(403).json({ message: 'You can only register notifications for your own account' });
    }

    await User.updateOne(
      { username },
      { $addToSet: { pushTokens: token } }
    );

    res.json({ message: 'Push token saved' });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.pushStatus = async (req, res) => {
  const credentials = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_CONFIG);
  const admin = credentials ? getFirebaseAdmin() : null;
  res.json({
    firebaseAdminInstalled: Boolean(admin),
    credentials,
    credentialType: process.env.FIREBASE_CONFIG ? 'FIREBASE_CONFIG' : process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'GOOGLE_APPLICATION_CREDENTIALS' : 'none',
    message: 'Android push works after google-services.json is added to the Android app and Firebase admin credentials are set on the backend.'
  });
};
