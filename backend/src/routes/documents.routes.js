// backend/src/routes/documents.routes.js
// Routes for document endpoints. Owned by Ammar

const express = require('express');
const { z } = require('zod');
const upload = require('../middleware/upload');
const validate = require('../middleware/validate');
const requireDb = require('../middleware/requireDb');
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

// Request-shape validation runs before the database check, so a malformed
// upload is reported as a 400 regardless of whether MongoDB is reachable.
// requireDb then turns an unreachable database into an immediate 503 instead
// of a 10-second hang followed by a 500.
router.post('/', upload.single('file'), upload.handleUploadError, requireDb, uploadDocument);
router.get('/', requireDb, listDocuments);
router.get('/:id', requireDb, getDocument);
router.post('/:id/decision', validate(DecisionSchema), requireDb, submitDecision);

module.exports = router;
module.exports.UploadFieldsSchema = UploadFieldsSchema;
