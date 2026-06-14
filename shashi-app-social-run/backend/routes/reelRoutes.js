const express = require('express');
const router = express.Router();
const {
  createReel,
  getReels,
  likeReel,
  commentReel
} = require('../controllers/reelController');

router.post('/', createReel);
router.get('/', getReels);
router.post('/:id/like', likeReel);
router.post('/:id/comment', commentReel);

module.exports = router;
