const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

const {
  saveMessage,
  getMessages,
  deleteConversation,
  deleteMessage
} = require('../controllers/messageController');

router.post('/', authMiddleware, saveMessage);
router.get('/', authMiddleware, getMessages);
router.delete('/conversation', authMiddleware, deleteConversation);
router.delete('/:id', authMiddleware, deleteMessage);

module.exports = router;
