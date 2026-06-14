const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const controller = require('../controllers/accountController');

const router = express.Router();

router.post('/otp/request', controller.requestPhoneOtp);
router.post('/otp/verify', controller.verifyPhoneOtp);
router.post('/password/request', controller.requestPasswordReset);
router.post('/password/reset', controller.resetPassword);
router.post('/2fa/verify', controller.verifyTwoFactor);
router.put('/security', authMiddleware, controller.updateSecurity);
router.put('/privacy', authMiddleware, controller.updatePrivacy);
router.post('/backup', authMiddleware, controller.createBackup);
router.get('/backup', authMiddleware, controller.getBackup);
router.post('/crash', authMiddleware, controller.reportCrash);
router.get('/activity', authMiddleware, controller.getActivity);

module.exports = router;
