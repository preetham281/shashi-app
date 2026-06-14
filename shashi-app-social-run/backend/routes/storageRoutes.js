const express = require('express');
const router = express.Router();
const storageController = require('../controllers/storageController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/status', storageController.status);
router.post('/upload', authMiddleware, storageController.upload);

module.exports = router;
