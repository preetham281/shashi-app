const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.get('/recommendations', aiController.recommendations);
router.post('/moderate', aiController.moderate);
router.post('/translate', aiController.translate);
router.post('/caption', aiController.caption);

module.exports = router;
