const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 24,
    match: /^[a-zA-Z0-9_]+$/
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: 254
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 15,
    match: /^[0-9]{10,15}$/
  },
  password: {
    type: String,
    select: false
  },
  profilePhoto: {
    type: String,
    default: ''
  },
  online: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  friends: {
    type: [String],
    default: []
  },
  followers: {
    type: [String],
    default: []
  },
  following: {
    type: [String],
    default: []
  },
  friendRequests: {
    type: [String],
    default: []
  },
  blockedUsers: {
    type: [String],
    default: []
  },
  verified: {
    type: Boolean,
    default: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  bio: {
    type: String,
    default: '',
    maxlength: 220
  },
  about: {
    type: String,
    default: '',
    maxlength: 140
  },
  aboutUpdatedAt: {
    type: Date,
    default: Date.now
  },
  pushTokens: {
    type: [String],
    default: []
  },
  privacy: {
    profileVisibility: {
      type: String,
      enum: ['everyone', 'friends', 'private'],
      default: 'everyone'
    },
    showOnlineStatus: {
      type: Boolean,
      default: true
    },
    allowMessagesFrom: {
      type: String,
      enum: ['everyone', 'friends', 'nobody'],
      default: 'everyone'
    }
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorMethod: {
    type: String,
    enum: ['email', 'phone'],
    default: 'email'
  },
  authChallenge: {
    purpose: String,
    codeHash: String,
    expiresAt: Date,
    attempts: {
      type: Number,
      default: 0
    }
  },
  tokenVersion: {
    type: Number,
    default: 0,
    min: 0,
    select: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
