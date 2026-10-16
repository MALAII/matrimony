const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/authMiddleware');
const { createRateLimiter } = require('../middleware/rateLimiter');

// Rate limiter for admin invitation operations (max 30 requests per 15 minutes)
const adminInviteLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many invitation requests dispatched. Please wait before attempting further invitations.',
});

const {
  getAdminUsers,
  getAdminProfiles,
  createBrokerProfile,
  updateProfileApproval,
  uploadAdminBrokerPhoto,
  inviteBrokerCandidate,
  reinviteBrokerCandidate,
} = require('../controllers/adminController');
const { uploadPhotoMiddleware } = require('../middleware/uploadMiddleware');

/**
 * @route   GET /api/admin/me
 * @desc    Verify administrator authorization and return administrator identity
 * @access  Private (Admin only - requires both protect and adminOnly)
 */
router.get('/me', protect, adminOnly, (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

/**
 * @route   GET /api/admin/users
 * @desc    Paginated listing of registered users
 * @access  Private (Admin only - requires both protect and adminOnly)
 */
router.get('/users', protect, adminOnly, getAdminUsers);

/**
 * @route   GET /api/admin/profiles
 * @desc    Paginated listing of matrimonial profiles
 * @access  Private (Admin only - requires both protect and adminOnly)
 */
router.get('/profiles', protect, adminOnly, getAdminProfiles);

/**
 * @route   POST /api/admin/profiles/broker
 * @desc    Create an unlinked broker-sourced matrimonial profile
 * @access  Private (Admin only - requires both protect and adminOnly)
 */
router.post('/profiles/broker', protect, adminOnly, createBrokerProfile);

/**
 * @route   PATCH /api/admin/profiles/:id/approval
 * @desc    Approve or reject a broker-sourced matrimonial profile
 * @access  Private (Admin only - requires both protect and adminOnly)
 */
router.patch('/profiles/:id/approval', protect, adminOnly, updateProfileApproval);

/**
 * @route   POST /api/admin/profiles/:id/photo
 * @desc    Upload or replace photograph for a broker profile
 * @access  Private (Admin only - requires both protect and adminOnly)
 */
router.post(
  '/profiles/:id/photo',
  protect,
  adminOnly,
  uploadPhotoMiddleware,
  uploadAdminBrokerPhoto
);

/**
 * @route   POST /api/admin/profiles/:id/invite
 * @desc    Provision invited user, link to broker profile, and send setup email
 * @access  Private (Admin only - requires both protect and adminOnly)
 */
router.post('/profiles/:id/invite', protect, adminOnly, adminInviteLimiter, inviteBrokerCandidate);

/**
 * @route   POST /api/admin/profiles/:id/reinvite
 * @desc    Rotate invitation token and resend setup email to an invited candidate
 * @access  Private (Admin only - requires both protect and adminOnly)
 */
router.post('/profiles/:id/reinvite', protect, adminOnly, adminInviteLimiter, reinviteBrokerCandidate);

module.exports = router;
