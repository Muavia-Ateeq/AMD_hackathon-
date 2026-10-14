// backend/src/controllers/documentsController.js
// Controller for document endpoints. Owned by Ammar

const crypto = require('crypto');
const Document = require('../models/Document');
const { start } = require('../services/pipelineService');
const pino = require('pino');
const logger = pino();

/**
 * POST /api/documents
 * Upload PDF and queue for processing
 */
async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'File is required (field name "file")' }
      });
    }

    const id = `doc-${crypto.randomBytes(6).toString('hex')}`;
    const uploadedAt = new Date().toISOString();
    const fileName = req.file.originalname || 'uploaded-document.pdf';
    const { language = 'en', type = 'invoice' } = req.body;

    // Create initial processing record
    const doc = await Document.create({
      id,
      fileName,
      uploadedAt,
      supplierName: null,
      language,
      type,
      status: 'processing',
      extracted: null,
      confidence: {},
      issues: [],
      explanation: null,
      supplierReplyDraft: null,
      redactedFileUrl: null,
      timing: { totalMs: null, modelMs: null },
      costEstimate: null
    });

    // Run processing asynchronously (via workflow execution and webhook/polling)
    start(doc, req.file.buffer, fileName, { language, type }).catch(err => {
      logger.error({ id, err: err.message }, 'Async document processing error');
    });

    return res.status(202).json({
      id: doc.id,
      status: doc.status
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/documents
 * List documents with optional status and pagination
 */
async function listDocuments(req, res, next) {
  try {
    const { status, limit = 20, cursor } = req.query;
    const query = {};
    if (status) {
      query.status = status;
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const documents = await Document.find(query)
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .lean();

    const summaryList = documents.map(doc => ({
      id: doc.id,
      fileName: doc.fileName,
      uploadedAt: doc.uploadedAt,
      supplierName: doc.supplierName,
      language: doc.language,
      type: doc.type,
      status: doc.status
    }));

    return res.json({
      documents: summaryList,
      nextCursor: null
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/documents/:id
 * Retrieve full document
 */
async function getDocument(req, res, next) {
  try {
    const doc = await Document.findOne({ id: req.params.id }).lean();
    if (!doc) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Document not found' }
      });
    }

    return res.json(doc);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/documents/:id/decision
 * Record manual human decision
 */
async function submitDecision(req, res, next) {
  try {
    const { action, note } = req.body;
    // Load document to decide based on existing issues
    const doc = await Document.findOne({ id: req.params.id });
    if (!doc) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }
    // Determine new status
    let newStatus;
    if (action === 'approve') {
      newStatus = doc.issues && doc.issues.length ? 'approved_by_human' : 'auto_approved';
    } else if (action === 'reject') {
      newStatus = 'rejected';
    } else if (action === 'ask_supplier') {
      newStatus = 'needs_review';
    } else {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid action' } });
    }
    // Update document with new status, optional note as explanation, and audit log entry
    doc.status = newStatus;
    if (note) {
      doc.explanation = `Manual override (${action}): ${note}`;
    } else {
      doc.explanation = `Manual override (${action})`;
    }
    doc.auditLog.push({ action, note: note || null, timestamp: new Date() });
    await doc.save();
    return res.json({
      id: doc.id,
      fileName: doc.fileName,
      uploadedAt: doc.uploadedAt,
      supplierName: doc.supplierName,
      language: doc.language,
      type: doc.type,
      status: doc.status,
      note: note || null
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadDocument,
  listDocuments,
  getDocument,
  submitDecision
};
