const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  username: String,
  mediaUrl: String,
  mediaType: {
    type: String,
    default: 'image'
  },
  caption: {
    type: String,
    default: ''
  },
  backgroundColor: {
    type: String,
    default: '#ffffff'
  },
  musicName: {
    type: String,
    default: ''
  },
  viewers: {
    type: [String],
    default: []
  },
  reactions: {
    type: [{
      username: String,
      reaction: String
    }],
    default: []
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    index: { expires: 0 }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Story', storySchema);
