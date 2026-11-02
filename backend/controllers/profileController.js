const { Readable } = require('stream');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');

const ALLOWED_PROFILE_FIELDS = [
  'candidatePhone',
  'personalDetails',
  'communityDetails',
  'educationAndProfession',
  'familyDetails',
  'partnerPreferences',
  'profilePhoto',
  'horoscope',
];

const PHONE_FORMAT_REGEX = /^[+]?[\d\s()-]{7,25}$/;

/**
 * Validates and normalizes candidatePhone input for direct profile creation/update.
 * Never accepts emails or invalid phone formats.
 *
 * @param {any} rawPhone
 * @returns {{ provided: boolean, value: string | null, error?: string }}
 */
const validateCandidatePhoneInput = (rawPhone) => {
  if (rawPhone === undefined) {
    return { provided: false, value: null };
  }

  if (rawPhone === null) {
    return { provided: true, value: null };
  }

  if (typeof rawPhone !== 'string') {
    return {
      provided: true,
      value: null,
      error: 'Candidate phone must be a valid string',
    };
  }

  const trimmed = rawPhone.trim();
  if (trimmed.length === 0) {
    return { provided: true, value: null };
  }

  if (trimmed.length > 25) {
    return {
      provided: true,
      value: null,
      error: 'Candidate phone cannot exceed 25 characters',
    };
  }

  const digitCount = (trimmed.match(/\d/g) || []).length;
  if (trimmed.includes('@') || !PHONE_FORMAT_REGEX.test(trimmed) || digitCount < 7 || digitCount > 15) {
    return {
      provided: true,
      value: null,
      error: 'Please provide a valid candidate phone number (7 to 15 digits)',
    };
  }

  return { provided: true, value: trimmed };
};

/**
 * Strips raw candidatePhone and candidateEmail from profile API responses
 * while exposing `hasCandidatePhone` boolean so the profile owner knows if their phone is saved.
 */
const sanitizeOwnProfileResponse = (profileDoc) => {
  if (!profileDoc) return null;
  const obj =
    typeof profileDoc.toJSON === 'function'
      ? profileDoc.toJSON()
      : typeof profileDoc.toObject === 'function'
      ? profileDoc.toObject()
      : { ...profileDoc };

  const hasCandidatePhone = Boolean(
    obj.candidatePhone && typeof obj.candidatePhone === 'string' && obj.candidatePhone.trim().length > 0
  );

  delete obj.candidatePhone;
  delete obj.candidateEmail;
  obj.hasCandidatePhone = hasCandidatePhone;
  return obj;
};

/**
 * Uploads an image buffer to Cloudinary using upload_stream
 */
const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'matrimony/profiles',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });
};

/**
 * @route   POST /api/profiles/me
 * @desc    Create the authenticated user's matrimonial profile
 * @access  Private
 */
const createProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Safely strip any client-supplied owner IDs (never trust user ID from client)
    const sanitizedBody = { ...req.body };
    delete sanitizedBody.user;
    delete sanitizedBody.userId;
    delete sanitizedBody._id;

    // 2. Validate that only approved top-level profile fields are provided
    for (const key of Object.keys(sanitizedBody)) {
      if (!ALLOWED_PROFILE_FIELDS.includes(key)) {
        return res.status(400).json({
          success: false,
          message: `Invalid field: '${key}' is not an allowed profile field`,
        });
      }
    }

    // 3. Validate candidatePhone if provided
    const phoneCheck = validateCandidatePhoneInput(sanitizedBody.candidatePhone);
    if (phoneCheck.error) {
      return res.status(400).json({
        success: false,
        message: phoneCheck.error,
      });
    }

    // Normalize string dosham to schema object if needed
    if (sanitizedBody.horoscope && typeof sanitizedBody.horoscope.dosham === 'string') {
      const dStr = sanitizedBody.horoscope.dosham;
      sanitizedBody.horoscope.dosham = {
        hasChevvaiDosham: dStr.includes('Chevvai') || dStr.includes('Manglik'),
        hasNagaDosham: dStr.includes('Naga') || dStr.includes('Rahu'),
        doshamSummary: dStr,
        description: dStr,
      };
    }
    // Normalize string dasaBalance to schema object if needed
    if (sanitizedBody.horoscope && typeof sanitizedBody.horoscope.dasaBalance === 'string') {
      const dbStr = sanitizedBody.horoscope.dasaBalance;
      sanitizedBody.horoscope.dasaBalance = {
        planet: dbStr.split(' ')[0] || null,
        text: dbStr,
      };
    }

    // 4. Locate or instantiate matrimonial profile for user (idempotent upsert)
    let profile = await MatrimonialProfile.findOne({ user: userId });
    const isNew = !profile;

    if (isNew) {
      const profileData = {
        user: userId,
        source: 'direct',
        approvalStatus: 'approved',
        profileStatus: 'active',
        ...(phoneCheck.provided && { candidatePhone: phoneCheck.value }),
        personalDetails: sanitizedBody.personalDetails || {},
        communityDetails: sanitizedBody.communityDetails || {},
        educationAndProfession: sanitizedBody.educationAndProfession || {},
        familyDetails: sanitizedBody.familyDetails || {},
        partnerPreferences: sanitizedBody.partnerPreferences || {},
        profilePhoto: sanitizedBody.profilePhoto || {},
        horoscope: sanitizedBody.horoscope || {},
      };
      profile = await MatrimonialProfile.create(profileData);
    } else {
      // Update existing profile fields cleanly
      if (phoneCheck.provided) {
        profile.candidatePhone = phoneCheck.value;
      }
      if (sanitizedBody.personalDetails) {
        profile.personalDetails = { ...profile.personalDetails?.toObject?.(), ...sanitizedBody.personalDetails };
      }
      if (sanitizedBody.communityDetails) {
        profile.communityDetails = { ...profile.communityDetails?.toObject?.(), ...sanitizedBody.communityDetails };
      }
      if (sanitizedBody.educationAndProfession) {
        profile.educationAndProfession = { ...profile.educationAndProfession?.toObject?.(), ...sanitizedBody.educationAndProfession };
      }
      if (sanitizedBody.familyDetails) {
        profile.familyDetails = { ...profile.familyDetails?.toObject?.(), ...sanitizedBody.familyDetails };
      }
      if (sanitizedBody.partnerPreferences) {
        profile.partnerPreferences = { ...profile.partnerPreferences?.toObject?.(), ...sanitizedBody.partnerPreferences };
      }
      if (sanitizedBody.horoscope) {
        profile.horoscope = { ...profile.horoscope?.toObject?.(), ...sanitizedBody.horoscope };
      }
      if (sanitizedBody.profilePhoto && Object.keys(sanitizedBody.profilePhoto).length > 0) {
        profile.profilePhoto = sanitizedBody.profilePhoto;
      }
      await profile.save();
    }

    return res.status(isNew ? 201 : 200).json({
      success: true,
      message: isNew ? 'Matrimonial profile created successfully' : 'Matrimonial profile updated successfully',
      data: sanitizeOwnProfileResponse(profile),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A matrimonial profile already exists for this account',
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }

    next(error);
  }
};

/**
 * @route   GET /api/profiles/me
 * @desc    Get the authenticated user's own matrimonial profile
 * @access  Private
 */
const getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Retrieve profile strictly linked to authenticated user
    const profile = await MatrimonialProfile.findOne({ user: userId }).populate(
      'user',
      'name email role'
    );

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Matrimonial profile not found for this account',
      });
    }

    return res.status(200).json({
      success: true,
      data: sanitizeOwnProfileResponse(profile),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/profiles/me
 * @desc    Update the authenticated user's matrimonial profile
 * @access  Private
 */
const updateMyProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Locate authenticated user's profile (or auto-instantiate if not yet created)
    let profile = await MatrimonialProfile.findOne({ user: userId });
    if (!profile) {
      profile = new MatrimonialProfile({
        user: userId,
        source: 'direct',
        approvalStatus: 'approved',
        profileStatus: 'active',
      });
    }

    // 2. Reject request if body is empty
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one valid profile field to update',
      });
    }

    // 3. Strip any client attempt to modify profile owner or database ID
    const sanitizedBody = { ...req.body };
    delete sanitizedBody.user;
    delete sanitizedBody.userId;
    delete sanitizedBody._id;

    // Check if only prohibited fields were sent
    if (Object.keys(sanitizedBody).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Profile owner ID cannot be modified',
      });
    }

    // 4. Validate that remaining fields are in allowed profile fields
    for (const key of Object.keys(sanitizedBody)) {
      if (!ALLOWED_PROFILE_FIELDS.includes(key)) {
        return res.status(400).json({
          success: false,
          message: `Invalid field: '${key}' is not an editable profile field`,
        });
      }
    }

    // 5. Validate and apply candidatePhone if provided
    if (Object.prototype.hasOwnProperty.call(sanitizedBody, 'candidatePhone')) {
      const phoneCheck = validateCandidatePhoneInput(sanitizedBody.candidatePhone);
      if (phoneCheck.error) {
        return res.status(400).json({
          success: false,
          message: phoneCheck.error,
        });
      }
      profile.candidatePhone = phoneCheck.value;
    }

    // 6. Merge approved updates
    if (sanitizedBody.personalDetails) {
      profile.personalDetails = {
        ...(typeof profile.personalDetails?.toObject === 'function'
          ? profile.personalDetails.toObject()
          : profile.personalDetails || {}),
        ...sanitizedBody.personalDetails,
      };
    }

    if (sanitizedBody.communityDetails) {
      profile.communityDetails = {
        ...(typeof profile.communityDetails?.toObject === 'function'
          ? profile.communityDetails.toObject()
          : profile.communityDetails || {}),
        ...sanitizedBody.communityDetails,
      };
    }

    if (sanitizedBody.educationAndProfession) {
      profile.educationAndProfession = {
        ...(typeof profile.educationAndProfession?.toObject === 'function'
          ? profile.educationAndProfession.toObject()
          : profile.educationAndProfession || {}),
        ...sanitizedBody.educationAndProfession,
      };
    }

    if (sanitizedBody.familyDetails) {
      profile.familyDetails = {
        ...(typeof profile.familyDetails?.toObject === 'function'
          ? profile.familyDetails.toObject()
          : profile.familyDetails || {}),
        ...sanitizedBody.familyDetails,
      };
    }

    if (sanitizedBody.partnerPreferences) {
      const existingPartner =
        typeof profile.partnerPreferences?.toObject === 'function'
          ? profile.partnerPreferences.toObject()
          : profile.partnerPreferences || {};
      const newPartner = sanitizedBody.partnerPreferences;

      profile.partnerPreferences = {
        ...existingPartner,
        ...newPartner,
        preferredAgeRange: {
          ...(existingPartner.preferredAgeRange || {}),
          ...(newPartner.preferredAgeRange || {}),
        },
      };
    }

    if (sanitizedBody.profilePhoto) {
      profile.profilePhoto = {
        ...(typeof profile.profilePhoto?.toObject === 'function'
          ? profile.profilePhoto.toObject()
          : profile.profilePhoto || {}),
        ...sanitizedBody.profilePhoto,
      };
    }

    if (sanitizedBody.horoscope) {
      if (typeof sanitizedBody.horoscope.dosham === 'string') {
        const dStr = sanitizedBody.horoscope.dosham;
        sanitizedBody.horoscope.dosham = {
          hasChevvaiDosham: dStr.includes('Chevvai') || dStr.includes('Manglik'),
          hasNagaDosham: dStr.includes('Naga') || dStr.includes('Rahu'),
          doshamSummary: dStr,
          description: dStr,
        };
      }
      if (typeof sanitizedBody.horoscope.dasaBalance === 'string') {
        const dbStr = sanitizedBody.horoscope.dasaBalance;
        sanitizedBody.horoscope.dasaBalance = {
          planet: dbStr.split(' ')[0] || null,
          text: dbStr,
        };
      }
      const existingHoro =
        typeof profile.horoscope?.toObject === 'function'
          ? profile.horoscope.toObject()
          : profile.horoscope || {};
      const newHoro = sanitizedBody.horoscope;
      profile.horoscope = {
        ...existingHoro,
        ...newHoro,
        ...(newHoro.dasaBalance && {
          dasaBalance: {
            ...(existingHoro.dasaBalance || {}),
            ...newHoro.dasaBalance,
          },
        }),
        ...(newHoro.dosham && {
          dosham: {
            ...(existingHoro.dosham || {}),
            ...newHoro.dosham,
          },
        }),
      };
    }

    // 7. Save and execute validations
    await profile.save();

    return res.status(200).json({
      success: true,
      message: 'Matrimonial profile updated successfully',
      data: sanitizeOwnProfileResponse(profile),
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }

    next(error);
  }
};

