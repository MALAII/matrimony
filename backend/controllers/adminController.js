const mongoose = require('mongoose');
const User = require('../models/User');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const Subscription = require('../models/Subscription');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const { uploadToCloudinary } = require('./profileController');

// Allowlist of allowed top-level profile fields for broker profile creation
const ALLOWED_BROKER_PROFILE_FIELDS = [
  'candidateName',
  'candidateEmail',
  'candidatePhone',
  'personalDetails',
  'communityDetails',
  'educationAndProfession',
  'familyDetails',
  'partnerPreferences',
  'profilePhoto',
  'photos',
  'horoscope',
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

const ALLOWED_ACCOUNT_STATUSES = ['active', 'invited', 'suspended', 'inactive'];
const ALLOWED_ROLES = ['user', 'admin'];
const ALLOWED_REGISTRATION_SOURCES = ['direct', 'broker'];

/**
 * Escapes a cell for CSV export to protect against spreadsheet formula injection
 * (e.g., values starting with =, +, -, @, \t, \r) and wraps cells containing commas,
 * double quotes, or newlines according to RFC 4180.
 * @param {*} val
 * @returns {string}
 */
const escapeCsvCell = (val) => {
  if (val === null || val === undefined) return '';
  let str = String(val);
  // Neutralize formula injection risk if cell starts with dangerous spreadsheet formula triggers: =, +, -, @, \t, \r
  if (/^[\=\+\-\@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // Wrap in quotes if comma, newline, quote, or carriage return present, and escape existing double quotes
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Parses and validates user filter parameters including status, role, registrationSource, and pagination
 * @param {object} query
 * @returns {{ page?: number, limit?: number, search?: string, status?: string|null, role?: string|null, registrationSource?: string|null, error?: string }}
 */
const parseUserFilterParams = (query = {}) => {
  const paginationResult = parsePaginationParams(query);
  if (paginationResult.error) {
    return paginationResult;
  }

  const rawStatus = typeof query.status === 'string'
    ? query.status.trim()
    : typeof query.accountStatus === 'string'
      ? query.accountStatus.trim()
      : '';

  const rawRole = typeof query.role === 'string' ? query.role.trim() : '';

  const rawSource = typeof query.registrationSource === 'string'
    ? query.registrationSource.trim()
    : typeof query.source === 'string'
      ? query.source.trim()
      : '';

  let status = null;
  if (rawStatus) {
    if (!ALLOWED_ACCOUNT_STATUSES.includes(rawStatus)) {
      return {
        error: `Invalid status parameter: "${rawStatus}". Allowed values: ${ALLOWED_ACCOUNT_STATUSES.join(', ')}`,
      };
    }
    status = rawStatus;
  }

  let role = null;
  if (rawRole) {
    if (!ALLOWED_ROLES.includes(rawRole)) {
      return {
        error: `Invalid role parameter: "${rawRole}". Allowed values: ${ALLOWED_ROLES.join(', ')}`,
      };
    }
    role = rawRole;
  }

  let registrationSource = null;
  if (rawSource) {
    if (!ALLOWED_REGISTRATION_SOURCES.includes(rawSource)) {
      return {
        error: `Invalid registrationSource parameter: "${rawSource}". Allowed values: ${ALLOWED_REGISTRATION_SOURCES.join(', ')}`,
      };
    }
    registrationSource = rawSource;
  }

  return {
    ...paginationResult,
    status,
    role,
    registrationSource,
  };
};

/**
 * Builds MongoDB filter object for user queries
 * @param {{ search?: string, status?: string|null, role?: string|null, registrationSource?: string|null }} params
 * @returns {object}
 */
const buildUserFilter = ({ search, status, role, registrationSource }) => {
  const filter = {};
  if (status) {
    filter.accountStatus = status;
  }
  if (role) {
    filter.role = role;
  }
  if (registrationSource) {
    filter.registrationSource = registrationSource;
  }
  if (search) {
    const searchRegex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: searchRegex }, { email: searchRegex }];
  }
  return filter;
};

/**
 * @route   GET /api/admin/users/stats
 * @desc    Aggregate user account metrics (total, active, invited, suspended/inactive, verified emails, subscribed users)
 * @access  Private (Admin only)
 */
const getAdminUserStats = async (req, res, next) => {
  try {
    const [
      totalAccounts,
      activeAccounts,
      invitedAccounts,
      suspendedAccounts,
      inactiveAccounts,
      verifiedEmails,
      activeSubscribedUsers,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ accountStatus: 'active' }),
      User.countDocuments({ accountStatus: 'invited' }),
      User.countDocuments({ accountStatus: 'suspended' }),
      User.countDocuments({ accountStatus: 'inactive' }),
      User.countDocuments({ emailVerifiedAt: { $ne: null } }),
      Subscription.distinct('user', { status: 'active' }),
    ]);

    const suspendedOrInactive = suspendedAccounts + inactiveAccounts;
    const subscribedUsers = activeSubscribedUsers.length;

    return res.status(200).json({
      success: true,
      data: {
        totalAccounts,
        active: activeAccounts,
        invited: invitedAccounts,
        suspended: suspendedAccounts,
        inactive: inactiveAccounts,
        suspendedOrInactive,
        verifiedEmails,
        subscribedUsers,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/admin/users
 * @desc    Get paginated listing of user records with filter support and linked profile/subscription badges
 * @access  Private (Admin only)
 */
const getAdminUsers = async (req, res, next) => {
  try {
    const { page, limit, search, status, role, registrationSource, error } = parseUserFilterParams(req.query);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    // Build filter query
    const filter = buildUserFilter({ search, status, role, registrationSource });

    // Database count and query
    const totalRecords = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit) || 1;
    const skip = (page - 1) * limit;

    const users = await User.find(filter)
      .select('-passwordHash -invitationTokenHash -passwordResetTokenHash -__v')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Fetch linked profiles and subscriptions in parallel for current page users
    const userIds = users.map((u) => u._id);
    const [profiles, subscriptions] = await Promise.all([
      MatrimonialProfile.find({ user: { $in: userIds } })
        .select('user candidateName approvalStatus profileStatus deactivationReason createdAt')
        .lean(),
      Subscription.find({ user: { $in: userIds } })
        .sort({ createdAt: -1 })
        .select('user planCode status startDate endDate gracePeriodEndDate')
        .lean(),
    ]);

    const profileMap = new Map();
    profiles.forEach((p) => {
      if (p.user) {
        profileMap.set(p.user.toString(), {
          _id: p._id,
          id: p._id,
          candidateName: p.candidateName,
          approvalStatus: p.approvalStatus,
          profileStatus: p.profileStatus,
          deactivationReason: p.deactivationReason,
          createdAt: p.createdAt,
        });
      }
    });

    const subMap = new Map();
    subscriptions.forEach((s) => {
      if (s.user && !subMap.has(s.user.toString())) {
        subMap.set(s.user.toString(), {
          planCode: s.planCode,
          status: s.status,
          startDate: s.startDate,
          endDate: s.endDate,
          gracePeriodEndDate: s.gracePeriodEndDate,
        });
      }
    });

    const enrichedUsers = users.map((u) => {
      const uObj = typeof u.toObject === 'function' ? u.toObject() : { ...u };
      delete uObj.passwordHash;
      delete uObj.invitationTokenHash;
      delete uObj.passwordResetTokenHash;
      delete uObj.__v;
      const uidStr = (uObj._id || uObj.id).toString();
      uObj.profile = profileMap.get(uidStr) || null;
      uObj.subscription = subMap.get(uidStr) || null;
      return uObj;
    });

    return res.status(200).json({
      success: true,
      data: enrichedUsers,
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
 * @route   GET /api/admin/users/export
 * @desc    Export filtered user accounts as streaming CSV with formula injection protection
 * @access  Private (Admin only)
 */
const exportAdminUsersCsv = async (req, res, next) => {
  try {
    const { search, status, role, registrationSource, error } = parseUserFilterParams(req.query);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const filter = buildUserFilter({ search, status, role, registrationSource });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="users-export-${timestamp}.csv"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Emit UTF-8 BOM so spreadsheet editors like Excel render special characters correctly
    res.write('\uFEFF');

    const csvHeaders = [
      'User ID',
      'Name',
      'Email',
      'Role',
      'Account Status',
      'Registration Source',
      'Email Verified',
      'Email Verified At',
      'Registration Date',
      'Linked Profile ID',
      'Candidate Name',
      'Profile Status',
      'Profile Approval Status',
      'Subscription Plan',
      'Subscription Status',
      'Subscription End Date',
    ];

    res.write(csvHeaders.map(escapeCsvCell).join(',') + '\r\n');

    // Stream cursor in bounded chunks of 100 users
    const cursor = User.find(filter)
      .select('name email role accountStatus registrationSource emailVerifiedAt createdAt')
      .sort({ createdAt: -1 })
      .cursor();

    const BATCH_SIZE = 100;
    let batch = [];

    const processBatch = async (usersBatch) => {
      const userIds = usersBatch.map((u) => u._id);
      const [profiles, subscriptions] = await Promise.all([
        MatrimonialProfile.find({ user: { $in: userIds } })
          .select('user candidateName approvalStatus profileStatus')
          .lean(),
        Subscription.find({ user: { $in: userIds } })
          .sort({ createdAt: -1 })
          .select('user planCode status endDate')
          .lean(),
      ]);

      const profileMap = new Map();
      profiles.forEach((p) => {
        if (p.user) profileMap.set(p.user.toString(), p);
      });

      const subMap = new Map();
      subscriptions.forEach((s) => {
        if (s.user && !subMap.has(s.user.toString())) {
          subMap.set(s.user.toString(), s);
        }
      });

      for (const user of usersBatch) {
        const uidStr = user._id.toString();
        const profile = profileMap.get(uidStr);
        const sub = subMap.get(uidStr);

        const row = [
          uidStr,
          user.name || '',
          user.email || '',
          user.role || '',
          user.accountStatus || '',
          user.registrationSource || '',
          user.emailVerifiedAt ? 'Yes' : 'No',
          user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : '',
          user.createdAt ? user.createdAt.toISOString() : '',
          profile ? profile._id.toString() : 'None',
          profile ? profile.candidateName || '' : '',
          profile ? profile.profileStatus || '' : 'N/A',
          profile ? profile.approvalStatus || '' : 'N/A',
          sub ? sub.planCode || '' : 'None',
          sub ? sub.status || '' : 'None',
          sub && sub.endDate ? sub.endDate.toISOString() : 'N/A',
        ];

        res.write(row.map(escapeCsvCell).join(',') + '\r\n');
      }
    };

    for await (const doc of cursor) {
      batch.push(doc);
      if (batch.length >= BATCH_SIZE) {
        await processBatch(batch);
        batch = [];
      }
    }

    if (batch.length > 0) {
      await processBatch(batch);
    }

    res.end();
  } catch (err) {
    if (!res.headersSent) {
      next(err);
    } else {
      res.end();
    }
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
    const { approvalStatus: qApproval, profileStatus: qStatus, source: qSource, gender: qGender } = req.query;
    if (['pending_approval', 'approved', 'rejected'].includes(qApproval)) filter.approvalStatus = qApproval;
    if (['active', 'inactive'].includes(qStatus)) filter.profileStatus = qStatus;
    if (['direct', 'broker'].includes(qSource)) filter.source = qSource;
    if (['Male', 'Female', 'Other'].includes(qGender)) filter['personalDetails.gender'] = qGender;

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
        { candidatePhone: searchRegex },
        { 'personalDetails.location': searchRegex },
        { 'personalDetails.nativity': searchRegex },
        { 'personalDetails.motherTongue': searchRegex },
        { 'communityDetails.caste': searchRegex },
        { 'communityDetails.subcaste': searchRegex },
        { 'communityDetails.gothram': searchRegex },
        { 'communityDetails.religion': searchRegex },
        { 'horoscope.rasi': searchRegex },
        { 'horoscope.nakshatram': searchRegex },
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

    // 6. Normalize horoscope dosham & dasaBalance if passed as strings
    const horoscopeData = { ...(sanitizedBody.horoscope || {}) };
    if (typeof horoscopeData.dosham === 'string') {
      const dStr = horoscopeData.dosham.trim();
      const lower = dStr.toLowerCase();
      horoscopeData.dosham = {
        hasChevvaiDosham: lower.includes('chevvai') || lower.includes('sevvai') || lower.includes('manglik'),
        hasNagaDosham: lower.includes('naga') || lower.includes('rahu') || lower.includes('kethu') || lower.includes('ketu'),
        doshamSummary: dStr || 'None',
        description: dStr || null,
      };
    }
    if (typeof horoscopeData.dasaBalance === 'string') {
      const dbStr = horoscopeData.dasaBalance.trim();
      horoscopeData.dasaBalance = {
        planet: dbStr.split(' ')[0] || null,
        text: dbStr,
      };
    }

    // 7. Assemble profile data with strict server-enforced business invariants:
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
      communityDetails: sanitizedBody.communityDetails || {},
      educationAndProfession: sanitizedBody.educationAndProfession || {},
      familyDetails: sanitizedBody.familyDetails || {},
      partnerPreferences: sanitizedBody.partnerPreferences || {},
      profilePhoto: sanitizedBody.profilePhoto || {},
      photos: Array.isArray(sanitizedBody.photos) ? sanitizedBody.photos : [],
      horoscope: horoscopeData,
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
        horoscope: newProfile.horoscope,
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
      if (profile.photos && profile.photos.length > 0) {
        const primIndex = profile.photos.findIndex((p) => p.isPrimary);
        const targetIdx = primIndex >= 0 ? primIndex : 0;
        profile.photos[targetIdx].url = newUrl;
        profile.photos[targetIdx].publicId = newPublicId;
        profile.photos[targetIdx].isPrimary = true;
      }
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

    // 3. Precondition: Must be an unlinked candidate profile (broker-imported or admin-created)
    if (profile.source !== 'broker' && profile.user !== null) {
      return res.status(400).json({
        success: false,
        message: 'Invitations are restricted to unlinked candidate profiles only.',
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
      { $set: { user: newUser._id, candidateEmail: candidateEmailToUse } },
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
    if (profile.source !== 'broker' && profile.user?.registrationSource !== 'broker' && profile.user?.accountStatus !== 'invited') {
      return res.status(400).json({
        success: false,
        message: 'Invitation resend is restricted to invited candidate profiles only.',
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

    // 4. Handle optional email correction
    let targetEmail = linkedUser.email;
    const oldEmail = linkedUser.email;
    let emailChanged = false;
    const { email } = req.body || {};

    if (email && typeof email === 'string' && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address for invitation resend.',
        });
      }

      if (normalizedEmail !== linkedUser.email.toLowerCase()) {
        // Collision check: reject if another user owns this email
        const existingUser = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: linkedUser._id },
        });
        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: `An account with email '${normalizedEmail}' already exists.`,
          });
        }
        targetEmail = normalizedEmail;
        emailChanged = true;
      }
    }

    // 5. Rotate token: Issue new raw token, store new SHA-256 hash, refresh 24h expiry
    const { rawToken, tokenHash } = generateInvitationTokenPair();
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_MS);
    const candidateName = profile.candidateName || linkedUser.name || 'Candidate';

    linkedUser.invitationTokenHash = tokenHash;
    linkedUser.invitationExpiresAt = expiresAt;
    linkedUser.invitationDeliveryStatus = 'pending';
    if (emailChanged) {
      linkedUser.email = targetEmail;
    }
    await linkedUser.save();

    // Synchronize candidateEmail on profile with rollback on failure
    if (emailChanged) {
      try {
        profile.candidateEmail = targetEmail;
        await profile.save();
      } catch (profileSaveErr) {
        // Rollback user email to maintain consistency
        linkedUser.email = oldEmail;
        await linkedUser.save();
        throw profileSaveErr;
      }
    }

    // 6. Attempt email dispatch
    let emailResult = { success: false };
    try {
      emailResult = await emailService.sendInvitationEmail({
        to: targetEmail,
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
        message: `Invitation email sent successfully to ${targetEmail}.`,
        data: {
          profileId: profile._id,
          userId: linkedUser._id,
          email: targetEmail,
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
        message: `Invitation token rotated for ${targetEmail}, but email delivery failed (${emailResult.error || 'SMTP delivery failure'}). You may try resending again.`,
        data: {
          profileId: profile._id,
          userId: linkedUser._id,
          email: targetEmail,
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

const EDITABLE_GROUPS = ['personalDetails', 'educationAndProfession', 'familyDetails', 'communityDetails', 'horoscope', 'partnerPreferences'];
const EDITABLE_TOP = ['candidateName', 'candidatePhone'];

/**
 * @route   PATCH /api/admin/profiles/:id
 * @desc    Admin edit of candidate/contact details and profile sections
 * @access  Private (Admin only)
 */
const updateAdminProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid profile ID format' });
    }
    const body = req.body || {};
    const profile = await MatrimonialProfile.findById(id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Matrimonial profile not found' });
    }

    let changed = 0;

    // Handle candidateEmail with synchronization to linked invited User
    if (body.candidateEmail !== undefined) {
      const emailVal = typeof body.candidateEmail === 'string' ? body.candidateEmail.trim() : '';
      const normalizedEmail = emailVal.toLowerCase();
      if (emailVal && !EMAIL_REGEX.test(normalizedEmail)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid candidate email address' });
      }

      if (profile.user) {
        const linkedUser = await User.findById(profile.user);
        if (linkedUser) {
          if (linkedUser.accountStatus === 'active' && linkedUser.email !== normalizedEmail && normalizedEmail) {
            return res.status(400).json({
              success: false,
              message: 'Cannot change email of an active candidate account. Account credentials must be managed separately.',
            });
          }
          if (linkedUser.accountStatus === 'invited' && linkedUser.email !== normalizedEmail && normalizedEmail) {
            const existingUser = await User.findOne({
              email: normalizedEmail,
              _id: { $ne: linkedUser._id },
            });
            if (existingUser) {
              return res.status(409).json({
                success: false,
                message: `An account with email '${normalizedEmail}' already exists.`,
              });
            }
            linkedUser.email = normalizedEmail;
            // Invalidate outstanding invitation token because recipient email was modified
            linkedUser.invitationTokenHash = null;
            linkedUser.invitationExpiresAt = null;
            linkedUser.invitationDeliveryStatus = 'pending';
            await linkedUser.save();
          }
        }
      }
      profile.candidateEmail = normalizedEmail || null;
      changed++;
    }

    for (const key of EDITABLE_TOP) {
      if (typeof body[key] === 'string') {
        profile.set(key, body[key].trim());
        changed++;
      }
    }
    for (const group of EDITABLE_GROUPS) {
      const section = body[group];
      if (section && typeof section === 'object' && !Array.isArray(section)) {
        for (const [field, rawVal] of Object.entries(section)) {
          if (field.startsWith('$') || field.includes('.')) continue;
          let value = rawVal;
          if (group === 'horoscope' && field === 'dosham') {
            if (typeof value === 'string') {
              const lower = value.toLowerCase();
              value = {
                hasChevvaiDosham: lower.includes('chevvai') || lower.includes('sevvai'),
                hasNagaDosham: lower.includes('naga'),
                doshamSummary: value,
              };
            }
            profile.set(`${group}.${field}`, value);
            changed++;
            continue;
          }
          if (value !== null && typeof value === 'object' && !(group === 'partnerPreferences' && field === 'preferredAgeRange')) continue;
          profile.set(`${group}.${field}`, value);
          changed++;
        }
      }
    }
    if (changed === 0) {
      return res.status(400).json({ success: false, message: 'No editable fields were provided' });
    }

    try {
      await profile.save();
    } catch (err) {
      if (err.name === 'ValidationError') {
        const first = Object.values(err.errors)[0];
        return res.status(400).json({ success: false, message: first ? first.message : 'Validation failed' });
      }
      throw err;
    }
    const populated = await MatrimonialProfile.findById(id).populate('user', 'name email role accountStatus');
    return res.status(200).json({ success: true, message: 'Profile updated', data: populated });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   PATCH /api/admin/profiles/:id/status
 * @desc    Activate or deactivate a profile (hidden from the member directory when inactive)
 * @access  Private (Admin only)
 */
const updateAdminProfileStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { profileStatus } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid profile ID format' });
    }
    if (!['active', 'inactive'].includes(profileStatus)) {
      return res.status(400).json({ success: false, message: "profileStatus must be 'active' or 'inactive'" });
    }
    const profile = await MatrimonialProfile.findById(id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Matrimonial profile not found' });
    }
    profile.profileStatus = profileStatus;
    profile.deactivationReason = profileStatus === 'inactive' ? 'admin_action' : null;
    profile.deactivatedAt = profileStatus === 'inactive' ? new Date() : null;
    await profile.save();
    return res.status(200).json({ success: true, message: `Profile ${profileStatus === 'active' ? 'activated' : 'deactivated'}`, data: profile });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   DELETE /api/admin/profiles/:id
 * @desc    Permanently delete a broker-sourced profile that has no linked login account
 * @access  Private (Admin only)
 */
const deleteAdminProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid profile ID format' });
    }
    const profile = await MatrimonialProfile.findById(id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Matrimonial profile not found' });
    }
    if (profile.source !== 'broker' || profile.user) {
      return res.status(409).json({
        success: false,
        message: 'Only broker profiles without a linked account can be deleted. Deactivate member profiles instead.',
      });
    }
    await profile.deleteOne();
    return res.status(200).json({ success: true, message: 'Profile deleted' });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/admin/profiles/:id
 * @desc    Get complete candidate profile dossier for administrative review
 * @access  Private (Admin only)
 */
const getAdminProfileDetail = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid profile ID format' });
    }
    const profile = await MatrimonialProfile.findById(id).populate(
      'user',
      'name email role accountStatus registrationSource invitationSentAt createdAt'
    );
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Matrimonial profile not found' });
    }
    return res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAdminUsers,
  getAdminUserStats,
  exportAdminUsersCsv,
  getAdminProfiles,
  getAdminProfileDetail,
  createBrokerProfile,
  updateProfileApproval,
  updateAdminProfile,
  updateAdminProfileStatus,
  deleteAdminProfile,
  uploadAdminBrokerPhoto,
  inviteBrokerCandidate,
  reinviteBrokerCandidate,
  parsePaginationParams,
  parseUserFilterParams,
  buildUserFilter,
  escapeCsvCell,
  escapeRegex,
};
