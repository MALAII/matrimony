const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
  verifySetupToken,
  setupPassword,
  forgotPassword,
  verifyResetToken,
  resetPassword,
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

// Rate limiter for forgot-password requests (max 5 requests per 15 minutes per IP)
const forgotPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many password reset requests. Please try again later.',
});

// Rate limiter for password reset submissions (max 10 requests per 15 minutes per IP)
const resetPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many password reset attempts. Please try again later.',
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

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset email with secure expiring token
 * @access  Public
 */
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);

/**
 * @route   GET /api/auth/reset-password/verify
 * @desc    Verify reset token validity without consuming
 * @access  Public
 */
router.get('/reset-password/verify', verifyLimiter, verifyResetToken);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Submit new password, consume reset token, and update password
 * @access  Public
 */
router.post('/reset-password', resetPasswordLimiter, resetPassword);

module.exports = router;
