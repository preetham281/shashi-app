const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  username: String,
  text: String
}, {
  timestamps: true
});

const reelSchema = new mongoose.Schema({
  username: String,
  caption: {
    type: String,
    default: ''
  },
  hashtags: {
    type: [String],
    default: []
  },
  mentions: {
    type: [String],
    default: []
  },
  videoUrl: String,
  videoType: {
    type: String,
    default: 'video/webm'
  },
  likes: {
    type: [String],
    default: []
  },
  comments: {
    type: [commentSchema],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Reel', reelSchema);
