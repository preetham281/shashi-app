const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  owner: {
    type: String,
    required: true
  },
  admins: {
    type: [String],
    default: []
  },
  members: {
    type: [String],
    default: []
  },
  allowMembersToAdd: {
    type: Boolean,
    default: false
  },
  photoUrl: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Group', groupSchema);
