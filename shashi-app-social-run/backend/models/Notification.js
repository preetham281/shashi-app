const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: String,
    maxlength: 80,
    index: true
  },
  sender: {
    type: String,
    maxlength: 32
  },
  type: {
    type: String,
    enum: [
      'message',
      'friend_request',
      'friend_accept',
      'reel_like',
      'reel_comment',
      'story_reaction',
      'like',
      'comment',
      'post_like',
      'post_comment',
      'follow_request',
      'system'
    ],
    default: 'message'
  },
  text: {
    type: String,
    maxlength: 240
  },
  clientId: {
    type: String,
    default: '',
    maxlength: 80,
    index: true
  },
  pushSent: {
    type: Boolean,
    default: false
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Notification', notificationSchema);
