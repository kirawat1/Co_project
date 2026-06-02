const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const notifController = require('../controllers/notificationController');

router.get('/unread-count', verifyToken, notifController.getUnreadCount);
router.post('/mark-all-read', verifyToken, notifController.markAllRead);

module.exports = router;
