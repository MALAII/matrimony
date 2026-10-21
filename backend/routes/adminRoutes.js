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
const {
  getAdminCandidatePhotos,
  addAdminCandidatePhoto,
  replaceAdminCandidatePhoto,
  deleteAdminCandidatePhoto,
  setAdminCandidatePrimaryPhoto,
} = require('../controllers/adminPhotoController');
const {
  validateCandidateImport,
  commitCandidateImport,
  downloadImportErrorsCsv,
  downloadCandidateExcelTemplate,
} = require('../controllers/adminImportController');
const { uploadPhotoMiddleware, uploadExcelMiddleware } = require('../middleware/uploadMiddleware');

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
 * @route   GET /api/admin/profiles/:id/photos
 * @desc    Get candidate photo gallery (up to 3 photos)
 * @access  Private (Admin only)
 */
router.get('/profiles/:id/photos', protect, adminOnly, getAdminCandidatePhotos);

/**
 * @route   POST /api/admin/profiles/:id/photos
 * @desc    Upload additional candidate photo (enforces max 3)
 * @access  Private (Admin only)
 */
router.post(
  '/profiles/:id/photos',
  protect,
  adminOnly,
  uploadPhotoMiddleware,
  addAdminCandidatePhoto
);

/**
 * @route   PUT /api/admin/profiles/:id/photos/:photoId
 * @desc    Replace an existing candidate photo
 * @access  Private (Admin only)
 */
router.put(
  '/profiles/:id/photos/:photoId',
  protect,
  adminOnly,
  uploadPhotoMiddleware,
  replaceAdminCandidatePhoto
);

/**
 * @route   DELETE /api/admin/profiles/:id/photos/:photoId
 * @desc    Delete a candidate photo and promote remaining photo if deleted photo was primary
 * @access  Private (Admin only)
 */
router.delete(
  '/profiles/:id/photos/:photoId',
  protect,
  adminOnly,
  deleteAdminCandidatePhoto
);

/**
 * @route   PATCH /api/admin/profiles/:id/photos/:photoId/primary
 * @desc    Set specific photo as primary display photo
 * @access  Private (Admin only)
 */
router.patch(
  '/profiles/:id/photos/:photoId/primary',
  protect,
  adminOnly,
  setAdminCandidatePrimaryPhoto
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

/**
 * =========================================================================
 * Bulk Candidate Excel Import Routes
 * =========================================================================
 */

/**
 * @route   GET /api/admin/imports/candidates/template
 * @desc    Download official starter Excel template (.xlsx) with sample candidate rows
 * @access  Private (Admin only)
 */
router.get(
  '/imports/candidates/template',
  protect,
  adminOnly,
  downloadCandidateExcelTemplate
);

/**
 * @route   POST /api/admin/imports/candidates/validate
 * @desc    Dry-run validation of uploaded Excel file (checks headers, formats, and duplicates; 0 DB writes)
 * @access  Private (Admin only)
 */
router.post(
  '/imports/candidates/validate',
  protect,
  adminOnly,
  uploadExcelMiddleware,
  validateCandidateImport
);

/**
 * @route   POST /api/admin/imports/candidates/commit
 * @desc    Chunked commit execution of pre-validated candidate profiles (forces pending_approval)
 * @access  Private (Admin only)
 */
router.post(
  '/imports/candidates/commit',
  protect,
  adminOnly,
  commitCandidateImport
);

/**
 * @route   GET /api/admin/imports/candidates/:batchId/errors/csv
 * @desc    Download CSV report of skipped or invalid rows with exact reasons
 * @access  Private (Admin only)
 */
router.get(
  '/imports/candidates/:batchId/errors/csv',
  protect,
  adminOnly,
  downloadImportErrorsCsv
);

module.exports = router;