/**
 * @route   POST /api/profiles/me/photo
 * @desc    Upload or replace matrimonial profile photograph via Cloudinary
 * @access  Private
 */
const uploadProfilePhoto = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 1. Matrimonial profile must exist (or auto-create for authenticated user)
    let profile = await MatrimonialProfile.findOne({ user: userId });
    if (!profile) {
      profile = await MatrimonialProfile.create({
        user: userId,
        source: 'direct',
        approvalStatus: 'approved',
        profileStatus: 'active',
      });
    }

    // 2. Cloudinary configuration check
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message:
          'Cloudinary photo storage is not configured on the server. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env',
      });
    }

    // 3. Keep reference to previous photo's publicId for deletion after successful update
    const oldPublicId = profile.profilePhoto?.publicId;

    // 4. Upload replacement image to Cloudinary first
    let uploadResult;
    try {
      uploadResult = await uploadToCloudinary(req.file.buffer);
    } catch (uploadErr) {
      console.error(`[Cloudinary Upload Error] ${uploadErr.message}`);
      return res.status(502).json({
        success: false,
        message: 'Failed to upload image to Cloudinary storage. Please try again.',
      });
    }

    const newUrl = uploadResult.secure_url;
    const newPublicId = uploadResult.public_id;

    // 5. Update MongoDB profile with new URL and public ID
    try {
      profile.profilePhoto = {
        url: newUrl,
        publicId: newPublicId,
      };
      await profile.save();
    } catch (dbError) {
      // 5b. If database update fails, clean up newly uploaded image from Cloudinary
      try {
        await cloudinary.uploader.destroy(newPublicId);
      } catch (cleanupErr) {
        console.error(`[Cloudinary Cleanup Error] ${cleanupErr.message}`);
      }
      throw dbError;
    }

    // 6. After database update succeeds, delete previous Cloudinary image
    if (oldPublicId) {
      try {
        await cloudinary.uploader.destroy(oldPublicId);
      } catch (deleteErr) {
        console.warn(
          `[Cloudinary Warning] Failed to delete previous image asset '${oldPublicId}': ${deleteErr.message}`
        );
      }
    }

    // 7. Return updated profile photo info without exposing credentials
    return res.status(200).json({
      success: true,
      message: 'Profile photo uploaded successfully',
      data: {
        id: profile._id,
        _id: profile._id,
        url: profile.profilePhoto.url,
        publicId: profile.profilePhoto.publicId,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProfile,
  getMyProfile,
  updateMyProfile,
  uploadProfilePhoto,
  uploadToCloudinary,
};
