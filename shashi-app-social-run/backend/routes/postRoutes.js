const express = require('express');
const router = express.Router();
const {
  createPost,
  getPosts,
  likePost,
  commentPost
} = require('../controllers/postController');

router.post('/', createPost);
router.get('/', getPosts);
router.post('/:id/like', likePost);
router.post('/:id/comment', commentPost);

module.exports = router;
