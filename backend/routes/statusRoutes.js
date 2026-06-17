const express = require('express');
const router = express.Router();
const { getStatus } = require('../controllers/statusController');
const { verifyToken, verifyRole } = require('../middlewares/authMiddleware');

router.get('/', verifyToken, verifyRole('staff'), getStatus);

module.exports = router;
