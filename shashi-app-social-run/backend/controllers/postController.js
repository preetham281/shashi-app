const Post = require('../models/Post');
const Notification = require('../models/Notification');

function extractTags(text){
  const value = String(text || '');
  return {
    hashtags: [...new Set((value.match(/#[a-zA-Z0-9_]+/g) || []).map((tag) => tag.slice(1).toLowerCase()))],
    mentions: [...new Set((value.match(/@[a-zA-Z0-9_]+/g) || []).map((tag) => tag.slice(1)))]
  };
}

exports.createPost = async (req, res) => {
  try {
    const { username, caption = '', mediaUrl = '', mediaType = 'none', fileType = '' } = req.body;

    if(!username){
      return res.status(400).json({ message: 'Login username is required' });
    }

    if(!caption.trim() && !mediaUrl){
      return res.status(400).json({ message: 'Write a caption or choose media' });
    }

    const post = await Post.create({
      username,
      caption,
      mediaUrl,
      mediaType: ['image', 'video', 'none'].includes(mediaType) ? mediaType : 'none',
      fileType,
      ...extractTags(caption)
    });

    res.status(201).json(post);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPosts = async (req, res) => {
  try {
    const filter = req.query.username ? { username: req.query.username } : {};
    const posts = await Post.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json(posts);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.likePost = async (req, res) => {
  try {
    const { username } = req.body;
    const post = await Post.findById(req.params.id);

    if(!post){
      return res.status(404).json({ message: 'Post not found' });
    }

    const alreadyLiked = post.likes.includes(username);
    post.likes = alreadyLiked
      ? post.likes.filter((name) => name !== username)
      : [...post.likes, username];

    await post.save();

    if(!alreadyLiked && username && username !== post.username){
      await Notification.create({
        recipient: post.username,
        sender: username,
        type: 'post_like',
        text: `${username} liked your post`
      });
    }

    res.json(post);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.commentPost = async (req, res) => {
  try {
    const { username, text } = req.body;
    const post = await Post.findById(req.params.id);

    if(!post){
      return res.status(404).json({ message: 'Post not found' });
    }

    if(!username || !String(text || '').trim()){
      return res.status(400).json({ message: 'Username and comment are required' });
    }

    post.comments.push({ username, text });
    await post.save();

    if(username !== post.username){
      await Notification.create({
        recipient: post.username,
        sender: username,
        type: 'post_comment',
        text: `${username} commented on your post`
      });
    }

    res.json(post);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};
