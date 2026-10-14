// backend/src/middleware/upload.js
// Multer configuration for handling file uploads. Owned by Ammar

const multer = require('multer');

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// Multer keeps the file in memory; nothing is written to disk by this layer.
// PDF magic bytes, so a renamed executable cannot masquerade as a PDF by
// simply declaring the right MIME type.
const PDF_MAGIC = '%PDF-';

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 10
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      const err = new Error('Only PDF files are allowed');
      err.statusCode = 400;
      err.code = 'INVALID_FILE_TYPE';
      return cb(err, false);
    }
    cb(null, true);
  }
});

/**
 * Express error middleware that converts multer's own errors into the standard
 * `{ error: { code, message } }` envelope. Must be registered after the upload
 * middleware on the route.
 */
function handleUploadError(err, req, res, next) {
  if (!err) return next();

  if (err instanceof multer.MulterError) {
    const map = {
      LIMIT_FILE_SIZE: [413, 'File exceeds the 20 MB limit'],
      LIMIT_FILE_COUNT: [400, 'Too many files'],
      LIMIT_UNEXPECTED_FILE: [400, 'Unexpected file field'],
      LIMIT_PART_COUNT: [400, 'Too many multipart fields']
    };
    const [status, message] = map[err.code] || [400, 'Invalid upload'];
    return res.status(status).json({
      error: { code: err.code, message }
    });
  }

  next(err);
}

/**
 * Verifies the uploaded buffer really is a PDF by checking the leading magic
 * bytes. The client-supplied MIME type alone is not trustworthy.
 */
function assertPdfMagic(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < PDF_MAGIC.length) return false;
  return buffer.subarray(0, PDF_MAGIC.length).toString('latin1') === PDF_MAGIC;
}

module.exports = upload;
module.exports.MAX_FILE_SIZE = MAX_FILE_SIZE;
module.exports.handleUploadError = handleUploadError;
module.exports.assertPdfMagic = assertPdfMagic;