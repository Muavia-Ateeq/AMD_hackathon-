// backend/src/routes/documents.routes.js
// Routes for document endpoints. Owned by Ammar

const express = require('express');
const { z } = require('zod');
const upload = require('../middleware/upload');
const validate = require('../middleware/validate');
const {
  uploadDocument,
  listDocuments,
  getDocument,
  submitDecision
} = require('../controllers/documentsController');

const router = express.Router();

const DecisionSchema = z.object({
  action: z.enum(['approve', 'reject', 'ask_supplier']),
  note: z.string().max(2000).optional()
});

const UploadFieldsSchema = z.object({
  language: z.enum(['en', 'fr', 'de', 'es', 'zh', 'ar', 'it', 'pt', 'nl']).optional(),
  type: z.enum(['invoice', 'delivery_note']).optional()
});

// upload.single('file') then the multer error translator, so a rejected file
// produces a 400/413 in the standard error envelope rather than a 500.
router.post('/', upload.single('file'), upload.handleUploadError, uploadDocument);
router.get('/', listDocuments);
router.get('/:id', getDocument);
router.post('/:id/decision', validate(DecisionSchema), submitDecision);

module.exports = router;
module.exports.UploadFieldsSchema = UploadFieldsSchema;
