const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middlewares/authMiddleware');
const notifController = require('../controllers/notificationController');

router.get('/unread-count', verifyToken, notifController.getUnreadCount);
router.get('/counts', verifyToken, notifController.getCounts);
router.post('/mark-all-read', verifyToken, notifController.markAllRead);
router.post('/mark-read', verifyToken, notifController.markRead);
// ป้ายตัวเลขบนเมนูของเจ้าหน้าที่/อาจารย์ = งานที่รออยู่จริง (นักศึกษาได้ {})
router.get('/pending', verifyToken, require('../controllers/pendingController').getPendingCounts);

module.exports = router;
