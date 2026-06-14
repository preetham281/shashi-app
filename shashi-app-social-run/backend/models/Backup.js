const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  username: String,
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  messageCount: {
    type: Number,
    default: 0
  },
  messages: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Backup', backupSchema);
