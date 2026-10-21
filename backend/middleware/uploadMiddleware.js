const multer = require('multer');

// Approved MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Validates actual binary magic bytes of uploaded image buffer
 * Supports JPEG, PNG, and WebP
 */
const validateImageMagicBytes = (buffer) => {
  if (!buffer || buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  const riff = buffer.toString('ascii', 0, 4);
  const webp = buffer.toString('ascii', 8, 12);
  if (riff === 'RIFF' && webp === 'WEBP') {
    return 'image/webp';
  }

  return false;
};

// Memory storage to ensure images are NOT saved to local disk / VPS
const storage = multer.memoryStorage();

const maxFileSizeMB = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5;
const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024;

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported file type '${file.mimetype}'. Only JPEG, PNG, and WebP formats are allowed.`
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: maxFileSizeBytes,
    files: 1,
  },
  fileFilter,
});

/**
 * Express middleware wrapper handling multer file parsing and error handling
 */
const uploadPhotoMiddleware = (req, res, next) => {
  const uploadSingle = upload.single('photo');

  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: `File size exceeds the maximum limit of ${maxFileSizeMB} MB`,
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    // Check if file is provided
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No photo file provided. Please provide an image file with field name 'photo'",
      });
    }

    // Validate binary magic bytes
    const detectedType = validateImageMagicBytes(req.file.buffer);
    if (!detectedType) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid file content. The file does not appear to be a valid JPEG, PNG, or WebP image.',
      });
    }

    next();
  });
};

/**
 * Validates Excel magic bytes (.xlsx PK zip header or .xls OLE header)
 */
const validateExcelMagicBytes = (buffer) => {
  if (!buffer || buffer.length < 4) return false;
  // .xlsx is a zip archive: 50 4B 03 04
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return 'xlsx';
  }
  // .xls legacy compound document: D0 CF 11 E0
  if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
    return 'xls';
  }
  return false;
};

const maxExcelSizeBytes = 25 * 1024 * 1024; // 25 MB

const excelUpload = multer({
  storage,
  limits: {
    fileSize: maxExcelSizeBytes,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const originalLower = file.originalname.toLowerCase();
    if (originalLower.endsWith('.xlsx') || originalLower.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file extension. Only Excel files ('.xlsx' or '.xls') are supported."), false);
    }
  },
});

/**
 * Express middleware wrapper handling Excel file uploads for bulk candidate import
 */
const uploadExcelMiddleware = (req, res, next) => {
  const uploadSingle = excelUpload.single('file');

  uploadSingle(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'Excel file exceeds the maximum allowed size of 25 MB',
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        success: false,
        message: "No Excel file uploaded. Please upload a file with field name 'file'",
      });
    }

    const detectedType = validateExcelMagicBytes(req.file.buffer);
    if (!detectedType) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file content. The file does not appear to be a valid .xlsx or .xls spreadsheet.',
      });
    }

    next();
  });
};

module.exports = {
  uploadPhotoMiddleware,
  uploadExcelMiddleware,
  validateImageMagicBytes,
  validateExcelMagicBytes,
};
