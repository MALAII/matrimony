const mongoose = require('mongoose');
const User = require('../models/User');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const { uploadToCloudinary } = require('./profileController');

// Allowlist of allowed top-level profile fields for broker profile creation
const ALLOWED_BROKER_PROFILE_FIELDS = [
  'candidateName',
  'candidateEmail',
  'candidatePhone',
  'personalDetails',
  'educationAndProfession',
  'familyDetails',
  'partnerPreferences',
  'profilePhoto',
];

/**
 * Escapes regex special characters to prevent regex injection or ReDoS attacks
 * @param {string} str
 * @returns {string}
 */
const escapeRegex = (str) => {
  return str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

/**
 * Parses and validates pagination and search query parameters
 * @param {object} query
 * @returns {{ page?: number, limit?: number, search?: string, error?: string }}
 */
const parsePaginationParams = (query) => {
  const { page = '1', limit = '20', search = '' } = query;

  // 1. Validate page parameter
  if (typeof page !== 'string' || !/^\d+$/.test(page.trim())) {
    return {
      error: 'Invalid page parameter: page must be a positive integer',
    };
  }
  const parsedPage = parseInt(page.trim(), 10);
  if (parsedPage < 1) {
    return {
      error: 'Invalid page parameter: page must be greater than or equal to 1',
    };
  }

  // 2. Validate limit parameter (enforcing max 100)
  if (typeof limit !== 'string' || !/^\d+$/.test(limit.trim())) {
    return {
      error: 'Invalid limit parameter: limit must be a positive integer',
    };
  }
  const parsedLimit = parseInt(limit.trim(), 10);
  if (parsedLimit < 1 || parsedLimit > 100) {
    return {
      error: 'Invalid limit parameter: limit must be an integer between 1 and 100',
    };
  }

  // 3. Validate search parameter
  if (typeof search !== 'string') {
    return {
      error: 'Invalid search parameter: search query must be a string',
    };
  }
  const trimmedSearch = search.trim();
  if (trimmedSearch.length > 100) {
    return {
      error: 'Search parameter exceeds maximum allowed length of 100 characters',
    };
  }

  return {
    page: parsedPage,
    limit: parsedLimit,
    search: trimmedSearch,
  };
};

/**
 * @route   GET /api/admin/users
 * @desc    Get paginated listing of user records (name, email, role, timestamps)
 * @access  Private (Admin only)
 */
const getAdminUsers = async (req, res, next) => {
  try {
    const { page, limit, search, error } = parsePaginationParams(req.query);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    // Build filter query
    const filter = {};
    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    // Database count and query
    const totalRecords = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit) || 1;
    const skip = (page - 1) * limit;

    const users = await User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/admin/profiles
 * @desc    Get paginated listing of matrimonial profiles with safe populated user info (supports direct and broker profiles)
 * @access  Private (Admin only)
 */
const getAdminProfiles = async (req, res, next) => {
  try {
    const { page, limit, search, error } = parsePaginationParams(req.query);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    // Build filter query across profile fields, candidate details, and linked users
    const filter = {};
    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');

      // Find user IDs matching registered user name or email
      const matchingUsers = await User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }],
      }).select('_id');

      const matchingUserIds = matchingUsers.map((u) => u._id);

      filter.$or = [
        { candidateName: searchRegex },
        { candidateEmail: searchRegex },
        { 'personalDetails.location': searchRegex },
        { 'personalDetails.motherTongue': searchRegex },
        { 'educationAndProfession.occupation': searchRegex },
        { 'educationAndProfession.educationalQualification': searchRegex },
        { 'educationAndProfession.company': searchRegex },
      ];

      // If any user matched name/email, include profile linkage in $or filter
      if (matchingUserIds.length > 0) {
        filter.$or.unshift({ user: { $in: matchingUserIds } });
      }
    }

    // Database count and query
    const totalRecords = await MatrimonialProfile.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit) || 1;
    const skip = (page - 1) * limit;

    const profiles = await MatrimonialProfile.find(filter)
      .populate('user', 'name email role accountStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      data: profiles,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/admin/profiles/broker
 * @desc    Create an unlinked broker-sourced matrimonial profile
 * @access  Private (Admin only)
 */
const createBrokerProfile = async (req, res, next) => {
  try {
    const rawBody = req.body || {};

    // 1. Strictly strip and reject attempts to manipulate internal/audit/ownership fields
    const sanitizedBody = { ...rawBody };
    delete sanitizedBody._id;
    delete sanitizedBody.user;
    delete sanitizedBody.userId;
    delete sanitizedBody.source;
    delete sanitizedBody.approvalStatus;
    delete sanitizedBody.profileStatus;
    delete sanitizedBody.approvedAt;
    delete sanitizedBody.approvedBy;

    // 2. Validate against strict allowlist of editable profile fields
    for (const key of Object.keys(sanitizedBody)) {
      if (!ALLOWED_BROKER_PROFILE_FIELDS.includes(key)) {
        return res.status(400).json({
          success: false,
          message: `Invalid field: '${key}' is not an allowed profile field for broker profile creation`,
        });
      }
    }

    // 3. Candidate name validation (required, non-empty string)
    const candidateName = sanitizedBody.candidateName;
    if (!candidateName || typeof candidateName !== 'string' || !candidateName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Candidate name is required for broker-sourced profiles',
      });
    }

    // 4. Candidate email validation & normalization (optional, normalized if provided)
    let normalizedCandidateEmail = null;
    if (sanitizedBody.candidateEmail !== undefined && sanitizedBody.candidateEmail !== null) {
      const emailStr = String(sanitizedBody.candidateEmail).trim().toLowerCase();
      if (emailStr.length > 0) {
        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!EMAIL_REGEX.test(emailStr)) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a valid candidate email address',
          });
        }
        normalizedCandidateEmail = emailStr;
      }
    }

    // 5. Candidate phone validation (optional)
    let candidatePhone = null;
    if (sanitizedBody.candidatePhone !== undefined && sanitizedBody.candidatePhone !== null) {
      candidatePhone = String(sanitizedBody.candidatePhone).trim();
      if (candidatePhone.length > 25) {
        return res.status(400).json({
          success: false,
          message: 'Candidate phone cannot exceed 25 characters',
        });
      }
    }

    // 6. Assemble profile data with strict server-enforced business invariants:
    // - source is forced to 'broker'
    // - user is forced to null (no user account created)
    // - approvalStatus is forced to 'pending_approval'
    // - profileStatus is initialized to 'active'
    // - audit timestamps approvedAt and approvedBy are null
    const profileData = {
      user: null,
      source: 'broker',
      approvalStatus: 'pending_approval',
      profileStatus: 'active',
      approvedAt: null,
      approvedBy: null,
      candidateName: candidateName.trim(),
      candidateEmail: normalizedCandidateEmail,
      candidatePhone: candidatePhone || null,
      personalDetails: sanitizedBody.personalDetails || {},
      educationAndProfession: sanitizedBody.educationAndProfession || {},
      familyDetails: sanitizedBody.familyDetails || {},
      partnerPreferences: sanitizedBody.partnerPreferences || {},
      profilePhoto: sanitizedBody.profilePhoto || {},
    };

    const newProfile = await MatrimonialProfile.create(profileData);

    return res.status(201).json({
      success: true,
      message: 'Broker matrimonial profile created successfully and pending approval',
      data: {
        _id: newProfile._id,
        source: newProfile.source,
        approvalStatus: newProfile.approvalStatus,
        profileStatus: newProfile.profileStatus,
        candidateName: newProfile.candidateName,
        candidateEmail: newProfile.candidateEmail,
        candidatePhone: newProfile.candidatePhone,
        personalDetails: newProfile.personalDetails,
        educationAndProfession: newProfile.educationAndProfession,
        familyDetails: newProfile.familyDetails,
        partnerPreferences: newProfile.partnerPreferences,
        profilePhoto: newProfile.profilePhoto,
        createdAt: newProfile.createdAt,
        updatedAt: newProfile.updatedAt,
      },
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }
    next(err);
  }
};

