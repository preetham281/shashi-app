const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true
  },
  username: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    enum: ['login', 'otp', 'password_reset', 'backup', 'crash', 'security'],
    default: 'security'
  },
  detail: {
    type: String,
    default: ''
  },
  ip: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Activity', activitySchema);
