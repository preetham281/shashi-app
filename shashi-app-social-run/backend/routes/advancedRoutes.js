const express = require('express');
const router = express.Router();
const advancedController = require('../controllers/advancedController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);
router.get('/explore', advancedController.explore);
router.get('/analytics', advancedController.analytics);
router.get('/features', advancedController.featureStatus);
router.get('/groups', advancedController.getGroups);
router.post('/groups', advancedController.createGroup);
router.put('/groups/:id', advancedController.updateGroupDetails);
router.post('/groups/:id/join', advancedController.joinGroup);
router.post('/groups/:id/leave', advancedController.leaveGroup);
router.put('/groups/:id/settings', advancedController.updateGroupSettings);
router.post('/groups/:id/admins', advancedController.makeGroupAdmin);
router.delete('/groups/:id/admins/:username', advancedController.removeGroupAdmin);
router.delete('/groups/:id/members/:username', advancedController.removeGroupMember);
router.delete('/groups/:id', advancedController.deleteGroup);
router.get('/reports', advancedController.getReports);
router.post('/reports', advancedController.createReport);
router.post('/block', advancedController.blockUser);
router.post('/unblock', advancedController.unblockUser);
router.post('/verify/:username', advancedController.verifyUser);

module.exports = router;