/**
 * @route   PATCH /api/admin/profiles/:id/approval
 * @desc    Approve or reject a broker-sourced matrimonial profile
 * @access  Private (Admin only)
 */
const updateProfileApproval = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approvalStatus } = req.body || {};

    // 1. Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID format',
      });
    }

    // 2. Validate approvalStatus input
    if (!approvalStatus || !['approved', 'rejected'].includes(approvalStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid approval status. Must be either 'approved' or 'rejected'",
      });
    }

    // 3. Find profile
    const profile = await MatrimonialProfile.findById(id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Matrimonial profile not found',
      });
    }

    // 4. Invariant: Only broker profiles can be managed via this endpoint
    // Direct user profiles are pre-approved upon creation and must not go through broker approval
    if (profile.source !== 'broker') {
      return res.status(400).json({
        success: false,
        message:
          'Approval status modifications via this endpoint are restricted to broker-sourced profiles only. Direct user profiles do not undergo broker approval.',
      });
    }

    // 5. Apply status and audit timestamps
    if (approvalStatus === 'approved') {
      profile.approvalStatus = 'approved';
      profile.approvedAt = new Date();
      profile.approvedBy = req.user._id;
    } else {
      // 'rejected'
      profile.approvalStatus = 'rejected';
      profile.approvedAt = null;
      profile.approvedBy = null;
    }

    await profile.save();

    return res.status(200).json({
      success: true,
      message: `Broker matrimonial profile has been ${approvalStatus}`,
      data: {
        _id: profile._id,
        source: profile.source,
        approvalStatus: profile.approvalStatus,
        profileStatus: profile.profileStatus,
        approvedAt: profile.approvedAt,
        approvedBy: profile.approvedBy,
        candidateName: profile.candidateName,
        candidateEmail: profile.candidateEmail,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }
    next(err);
  }
};

