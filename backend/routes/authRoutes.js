const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
  verifySetupToken,
  setupPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { createRateLimiter } = require('../middleware/rateLimiter');

// Rate limiter for token verification (max 30 requests per 15 minutes per IP)
const verifyLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many verification attempts. Please try again later.',
});

// Stricter rate limiter for password setup submissions (max 10 requests per 15 minutes per IP)
const setupPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many password setup attempts. Please try again later.',
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user account
 * @access  Public
 */
router.post('/register', registerUser);

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user and set cookie
 * @access  Public
 */
router.post('/login', loginUser);

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated user
 * @access  Private
 */
router.get('/me', protect, getCurrentUser);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user and clear cookie
 * @access  Public / Private
 */
router.post('/logout', logoutUser);

/**
 * @route   GET /api/auth/setup-password/verify
 * @desc    Verify invitation token validity without consuming
 * @access  Public
 */
router.get('/setup-password/verify', verifyLimiter, verifySetupToken);

/**
 * @route   POST /api/auth/setup-password
 * @desc    Submit chosen password, consume token, and activate candidate account
 * @access  Public
 */
router.post('/setup-password', setupPasswordLimiter, setupPassword);

module.exports = router;
