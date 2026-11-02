const mongoose = require('mongoose');
const MatrimonialProfile = require('../models/MatrimonialProfile');
const cloudinaryConfig = require('../config/cloudinary');
const profileController = require('./profileController');
const {
  MAX_PHOTOS_PER_CANDIDATE,
} = require('./adminPhotoController');

/**
 * Normalizes legacy profile photo records into the photos gallery array
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
 * Helper to find or create the authenticated user's profile
 */
const getOrCreateUserProfile = async (userId) => {
  let profile = await MatrimonialProfile.findOne({ user: userId });
  if (!profile) {
    profile = await MatrimonialProfile.create({
      user: userId,
      source: 'direct',
      approvalStatus: 'approved',
      profileStatus: 'active',
    });
  }
  return profile;
};

/**
 * @route   GET /api/profiles/me/photos
 * @desc    Get authenticated user's gallery photos (up to 3)
 * @access  Private (Authenticated User)
 */
const getMyPhotos = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const profile = await getOrCreateUserProfile(userId);

    let photosList = profile.photos && profile.photos.length > 0 ? profile.photos : [];
    if (photosList.length === 0 && profile.profilePhoto?.url) {
      photosList = [
        {
          _id: profile._id,
          url: profile.profilePhoto.url,
          publicId: profile.profilePhoto.publicId || `legacy_${profile._id}`,
          isPrimary: true,
          uploadedAt: profile.updatedAt || new Date(),
        },
      ];
    }

    const primaryPhoto =
      photosList.find((p) => p.isPrimary) ||
      photosList[0] ||
      (profile.profilePhoto?.url ? profile.profilePhoto : null);

    return res.status(200).json({
      success: true,
      data: {
        profileId: profile._id,
        photos: photosList,
        primaryPhoto,
        count: photosList.length,
        maxAllowed: MAX_PHOTOS_PER_CANDIDATE,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/profiles/me/photos
 * @desc    Upload an additional photo for user's profile (max 3)
 * @access  Private (Authenticated User)
 */
const addMyPhoto = async (req, res, next) => {
  try {
    const userId = req.user._id;

    if (!cloudinaryConfig.isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Photo storage is not configured on the server.',
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "No photo file provided. Please provide an image with field name 'photo'",
      });
    }

    const profile = await getOrCreateUserProfile(userId);

    const legacyNormalized = normalizeLegacyPhotos(profile);
    if (legacyNormalized) {
      await profile.save();
    }

    if (profile.photos && profile.photos.length >= MAX_PHOTOS_PER_CANDIDATE) {
      return res.status(400).json({
        success: false,
        message: `Your profile already has the maximum allowed of ${MAX_PHOTOS_PER_CANDIDATE} photos. Please delete or replace an existing photo.`,
      });
    }

    let uploadResult;
    try {
      uploadResult = await profileController.uploadToCloudinary(req.file.buffer);
    } catch (uploadErr) {
      console.error(`[User Photo Upload Error] ${uploadErr.message}`);
      return res.status(502).json({
        success: false,
        message: 'Failed to upload photo to storage. Please try again.',
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

    const updatedProfile = await MatrimonialProfile.findOneAndUpdate(
      {
        _id: profile._id,
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

    if (!updatedProfile) {
      try {
        await cloudinaryConfig.cloudinary.uploader.destroy(newPhotoDoc.publicId);
      } catch (cleanupErr) {
        console.error(`[User Photo Rollback Error] ${cleanupErr.message}`);
      }
      return res.status(400).json({
        success: false,
        message: `Maximum limit of ${MAX_PHOTOS_PER_CANDIDATE} photos reached. Upload rejected.`,
      });
    }

    updatedProfile.syncPrimaryPhoto();
    await updatedProfile.save();

    return res.status(201).json({
      success: true,
      message: 'Photo uploaded successfully',
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
 * @route   PUT /api/profiles/me/photos/:photoId
 * @desc    Replace a specific photo
 * @access  Private (Authenticated User)
 */
const replaceMyPhoto = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { photoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(photoId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid photo ID format',
      });
    }

    if (!cloudinaryConfig.isCloudinaryConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Photo storage is not configured on the server.',
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "No replacement photo provided. Field name must be 'photo'",
      });
    }

    const profile = await MatrimonialProfile.findOne({ user: userId });
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
        message: 'Target photo not found on your profile',
      });
    }

    const oldPublicId = targetPhoto.publicId;
    const wasPrimary = targetPhoto.isPrimary;

    let uploadResult;
    try {
      uploadResult = await profileController.uploadToCloudinary(req.file.buffer);
    } catch (uploadErr) {
      console.error(`[User Photo Replace Error] ${uploadErr.message}`);
      return res.status(502).json({
        success: false,
        message: 'Failed to upload replacement photo.',
      });
    }

    const newUrl = uploadResult.secure_url;
    const newPublicId = uploadResult.public_id;

    targetPhoto.url = newUrl;
    targetPhoto.publicId = newPublicId;
    targetPhoto.uploadedAt = new Date();

    if (wasPrimary) {
      profile.profilePhoto = {
        url: newUrl,
        publicId: newPublicId,
      };
    }

    try {
      await profile.save();
    } catch (dbErr) {
      try {
        await cloudinaryConfig.cloudinary.uploader.destroy(newPublicId);
      } catch (cleanupErr) {
        console.error(`[User Photo Rollback Error] ${cleanupErr.message}`);
      }
      throw dbErr;
    }

    if (oldPublicId && oldPublicId !== newPublicId) {
      try {
        await cloudinaryConfig.cloudinary.uploader.destroy(oldPublicId);
      } catch (cleanupErr) {
        console.warn(`[User Photo Cleanup Warning] ${cleanupErr.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Photo replaced successfully',
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
 * @route   DELETE /api/profiles/me/photos/:photoId
 * @desc    Delete a photo from user profile
 * @access  Private (Authenticated User)
 */
const deleteMyPhoto = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { photoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(photoId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid photo ID format',
      });
    }

    const profile = await MatrimonialProfile.findOne({ user: userId });
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
        message: 'Target photo not found on your profile',
      });
    }

    const publicIdToDelete = targetPhoto.publicId;
    const wasPrimary = targetPhoto.isPrimary;

    profile.photos.pull({ _id: photoId });

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

    await profile.save();

    if (publicIdToDelete && cloudinaryConfig.isCloudinaryConfigured()) {
      try {
        await cloudinaryConfig.cloudinary.uploader.destroy(publicIdToDelete);
      } catch (cleanupErr) {
        console.warn(`[User Photo Cleanup Warning] ${cleanupErr.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Photo deleted successfully',
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
 * @route   PATCH /api/profiles/me/photos/:photoId/primary
 * @desc    Set primary photo for user profile
 * @access  Private (Authenticated User)
 */
const setMyPrimaryPhoto = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { photoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(photoId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid photo ID format',
      });
    }

    const profile = await MatrimonialProfile.findOne({ user: userId });
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
        message: 'Target photo not found on your profile',
      });
    }

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
  getMyPhotos,
  addMyPhoto,
  replaceMyPhoto,
  deleteMyPhoto,
  setMyPrimaryPhoto,
};
