const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  clientId: {
    type: String,
    default: '',
    maxlength: 80
  },
  sender: {
    type: String,
    maxlength: 32,
    index: true
  },
  receiver: {
    type: String,
    maxlength: 80,
    index: true
  },
  groupId: {
    type: String,
    default: '',
    maxlength: 80
  },
  text: {
    type: String,
    default: '',
    maxlength: 4000
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'video', 'file', 'voice', 'location', 'liveLocation', 'contact'],
    default: 'text'
  },
  mediaUrl: {
    type: String,
    default: '',
    maxlength: 8388608
  },
  mediaType: {
    type: String,
    default: '',
    maxlength: 120
  },
  fileName: {
    type: String,
    default: '',
    maxlength: 180
  },
  emoji: {
    type: String,
    default: '',
    maxlength: 80
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'seen'],
    default: 'sent'
  },
  deliveredTo: {
    type: [String],
    default: []
  },
  readBy: {
    type: [String],
    default: []
  },
  hashtags: {
    type: [String],
    default: []
  },
  mentions: {
    type: [String],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Message', messageSchema);
