const express = require('express');
const router = express.Router();
const {
  createProfile,
  getMyProfile,
  updateMyProfile,
  uploadProfilePhoto,
} = require('../controllers/profileController');
const { protect } = require('../middleware/authMiddleware');
const { uploadPhotoMiddleware } = require('../middleware/uploadMiddleware');

/**
 * @route   POST /api/profiles/me
 * @desc    Create authenticated user's matrimonial profile
 * @access  Private
 */
router.post('/me', protect, createProfile);

/**
 * @route   GET /api/profiles/me
 * @desc    Get authenticated user's matrimonial profile
 * @access  Private
 */
router.get('/me', protect, getMyProfile);

/**
 * @route   PATCH /api/profiles/me
 * @desc    Update authenticated user's matrimonial profile
 * @access  Private
 */
router.patch('/me', protect, updateMyProfile);

/**
 * @route   POST /api/profiles/me/photo
 * @desc    Upload or replace matrimonial profile photograph
 * @access  Private
 */
router.post('/me/photo', protect, uploadPhotoMiddleware, uploadProfilePhoto);

module.exports = router;
