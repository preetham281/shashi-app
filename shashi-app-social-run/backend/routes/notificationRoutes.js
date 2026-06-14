const express = require('express');
const router = express.Router();
const {
  createNotification,
  getNotifications,
  markNotificationsRead,
  registerPushToken,
  pushStatus
} = require('../controllers/notificationController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, createNotification);
router.get('/push/status', pushStatus);
router.post('/push/register', authMiddleware, registerPushToken);
router.get('/:username', authMiddleware, getNotifications);
router.put('/:username/read', authMiddleware, markNotificationsRead);

module.exports = router;
