const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reporter: String,
  targetType: {
    type: String,
    enum: ['user', 'message', 'reel', 'story'],
    default: 'user'
  },
  targetId: String,
  targetUser: String,
  reason: String,
  status: {
    type: String,
    enum: ['open', 'reviewed', 'dismissed'],
    default: 'open'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Report', reportSchema);
