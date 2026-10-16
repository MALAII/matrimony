const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { requireDirectoryAccess } = require('../services/subscriptionAccessService');
const {
  getMemberDirectory,
  getMemberCredits,
  getMemberCandidateDetails,
  unlockMemberContactHandler,
} = require('../controllers/memberController');

// Rate limiter for contact unlocking to prevent automated scraping/enumeration bursts
const contactUnlockRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // Up to 60 unlock/view requests per 15-minute window per authenticated user
  message: 'Too many contact-unlock requests. Please wait a few minutes and try again.',
});

/**
 * @route   GET /api/members
 * @desc    Browse eligible matrimonial profiles (authenticated active subscribers and grace-period subscribers)
 * @access  Private
 */
router.get('/', protect, requireDirectoryAccess, getMemberDirectory);

/**
 * @route   GET /api/members/credits
 * @desc    Get the signed-in member's current monthly contact-view credit cycle and balance
 * @access  Private
 */
router.get('/credits', protect, getMemberCredits);

/**
 * @route   GET /api/members/:profileId
 * @desc    View an individual eligible candidate's full profile details (excluding raw contact info)
 * @access  Private
 */
router.get('/:profileId', protect, requireDirectoryAccess, getMemberCandidateDetails);

/**
 * @route   POST /api/members/:profileId/view-contact
 * @desc    Unlock a candidate's phone number (1 credit on first view, 0 credits on repeat view)
 * @access  Private (Active subscribers only; rejected during 7-day grace period or after expiry)
 */
router.post(
  '/:profileId/view-contact',
  protect,
  contactUnlockRateLimiter,
  unlockMemberContactHandler
);

module.exports = router;