/**
 * @route   POST /api/admin/profiles/:id/photo
 * @desc    Upload or replace photograph for a broker-sourced matrimonial profile via Cloudinary
 * @access  Private (Admin only)
 */
const uploadAdminBrokerPhoto = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID format',
      });
    }

    // 2. Find target profile
    const profile = await MatrimonialProfile.findById(id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Matrimonial profile not found',
      });
    }

    // 3. Ensure profile is broker-sourced
    if (profile.source !== 'broker') {
      return res.status(400).json({
        success: false,
        message: 'This upload endpoint is reserved for broker-sourced profiles only.',
      });
    }

    // 4. Cloudinary configuration check
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message:
          'Cloudinary photo storage is not configured on the server. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env',
      });
    }

    // 5. Keep reference to previous photo's publicId for deletion after successful database update
    const oldPublicId = profile.profilePhoto?.publicId;

    // 6. Upload replacement image to Cloudinary
    let uploadResult;
    try {
      uploadResult = await uploadToCloudinary(req.file.buffer);
    } catch (uploadErr) {
      console.error(`[Admin Cloudinary Upload Error] ${uploadErr.message}`);
      return res.status(502).json({
        success: false,
        message: 'Failed to upload image to Cloudinary storage. Please try again.',
      });
    }

    const newUrl = uploadResult.secure_url;
    const newPublicId = uploadResult.public_id;

    // 7. Update MongoDB profile with new URL and public ID
    try {
      profile.profilePhoto = {
        url: newUrl,
        publicId: newPublicId,
      };
      await profile.save();
    } catch (dbError) {
      // If database update fails, clean up newly uploaded image from Cloudinary
      try {
        await cloudinary.uploader.destroy(newPublicId);
      } catch (cleanupErr) {
        console.error(`[Admin Cloudinary Cleanup Error] ${cleanupErr.message}`);
      }
      throw dbError;
    }

    // 8. Delete previous image asset from Cloudinary if update succeeded
    if (oldPublicId) {
      try {
        await cloudinary.uploader.destroy(oldPublicId);
      } catch (deleteErr) {
        console.warn(
          `[Admin Cloudinary Warning] Failed to delete previous image asset '${oldPublicId}': ${deleteErr.message}`
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Broker profile photo uploaded successfully',
      data: {
        profileId: profile._id,
        url: profile.profilePhoto.url,
        publicId: profile.profilePhoto.publicId,
      },
    });
  } catch (err) {
    next(err);
  }
};

const crypto = require('crypto');
const emailService = require('../services/emailService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITATION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generates a cryptographically random token (32 bytes hex) and its SHA-256 hash
 */
const generateInvitationTokenPair = () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
};

