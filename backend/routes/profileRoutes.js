const express = require('express');
const router = express.Router();
const {
  createProfile,
  getMyProfile,
  updateMyProfile,
  uploadProfilePhoto,
} = require('../controllers/profileController');
const {
  getMyPhotos,
  addMyPhoto,
  replaceMyPhoto,
  deleteMyPhoto,
  setMyPrimaryPhoto,
} = require('../controllers/userPhotoController');
const {
  getSouthIndianCities,
  generateMyHoroscope,
  updateMyHoroscope,
  requestMyHoroscope,
  downloadMyHoroscopeChart,
} = require('../controllers/horoscopeController');
const { protect } = require('../middleware/authMiddleware');
const { uploadPhotoMiddleware } = require('../middleware/uploadMiddleware');

/**
 * @route   GET /api/profiles/cities
 * @desc    Get pre-configured South Indian cities, Rasis, and Nakshatras
 * @access  Public
 */
router.get('/cities', getSouthIndianCities);

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

/**
 * Member Multi-Photo Gallery Routes (up to 3 photos)
 */
router.get('/me/photos', protect, getMyPhotos);
router.post('/me/photos', protect, uploadPhotoMiddleware, addMyPhoto);
router.put('/me/photos/:photoId', protect, uploadPhotoMiddleware, replaceMyPhoto);
router.delete('/me/photos/:photoId', protect, deleteMyPhoto);
router.patch('/me/photos/:photoId/primary', protect, setMyPrimaryPhoto);

/**
 * @route   POST /api/profiles/me/horoscope/generate
 * @desc    Disabled: Direct user horoscope generation is not permitted
 * @access  Private (Disabled)
 */
router.post('/me/horoscope/generate', protect, (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Direct user horoscope generation is disabled. Horoscopes are managed exclusively by administrators for broker candidates.',
  });
});

/**
 * @route   PATCH /api/profiles/me/horoscope
 * @desc    Manually update Jathagam particulars for signed-in user's profile
 * @access  Private
 */
router.patch('/me/horoscope', protect, updateMyHoroscope);

/**
 * @route   POST /api/profiles/me/horoscope/request
 * @desc    Disabled: Direct user horoscope requests are not permitted
 * @access  Private (Disabled)
 */
router.post('/me/horoscope/request', protect, (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'Direct user horoscope requests are disabled. Horoscopes are managed exclusively by administrators for broker candidates.',
  });
});

/**
 * @route   GET /api/profiles/me/horoscope/chart-file
 * @desc    Download the pure square vector SVG chart for signed-in user's own profile
 * @access  Private
 */
router.get('/me/horoscope/chart-file', protect, downloadMyHoroscopeChart);

module.exports = router;
