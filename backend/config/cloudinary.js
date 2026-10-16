const cloudinary = require('cloudinary').v2;

/**
 * Checks whether all required Cloudinary environment variables are set
 */
const isCloudinaryConfigured = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  return Boolean(
    cloudName &&
    cloudName.trim() &&
    apiKey &&
    apiKey.trim() &&
    apiSecret &&
    apiSecret.trim()
  );
};

/**
 * Configures Cloudinary SDK if credentials exist
 */
const initCloudinary = () => {
  if (isCloudinaryConfigured()) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
      api_key: process.env.CLOUDINARY_API_KEY.trim(),
      api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
      secure: true,
    });
  }
};

initCloudinary();

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
};
