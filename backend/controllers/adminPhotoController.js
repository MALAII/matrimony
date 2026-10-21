const mongoose = require('mongoose');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const cloudinaryConfig = require('../config/cloudinary');
const profileController = require('./profileController');

const MAX_PHOTOS_PER_CANDIDATE = 3;

/**
 * Normalizes legacy profile photo records into the photos gallery array
 * Ensures backward compatibility for profiles with profilePhoto.url but empty photos[]
 *
 * @param {import('mongoose').Document} profile
 * @returns {boolean} Whether the profile document was mutated
 */
const normalizeLegacyPhotos = (profile) => {
  let mutated = false;
  if ((!profile.photos || profile.photos.length === 0) && profile.profilePhoto?.url) {
    profile.photos = [
      {
        url: profile.profilePhoto.url,
        publicId: profile.profilePhoto.publicId || `legacy_${profile._id}`,
        isPrimary: true,
        uploadedAt: profile.updatedAt || new Date(),
      },
    ];
    mutated = true;
  }
  return mutated;
};

/**
 * @route   GET /api/admin/profiles/:id/photos
 * @desc    Get all photos for a candidate profile (up to 3)
 * @access  Private (Admin only)
 */
const getAdminCandidatePhotos = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID format',
      });
    }

    const profile = await MatrimonialProfile.findById(id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Matrimonial profile not found',
      });
    }

    // Handle legacy single-photo representation for display
    let photosList = profile.photos && profile.photos.length > 0 ? profile.photos : [];
    if (photosList.length === 0 && profile.profilePhoto?.url) {
      photosList = [
        {
          _id: profile._id,
          url: profile.profilePhoto.url,
          publicId: profile.profilePhoto.publicId,
          isPrimary: true,
          uploadedAt: profile.updatedAt || profile.createdAt,
        },
      ];
    }

    return res.status(200).json({
      success: true,
      data: {
        profileId: profile._id,
        candidateName: profile.candidateName || null,
        photos: photosList,
        primaryPhoto: profile.profilePhoto || null,
        count: photosList.length,
        maxAllowed: MAX_PHOTOS_PER_CANDIDATE,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/admin/profiles/:id/photos
 * @desc    Upload an additional photo for a candidate profile (enforcing strict max 3)
 * @access  Private (Admin only)
 */
const addAdminCandidatePhoto = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID format',
      });
    }

    if (!cloudinaryConfig.isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message:
          'Cloudinary photo storage is not configured on the server. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "No photo file provided. Please provide an image file with field name 'photo'",
      });
    }

    // 1. Initial document lookup and pre-check
    const profile = await MatrimonialProfile.findById(id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Matrimonial profile not found',
      });
    }

    // Normalize legacy photos if present
    const legacyNormalized = normalizeLegacyPhotos(profile);
    if (legacyNormalized) {
      await profile.save();
    }

    // Pre-upload capacity check
    if (profile.photos && profile.photos.length >= MAX_PHOTOS_PER_CANDIDATE) {
      return res.status(400).json({
        success: false,
        message: `Candidate profile already has the maximum allowed of ${MAX_PHOTOS_PER_CANDIDATE} photos. Delete or replace an existing photo.`,
      });
    }

    // 2. Upload asset to Cloudinary
    let uploadResult;
    try {
      uploadResult = await profileController.uploadToCloudinary(req.file.buffer);
    } catch (uploadErr) {
      console.error(`[Admin Photo Upload Error] ${uploadErr.message}`);
      return res.status(502).json({
        success: false,
        message: 'Failed to upload image to Cloudinary storage. Please try again.',
      });
    }

    const isFirstPhoto = !profile.photos || profile.photos.length === 0;
    const newPhotoDoc = {
      _id: new mongoose.Types.ObjectId(),
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      isPrimary: isFirstPhoto,
      uploadedAt: new Date(),
    };

    // 3. Atomic conditional update enforcing strict max 3 even under concurrent requests
    // Filter ensures array length is strictly less than 3 at moment of database write
    const updatedProfile = await MatrimonialProfile.findOneAndUpdate(
      {
        _id: id,
        $expr: {
          $lt: [{ $size: { $ifNull: ['$photos', []] } }, MAX_PHOTOS_PER_CANDIDATE],
        },
      },
      {
        $push: { photos: newPhotoDoc },
        ...(isFirstPhoto && {
          $set: {
            profilePhoto: {
              url: newPhotoDoc.url,
              publicId: newPhotoDoc.publicId,
            },
          },
        }),
      },
      { new: true, runValidators: true }
    );

    // If update returned null, a concurrent request reached the 3-photo ceiling first
    if (!updatedProfile) {
      try {
        await cloudinaryConfig.cloudinary.uploader.destroy(newPhotoDoc.publicId);
      } catch (cleanupErr) {
        console.error(`[Cloudinary Concurrency Rollback Error] ${cleanupErr.message}`);
      }
      return res.status(400).json({
        success: false,
        message: `Candidate profile already has the maximum allowed of ${MAX_PHOTOS_PER_CANDIDATE} photos. Concurrent upload rejected.`,
      });
    }

    // Ensure primary photo is synchronized
    updatedProfile.syncPrimaryPhoto();
    await updatedProfile.save();

    return res.status(201).json({
      success: true,
      message: 'Candidate photo uploaded successfully',
      data: {
        profileId: updatedProfile._id,
        photos: updatedProfile.photos,
        primaryPhoto: updatedProfile.profilePhoto,
        count: updatedProfile.photos.length,
        maxAllowed: MAX_PHOTOS_PER_CANDIDATE,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   PUT /api/admin/profiles/:id/photos/:photoId
 * @desc    Replace an existing photo in candidate profile
 * @access  Private (Admin only)
 */
const replaceAdminCandidatePhoto = async (req, res, next) => {
  try {
    const { id, photoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(photoId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID or photo ID format',
      });
    }

    if (!cloudinaryConfig.isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Cloudinary photo storage is not configured on the server.',
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "No replacement photo file provided. Field name must be 'photo'",
      });
    }

    const profile = await MatrimonialProfile.findById(id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Matrimonial profile not found',
      });
    }

    normalizeLegacyPhotos(profile);

    const targetPhoto = profile.photos.id(photoId);
    if (!targetPhoto) {
      return res.status(404).json({
        success: false,
        message: 'Target photo not found on this candidate profile',
      });
    }

    const oldPublicId = targetPhoto.publicId;
    const wasPrimary = targetPhoto.isPrimary;

    // 1. Upload replacement asset to Cloudinary
    let uploadResult;
    try {
      uploadResult = await profileController.uploadToCloudinary(req.file.buffer);
    } catch (uploadErr) {
      console.error(`[Admin Photo Replace Error] ${uploadErr.message}`);
      return res.status(502).json({
        success: false,
        message: 'Failed to upload replacement image to Cloudinary storage.',
      });
    }

    const newUrl = uploadResult.secure_url;
    const newPublicId = uploadResult.public_id;

    // 2. Update target subdocument
    targetPhoto.url = newUrl;
    targetPhoto.publicId = newPublicId;
    targetPhoto.uploadedAt = new Date();

    if (wasPrimary) {
      profile.profilePhoto = {
        url: newUrl,
        publicId: newPublicId,
      };
    }

    // 3. Persist to MongoDB with rollback protection
    try {
      await profile.save();
    } catch (dbErr) {
      try {
        await cloudinaryConfig.cloudinary.uploader.destroy(newPublicId);
      } catch (cleanupErr) {
        console.error(`[Cloudinary Rollback Error on Replace] ${cleanupErr.message}`);
      }
      throw dbErr;
    }

    // 4. Safely clean up old asset strictly AFTER DB write succeeds
    if (oldPublicId && oldPublicId !== newPublicId) {
      try {
        await cloudinaryConfig.cloudinary.uploader.destroy(oldPublicId);
      } catch (cleanupErr) {
        console.warn(
          `[Cloudinary Cleanup Warning] Failed to delete replaced image asset '${oldPublicId}': ${cleanupErr.message}`
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Candidate photo replaced successfully',
      data: {
        profileId: profile._id,
        photos: profile.photos,
        primaryPhoto: profile.profilePhoto,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   DELETE /api/admin/profiles/:id/photos/:photoId
 * @desc    Delete a photo from candidate profile and promote remaining photo if deleted photo was primary
 * @access  Private (Admin only)
 */
const deleteAdminCandidatePhoto = async (req, res, next) => {
  try {
    const { id, photoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(photoId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID or photo ID format',
      });
    }

    const profile = await MatrimonialProfile.findById(id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Matrimonial profile not found',
      });
    }

    normalizeLegacyPhotos(profile);

    const targetPhoto = profile.photos.id(photoId);
    if (!targetPhoto) {
      return res.status(404).json({
        success: false,
        message: 'Target photo not found on this candidate profile',
      });
    }

    const publicIdToDelete = targetPhoto.publicId;
    const wasPrimary = targetPhoto.isPrimary;

    // Pull photo from array
    profile.photos.pull({ _id: photoId });

    // Automatic primary promotion
    if (wasPrimary) {
      if (profile.photos.length > 0) {
        profile.photos[0].isPrimary = true;
        profile.profilePhoto = {
          url: profile.photos[0].url,
          publicId: profile.photos[0].publicId,
        };
      } else {
        profile.profilePhoto = {
          url: null,
          publicId: null,
        };
      }
    } else if (profile.photos.length === 0) {
      profile.profilePhoto = {
        url: null,
        publicId: null,
      };
    }

    // Persist to MongoDB
    await profile.save();

    // Safely delete Cloudinary asset strictly AFTER DB write succeeds
    if (publicIdToDelete && cloudinaryConfig.isCloudinaryConfigured()) {
      try {
        await cloudinaryConfig.cloudinary.uploader.destroy(publicIdToDelete);
      } catch (cleanupErr) {
        console.warn(
          `[Cloudinary Cleanup Warning] Failed to delete image asset '${publicIdToDelete}': ${cleanupErr.message}`
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Candidate photo deleted successfully',
      data: {
        profileId: profile._id,
        photos: profile.photos,
        primaryPhoto: profile.profilePhoto,
        count: profile.photos.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   PATCH /api/admin/profiles/:id/photos/:photoId/primary
 * @desc    Designate a specific photo as the primary photo
 * @access  Private (Admin only)
 */
const setAdminCandidatePrimaryPhoto = async (req, res, next) => {
  try {
    const { id, photoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(photoId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid profile ID or photo ID format',
      });
    }

    const profile = await MatrimonialProfile.findById(id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Matrimonial profile not found',
      });
    }

    normalizeLegacyPhotos(profile);

    const targetPhoto = profile.photos.id(photoId);
    if (!targetPhoto) {
      return res.status(404).json({
        success: false,
        message: 'Target photo not found on this candidate profile',
      });
    }

    // Set target photo as primary, reset all others
    profile.photos.forEach((p) => {
      p.isPrimary = p._id.toString() === photoId.toString();
    });

    profile.profilePhoto = {
      url: targetPhoto.url,
      publicId: targetPhoto.publicId,
    };

    await profile.save();

    return res.status(200).json({
      success: true,
      message: 'Primary photo updated successfully',
      data: {
        profileId: profile._id,
        photos: profile.photos,
        primaryPhoto: profile.profilePhoto,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  MAX_PHOTOS_PER_CANDIDATE,
  getAdminCandidatePhotos,
  addAdminCandidatePhoto,
  replaceAdminCandidatePhoto,
  deleteAdminCandidatePhoto,
  setAdminCandidatePrimaryPhoto,
};
