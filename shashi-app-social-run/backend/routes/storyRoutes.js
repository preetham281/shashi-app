const express = require('express');
const router = express.Router();
const storyController = require('../controllers/storyController');

router.get('/', storyController.getStories);
router.post('/', storyController.createStory);
router.post('/:id/view', storyController.viewStory);
router.post('/:id/react', storyController.reactStory);

module.exports = router;
