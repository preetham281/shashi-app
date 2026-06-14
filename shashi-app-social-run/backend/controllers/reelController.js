const Reel = require('../models/Reel');
const Notification = require('../models/Notification');

function extractTags(text){
  const value = String(text || '');
  return {
    hashtags: [...new Set((value.match(/#[a-zA-Z0-9_]+/g) || []).map((tag) => tag.slice(1).toLowerCase()))],
    mentions: [...new Set((value.match(/@[a-zA-Z0-9_]+/g) || []).map((tag) => tag.slice(1)))]
  };
}

exports.createReel = async (req, res) => {
  try {
    const { username, caption, videoUrl, videoType } = req.body;

    if(!username || !videoUrl){
      return res.status(400).json({ message: 'Username and video are required' });
    }

    const reel = await Reel.create({
      username,
      caption,
      ...extractTags(caption),
      videoUrl,
      videoType
    });

    res.status(201).json(reel);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getReels = async (req, res) => {
  try {
    const reels = await Reel.find().sort({ createdAt: -1 });
    res.json(reels);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.likeReel = async (req, res) => {
  try {
    const { username } = req.body;
    const reel = await Reel.findById(req.params.id);

    if(!reel){
      return res.status(404).json({ message: 'Reel not found' });
    }

    const alreadyLiked = reel.likes.includes(username);
    reel.likes = alreadyLiked
      ? reel.likes.filter((name) => name !== username)
      : [...reel.likes, username];

    await reel.save();

    if(!alreadyLiked && username !== reel.username){
      await Notification.create({
        recipient: reel.username,
        sender: username,
        type: 'reel_like',
        text: `${username} liked your reel`
      });
    }

    res.json(reel);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.commentReel = async (req, res) => {
  try {
    const { username, text } = req.body;
    const reel = await Reel.findById(req.params.id);

    if(!reel){
      return res.status(404).json({ message: 'Reel not found' });
    }

    reel.comments.push({ username, text });
    await reel.save();

    if(username !== reel.username){
      await Notification.create({
        recipient: reel.username,
        sender: username,
        type: 'reel_comment',
        text: `${username} commented on your reel`
      });
    }

    res.json(reel);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};
