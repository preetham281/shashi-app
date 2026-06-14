const User = require('../models/User');
const Notification = require('../models/Notification');

async function getUser(username){
  return User.findOne({ username });
}

function normalizePhone(value){
  return String(value || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
}

exports.getFriends = async (req, res) => {
  try {
    const actor = await User.findById(req.user.id).select('username');
    if(!actor || actor.username !== req.params.username) return res.status(403).json({ message: 'Access denied' });
    const user = await getUser(req.params.username);
    if(!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      friends: user.friends,
      followers: user.followers,
      following: user.following,
      friendRequests: user.friendRequests
    });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.findContacts = async (req, res) => {
  try {
    const { username, phones = [] } = req.body;
    const actor = await User.findById(req.user.id).select('username');
    if(!actor || actor.username !== username) return res.status(403).json({ message: 'Access denied' });
    const normalizedPhones = [...new Set(phones.map(normalizePhone).filter(Boolean))];
    const phoneCandidates = [...new Set(normalizedPhones.flatMap((phone) => [phone, `91${phone}`]))];
    if(normalizedPhones.length === 0){
      return res.json([]);
    }

    const users = await User.find({
      username: { $ne: username },
      phone: { $in: phoneCandidates }
    }).select('username phone profilePhoto online');

    res.json(users);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendRequest = async (req, res) => {
  try {
    const { from, to } = req.body;
    const actor = await User.findById(req.user.id).select('username');
    if(!actor || actor.username !== from) return res.status(403).json({ message: 'Access denied' });
    if(!from || !to || from === to) return res.status(400).json({ message: 'Invalid friend request' });

    const sender = await getUser(from);
    const receiver = await getUser(to);
    if(!sender || !receiver) return res.status(404).json({ message: 'User not found' });

    await User.updateOne({ username: to }, { $addToSet: { friendRequests: from, followers: from } });
    await User.updateOne({ username: from }, { $addToSet: { following: to } });
    await Notification.create({
      recipient: to,
      sender: from,
      type: 'friend_request',
      text: `${from} sent you a friend request`
    });

    res.json({ message: 'Friend request sent' });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.acceptRequest = async (req, res) => {
  try {
    const { username, requester } = req.body;
    const actor = await User.findById(req.user.id).select('username');
    if(!actor || actor.username !== username) return res.status(403).json({ message: 'Access denied' });
    if(!username || !requester) return res.status(400).json({ message: 'Invalid request' });

    await User.updateOne(
      { username },
      { $pull: { friendRequests: requester }, $addToSet: { friends: requester, followers: requester } }
    );
    await User.updateOne(
      { username: requester },
      { $addToSet: { friends: username, following: username } }
    );
    await Notification.create({
      recipient: requester,
      sender: username,
      type: 'friend_accept',
      text: `${username} accepted your friend request`
    });

    res.json({ message: 'Friend request accepted' });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.removeFriend = async (req, res) => {
  try {
    const { username, friend } = req.body;
    const actor = await User.findById(req.user.id).select('username');
    if(!actor || actor.username !== username) return res.status(403).json({ message: 'Access denied' });
    if(!username || !friend) return res.status(400).json({ message: 'Invalid friend' });

    await User.updateOne({ username }, {
      $pull: { friends: friend, following: friend, followers: friend, friendRequests: friend }
    });
    await User.updateOne({ username: friend }, {
      $pull: { friends: username, following: username, followers: username, friendRequests: username }
    });

    res.json({ message: 'Friend removed' });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};
