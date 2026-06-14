const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const authMiddleware = require('../middleware/authMiddleware');

const {
  signup,
  login,
  me,
  updateProfile,
  uploadProfilePhoto,
  getUsers,
  logout
} = require('../controllers/authController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const extensions = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif'
    };
    const extension = extensions[file.mimetype] || '.img';
    cb(null, `${req.user.id}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if(allowedTypes.includes(file.mimetype)){
      cb(null, true);
      return;
    }

    cb(new Error('Only image uploads are allowed'));
  }
});

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', authMiddleware, me);
router.get('/users', authMiddleware, getUsers);
router.put('/profile', authMiddleware, updateProfile);
router.post('/profile/photo', authMiddleware, upload.single('profilePhoto'), uploadProfilePhoto);
router.post('/logout', authMiddleware, logout);

module.exports = router;