/**
 * @route   POST /api/admin/profiles/:id/invite
 * @desc    Provision a User account in 'invited' status, link to approved broker profile, and dispatch setup email
 * @access  Private (Admin only)
 */
const inviteBrokerCandidate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email } = req.body || {};

    // 1. Validate Profile ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID format',
      });
    }

    // 2. Fetch Profile
    const profile = await MatrimonialProfile.findById(id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Matrimonial profile not found',
      });
    }

    // 3. Precondition: Must be broker-sourced
    if (profile.source !== 'broker') {
      return res.status(400).json({
        success: false,
        message: 'Invitations are restricted to broker-sourced profiles only.',
      });
    }

    // 4. Precondition: Must be approved and active
    if (profile.approvalStatus !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Only approved matrimonial profiles can be provisioned for login access.',
      });
    }

    if (profile.profileStatus !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Only active matrimonial profiles can be provisioned for login access.',
      });
    }

    // 5. Precondition: Must be unlinked (user: null)
    if (profile.user) {
      return res.status(400).json({
        success: false,
        message: 'This profile is already linked to a user account. Use resend invitation if pending activation.',
      });
    }

    // 6. Obtain and normalize candidate email
    const candidateEmailToUse = (email && typeof email === 'string' && email.trim())
      ? email.trim().toLowerCase()
      : (profile.candidateEmail ? profile.candidateEmail.trim().toLowerCase() : null);

    if (!candidateEmailToUse || !EMAIL_REGEX.test(candidateEmailToUse)) {
      return res.status(400).json({
        success: false,
        message: 'A valid candidate email address is required to send a login invitation.',
      });
    }

    // 7. Email collision check against registered Users (Requirement 7: Never automatically link)
    const existingUser = await User.findOne({ email: candidateEmailToUse });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: `An account with email '${candidateEmailToUse}' already exists. Automatic linking is prohibited; please resolve this account conflict manually.`,
      });
    }

    // 8. Generate token pair & expiry
    const { rawToken, tokenHash } = generateInvitationTokenPair();
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS);
    const candidateName = profile.candidateName || 'Candidate';

    // 9. Two-Phase Write / Compensating Linking Operation
    // Update candidateEmail on profile if updated during invite
    profile.candidateEmail = candidateEmailToUse;

    let newUser = null;
    try {
      newUser = await User.create({
        name: candidateName,
        email: candidateEmailToUse,
        passwordHash: null,
        role: 'user',
        registrationSource: 'broker',
        accountStatus: 'invited',
        invitationTokenHash: tokenHash,
        invitationExpiresAt: expiresAt,
        invitationSentAt: null,
        invitationDeliveryStatus: 'pending',
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        return res.status(409).json({
          success: false,
          message: `An account with email '${candidateEmailToUse}' already exists.`,
        });
      }
      throw createErr;
    }

    // Link User to Profile atomically
    const linkedProfile = await MatrimonialProfile.findOneAndUpdate(
      { _id: profile._id, user: null },
      { $set: { user: newUser._id } },
      { new: true }
    );

    if (!linkedProfile) {
      // Race condition detected: Profile was linked concurrently by another request
      try {
        await User.findByIdAndDelete(newUser._id);
      } catch (cleanErr) {
        console.error(`[Compensating Error] Failed to cleanup user ${newUser._id}: ${cleanErr.message}`);
      }
      return res.status(409).json({
        success: false,
        message: 'This profile was already linked to an account concurrently. Action aborted.',
      });
    }

    profile.user = newUser._id;

    // 10. Attempt email dispatch through emailService
    let emailResult = { success: false };
    try {
      emailResult = await emailService.sendInvitationEmail({
        to: candidateEmailToUse,
        name: candidateName,
        rawToken,
      });
    } catch (mailErr) {
      console.error(`[Invitation Mailer Error] ${mailErr.message}`);
      emailResult = { success: false, error: mailErr.message };
    }

    if (emailResult.success) {
      newUser.invitationDeliveryStatus = 'sent';
      newUser.invitationSentAt = new Date();
      await newUser.save();

      return res.status(200).json({
        success: true,
        message: `Login invitation email sent successfully to ${candidateEmailToUse}.`,
        data: {
          profileId: profile._id,
          userId: newUser._id,
          email: newUser.email,
          accountStatus: newUser.accountStatus,
          invitationDeliveryStatus: 'sent',
          expiresAt,
        },
      });
    } else {
      // Email delivery failed: Keep user in 'invited' state, record failed status
      newUser.invitationDeliveryStatus = 'failed';
      await newUser.save();

      return res.status(200).json({
        success: true,
        warning: true,
        message: `User account provisioned, but email delivery failed (${emailResult.error || 'SMTP delivery failure'}). You may retry sending using Resend Invitation.`,
        data: {
          profileId: profile._id,
          userId: newUser._id,
          email: newUser.email,
          accountStatus: newUser.accountStatus,
          invitationDeliveryStatus: 'failed',
          expiresAt,
        },
      });
    }
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/admin/profiles/:id/reinvite
 * @desc    Rotate invitation token and resend invitation email to an invited candidate
 * @access  Private (Admin only)
 */
const reinviteBrokerCandidate = async (req, res, next) => {
  try {
    const { id } = req.params;

    // 1. Validate Profile ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID format',
      });
    }

    // 2. Fetch Profile with populated user
    const profile = await MatrimonialProfile.findById(id).populate('user');
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Matrimonial profile not found',
      });
    }

    // 3. Preconditions
    if (profile.source !== 'broker') {
      return res.status(400).json({
        success: false,
        message: 'Invitation resend is restricted to broker-sourced profiles only.',
      });
    }

    if (!profile.user) {
      return res.status(400).json({
        success: false,
        message: 'This profile does not have a provisioned user account. Please use Send Invitation first.',
      });
    }

    const linkedUser = profile.user;

    // Check accountStatus: Must be still 'invited'
    if (linkedUser.accountStatus !== 'invited') {
      return res.status(400).json({
        success: false,
        message: `Account is already ${linkedUser.accountStatus}. Resend invitation cannot be used for active accounts.`,
      });
    }

    // 4. Rotate token: Issue new raw token, store new SHA-256 hash, refresh 24h expiry
    const { rawToken, tokenHash } = generateInvitationTokenPair();
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS);
    const candidateName = profile.candidateName || linkedUser.name || 'Candidate';

    linkedUser.invitationTokenHash = tokenHash;
    linkedUser.invitationExpiresAt = expiresAt;
    linkedUser.invitationDeliveryStatus = 'pending';
    await linkedUser.save();

    // 5. Attempt email dispatch
    let emailResult = { success: false };
    try {
      emailResult = await emailService.sendInvitationEmail({
        to: linkedUser.email,
        name: candidateName,
        rawToken,
      });
    } catch (mailErr) {
      console.error(`[Reinvite Mailer Error] ${mailErr.message}`);
      emailResult = { success: false, error: mailErr.message };
    }

    if (emailResult.success) {
      linkedUser.invitationDeliveryStatus = 'sent';
      linkedUser.invitationSentAt = new Date();
      await linkedUser.save();

      return res.status(200).json({
        success: true,
        message: `Invitation email resent successfully to ${linkedUser.email}.`,
        data: {
          profileId: profile._id,
          userId: linkedUser._id,
          email: linkedUser.email,
          accountStatus: linkedUser.accountStatus,
          invitationDeliveryStatus: 'sent',
          expiresAt,
        },
      });
    } else {
      linkedUser.invitationDeliveryStatus = 'failed';
      await linkedUser.save();

      return res.status(200).json({
        success: true,
        warning: true,
        message: `Invitation token rotated, but email delivery failed (${emailResult.error || 'SMTP delivery failure'}). You may try resending again later.`,
        data: {
          profileId: profile._id,
          userId: linkedUser._id,
          email: linkedUser.email,
          accountStatus: linkedUser.accountStatus,
          invitationDeliveryStatus: 'failed',
          expiresAt,
        },
      });
    }
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAdminUsers,
  getAdminProfiles,
  createBrokerProfile,
  updateProfileApproval,
  uploadAdminBrokerPhoto,
  inviteBrokerCandidate,
  reinviteBrokerCandidate,
  parsePaginationParams,
  escapeRegex,
};
