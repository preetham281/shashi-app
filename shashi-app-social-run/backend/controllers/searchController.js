const User = require('../models/User');
const Reel = require('../models/Reel');
const Message = require('../models/Message');
const Group = require('../models/Group');
const Post = require('../models/Post');

exports.searchAll = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const actor = await User.findById(req.user.id).select('username');
    const username = actor ? actor.username : '';
    if(!q) return res.json({ users: [], groups: [], content: [], reels: [], chats: [] });

    const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({
      $or: [{ username: pattern }, { email: pattern }]
    }).select('username profilePhoto online privacy').limit(20);

    const reels = await Reel.find({
      $or: [{ username: pattern }, { caption: pattern }]
    }).sort({ createdAt: -1 }).limit(20);

    const groups = await Group.find({
      $or: [{ name: pattern }, { description: pattern }, { members: pattern }]
    }).sort({ createdAt: -1 }).limit(20);

    const posts = await Post.find({
      $or: [{ username: pattern }, { caption: pattern }, { hashtags: pattern }]
    }).sort({ createdAt: -1 }).limit(20);

    const chatFilter = username
      ? {
          $and: [
            { $or: [{ sender: username }, { receiver: username }] },
            { $or: [{ text: pattern }, { sender: pattern }, { receiver: pattern }, { fileName: pattern }] }
          ]
        }
      : { $or: [{ text: pattern }, { sender: pattern }, { receiver: pattern }, { fileName: pattern }] };

    const chats = await Message.find(chatFilter).sort({ createdAt: -1 }).limit(20);

    res.json({ users, groups, content: posts, reels, chats });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};
