// backend/src/routes/documents.js
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { evaluateDocument } = require('../services/ruleEngine');
const { extractDocument } = require('../services/evolusClient');
const { DocumentSchema } = require('../validation/documentSchema');
const pino = require('pino');
const logger = pino();

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// In‑memory store for demo purposes
const documents = {};

// Helper to format error responses
function sendError(res, code, message) {
  res.status(400).json({ error: { code, message } });
}

/**
 * POST /api/documents – upload PDF (mock mode returns placeholder)
 */
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return sendError(res, 'VALIDATION_ERROR', 'File is required');
  const { language, type } = req.body;
  const id = uuidv4();
  const uploadedAt = new Date().toISOString();
  const fileName = req.file.originalname || 'unknown.pdf';
  const supplierName = 'Mock Supplier'; // placeholder, real logic would infer

  // Call Evolus (mock) to get extraction data
  let extracted;
  try {
    extracted = await extractDocument(req.file.buffer, fileName);
  } catch (e) {
    logger.error(e, 'Evolus extraction failed');
    return sendError(res, 'INTERNAL_ERROR', 'Extraction failed');
  }

  // Evaluate using deterministic rule engine
  const { issues, status, explanation } = evaluateDocument({ ...extracted, confidence: extracted.confidence });

  const doc = {
    id,
    fileName,
    uploadedAt,
    supplierName,
    language: language || extracted.language || 'en',
    type: type || extracted.type || 'invoice',
    status,
    extracted,
    confidence: extracted.confidence || {},
    issues,
    explanation,
    supplierReplyDraft: extracted.supplierReplyDraft || null,
    redactedFileUrl: extracted.redactedFileUrl || null,
    timing: { totalMs: null, modelMs: null }, // placeholders
    costEstimate: null
  };
  documents[id] = doc;
  res.status(202).json({ id, status: doc.status });
});

/**
 * GET /api/documents – list documents (newest first)
 */
router.get('/', (req, res) => {
  const { status, limit = 20, cursor } = req.query;
  let list = Object.values(documents).sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  if (status) list = list.filter(d => d.status === status);
  // pagination stub – ignore cursor for now
  const limited = list.slice(0, Number(limit));
  const summary = limited.map(d => ({
    id: d.id,
    fileName: d.fileName,
    uploadedAt: d.uploadedAt,
    supplierName: d.supplierName,
    language: d.language,
    type: d.type,
    status: d.status
  }));
  res.json({ documents: summary, nextCursor: null });
});

/**
 * GET /api/documents/:id – full document
 */
router.get('/:id', (req, res) => {
  const doc = documents[req.params.id];
  if (!doc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
  res.json(doc);
});

/**
 * POST /api/documents/:id/decision – manual decision
 */
router.post('/:id/decision', express.json(), (req, res) => {
  const { action, note } = req.body;
  const validActions = ['approve', 'reject', 'ask_supplier'];
  if (!validActions.includes(action)) return sendError(res, 'VALIDATION_ERROR', 'Invalid action');
  const doc = documents[req.params.id];
  if (!doc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
  // Update status based on action
  const statusMap = { approve: 'auto_approved', reject: 'rejected', ask_supplier: 'needs_review' };
  doc.status = statusMap[action];
  res.json({ id: doc.id, status: doc.status, note: note || null });
});

module.exports = router;
