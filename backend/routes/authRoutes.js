// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/signin (Login)
router.post('/signin', authController.signIn);

// POST /api/auth/signup (Student Registration)
router.post('/signup', authController.signUp);

module.exports = router;