const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  username: String,
  text: String
}, {
  timestamps: true
});

const postSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true
  },
  caption: {
    type: String,
    default: ''
  },
  mediaUrl: {
    type: String,
    default: ''
  },
  mediaType: {
    type: String,
    enum: ['image', 'video', 'none'],
    default: 'none'
  },
  fileType: {
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

module.exports = mongoose.model('Post', postSchema);
