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
  note: z.string().optional()
});

router.post('/', upload.single('file'), uploadDocument);
router.get('/', listDocuments);
router.get('/:id', getDocument);
router.post('/:id/decision', validate(DecisionSchema), submitDecision);

module.exports = router;
