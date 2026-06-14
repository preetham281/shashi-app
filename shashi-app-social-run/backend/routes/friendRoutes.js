const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);
router.post('/contacts', friendController.findContacts);
router.get('/:username', friendController.getFriends);
router.post('/request', friendController.sendRequest);
router.post('/accept', friendController.acceptRequest);
router.post('/remove', friendController.removeFriend);

module.exports = router;
