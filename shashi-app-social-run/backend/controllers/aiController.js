const Reel = require('../models/Reel');
const User = require('../models/User');

const blockedWords = [
  'hate',
  'kill',
  'abuse',
  'spam',
  'scam'
];

const translations = {
  Telugu: {
    hello: 'namaskaram',
    thanks: 'dhanyavadalu',
    friend: 'snehitudu',
    welcome: 'swagatham',
    'how are you': 'meeru ela unnaru'
  },
  Hindi: {
    hello: 'namaste',
    thanks: 'dhanyavaad',
    friend: 'dost',
    welcome: 'swagat hai',
    'how are you': 'aap kaise hain'
  },
  Tamil: {
    hello: 'vanakkam',
    thanks: 'nandri',
    friend: 'nanban',
    welcome: 'varaverpu',
    'how are you': 'neenga eppadi irukkeenga'
  }
};

function moderateText(text){
  const value = String(text || '').toLowerCase();
  const matches = blockedWords.filter((word) => value.includes(word));
  return {
    allowed: matches.length === 0,
    risk: matches.length ? 'high' : 'low',
    matches,
    message: matches.length ? 'This text may be unsafe. Please edit it.' : 'Text looks safe.'
  };
}

exports.moderate = async (req, res) => {
  res.json(moderateText(req.body.text));
};

exports.translate = async (req, res) => {
  const text = String(req.body.text || '');
  const language = req.body.language || 'English';
  const dictionary = translations[language] || {};
  const translated = text
    .split(/\b/)
    .map((part) => dictionary[part.toLowerCase()] || part)
    .join('');

  res.json({
    language,
    original: text,
    translated: language === 'English' ? text : translated
  });
};

exports.caption = async (req, res) => {
  const mediaType = String(req.body.mediaType || '').toLowerCase();
  const fileName = String(req.body.fileName || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
  const caption = mediaType.startsWith('video')
    ? `New video${fileName ? `: ${fileName}` : ''}`
    : mediaType.startsWith('image')
      ? `New photo${fileName ? `: ${fileName}` : ''}`
      : `Shared file${fileName ? `: ${fileName}` : ''}`;

  res.json({
    caption,
    hashtags: mediaType.startsWith('video') ? ['#reel', '#video'] : ['#photo', '#shashi']
  });
};

exports.recommendations = async (req, res) => {
  try {
    const username = req.query.username || '';
    const reels = await Reel.find().sort({ likes: -1, createdAt: -1 }).limit(8);
    const users = await User.find({ username: { $ne: username } })
      .select('username profilePhoto online followers friends')
      .sort({ online: -1, createdAt: -1 })
      .limit(8);

    res.json({
      users,
      reels,
      reason: 'Recommended from active users, fresh reels, and popular posts.'
    });
  } catch(error) {
    res.status(500).json({ message: error.message });
  }
};

exports.moderateText = moderateText;
