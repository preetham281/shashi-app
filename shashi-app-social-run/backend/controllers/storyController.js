const Story = require('../models/Story');

exports.createStory = async (req, res) => {
  try {
    const { username, mediaUrl, mediaType, caption, backgroundColor, musicName } = req.body;
    const isTextStory = mediaType === 'text';
    if(!username) return res.status(400).json({ message: 'Username is required' });
    if(isTextStory && !String(caption || '').trim()) return res.status(400).json({ message: 'Write text for your status' });
    if(!isTextStory && !mediaUrl) return res.status(400).json({ message: 'Story media is required' });

    const story = await Story.create({
      username,
      mediaUrl: mediaUrl || '',
      mediaType: mediaType || 'image',
      caption: caption || '',
      backgroundColor: backgroundColor || '#ffffff',
      musicName: musicName || ''
    });

    res.status(201).json(story);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getStories = async (req, res) => {
  try {
    const stories = await Story.find({ expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
    res.json(stories);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.viewStory = async (req, res) => {
  try {
    const story = await Story.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { viewers: req.body.username } },
      { new: true }
    );
    if(!story) return res.status(404).json({ message: 'Story not found' });
    res.json(story);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.reactStory = async (req, res) => {
  try {
    const { username, reaction } = req.body;
    const story = await Story.findById(req.params.id);
    if(!story) return res.status(404).json({ message: 'Story not found' });

    story.reactions = story.reactions.filter((item) => item.username !== username);
    story.reactions.push({ username, reaction });
    await story.save();

    res.json(story);
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};
