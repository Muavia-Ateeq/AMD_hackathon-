// backend/src/controllers/documentsController.js
// Controller for document endpoints. Owned by Ammar

const crypto = require('crypto');
const Document = require('../models/Document');
const { start } = require('../services/pipelineService');
const logger = require('../utils/logger');

const VALID_LANGUAGES = ['en', 'fr', 'de', 'es', 'zh', 'ar', 'it', 'pt', 'nl'];
const VALID_TYPES = ['invoice', 'delivery_note'];

/**
 * The shape returned by the list endpoint and by the decision endpoint.
 */
function toSummary(doc) {
  return {
    id: doc.id,
    fileName: doc.fileName,
    uploadedAt: doc.uploadedAt,
    supplierName: doc.supplierName,
    language: doc.language,
    type: doc.type,
    status: doc.status
  };
}

/**
 * Masks a bank account for API responses.
 *
 * bankCheck emits issue messages containing both the invoice account and the
 * master-record account in cleartext. Those messages are stored, returned by
 * the API, forwarded to the LLM and quoted in the supplier reply. The account
 * is retained internally for the fraud check but never served to a client.
 */
function maskBankAccount(value) {
  if (!value || typeof value !== 'string') return value ?? null;
  const compact = value.replace(/\s+/g, '');
  if (compact.length <= 4) return '****';
  return `****${compact.slice(-4)}`;
}

/**
 * Projects a stored document into the public detail shape, dropping internal
 * fields and masking the bank account.
 */
function toDetail(doc) {
  const {
    rawEvolusPayload, // full upstream Evolus response, may contain PII
    finalizing,       // internal concurrency guard
    redactionError,   // internal diagnostic
    _id,
    __v,
    ...rest
  } = doc;

  const extracted = rest.extracted;
  return {
    ...rest,
    extracted: extracted ? { ...extracted, bankAccount: maskBankAccount(extracted.bankAccount) } : null,
    bankAccountMasked: Boolean(extracted && extracted.bankAccount)
  };
}

/**
 * Encodes an opaque pagination cursor from a sort key and id.
 */
function encodeCursor(doc) {
  if (!doc) return null;
  return Buffer.from(`${new Date(doc.createdAt).toISOString()}|${doc.id}`, 'utf8').toString('base64');
}

/**
 * Decodes a cursor produced by encodeCursor.
 * @returns {{createdAt: string, id: string}|null}
 */
function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') return null;
  try {
    const [createdAt, id] = Buffer.from(cursor, 'base64').toString('utf8').split('|');
    if (!createdAt || !id || Number.isNaN(Date.parse(createdAt))) return null;
    return { createdAt, id };
  } catch (err) {
    return null;
  }
}

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

    // These arrived unvalidated and reached Mongoose's enum check, where an
    // unexpected value surfaced as a 500 rather than a 400.
    const language = req.body.language || 'en';
    const type = req.body.type || 'invoice';

    if (!VALID_LANGUAGES.includes(language)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Unsupported language "${language}". Expected one of: ${VALID_LANGUAGES.join(', ')}`
        }
      });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Unsupported type "${type}". Expected one of: ${VALID_TYPES.join(', ')}`
        }
      });
    }

    const id = `doc-${crypto.randomBytes(6).toString('hex')}`;
    const uploadedAt = new Date().toISOString();
    const fileName = req.file.originalname || 'uploaded-document.pdf';

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
      ruleExplanation: null,
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
 * List documents, newest first, with status filtering and cursor pagination.
 */
async function listDocuments(req, res, next) {
  try {
    const { status, limit = 20, cursor } = req.query;
    const query = {};

    if (status) {
      if (!['processing', 'auto_approved', 'needs_review', 'rejected', 'approved_by_human'].includes(status)) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `Unknown status filter "${status}"` }
        });
      }
      query.status = status;
    }

    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    const decoded = decodeCursor(cursor);
    if (cursor && !decoded) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Malformed cursor' }
      });
    }

    // Keyset pagination on (createdAt desc, id desc). An offset-based skip was
    // never applied, so `cursor` was destructured and then ignored and
    // nextCursor was always null: page two was unreachable.
    if (decoded) {
      query.$or = [
        { createdAt: { $lt: new Date(decoded.createdAt) } },
        { createdAt: new Date(decoded.createdAt), id: { $lt: decoded.id } }
      ];
    }

    // Fetch one extra row to determine whether another page exists.
    const documents = await Document.find(query)
      .sort({ createdAt: -1, id: -1 })
      .limit(parsedLimit + 1)
      .lean();

    const hasMore = documents.length > parsedLimit;
    const page = hasMore ? documents.slice(0, parsedLimit) : documents;

    return res.json({
      documents: page.map(toSummary),
      nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null
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

    return res.json(toDetail(doc));
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

    const doc = await Document.findOne({ id: req.params.id });
    if (!doc) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
    }

    // A human decision on a document whose pipeline is still running would be
    // overwritten when finalization completes.
    if (doc.status === 'processing') {
      return res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'Document is still being processed; poll until it reaches a final status'
        }
      });
    }

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

    doc.status = newStatus;
    // The deterministic ruleExplanation is deliberately left intact: the
    // machine-derived justification must survive a human override.
    doc.explanation = note
      ? `Manual override (${action}): ${note}`
      : `Manual override (${action})`;
    doc.finalizing = false;
    doc.auditLog.push({ action, note: note || null, timestamp: new Date() });
    await doc.save();

    return res.json({
      ...toSummary(doc),
      note: note || null,
      auditLog: doc.auditLog
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadDocument,
  listDocuments,
  getDocument,
  submitDecision,
  toSummary,
  toDetail,
  maskBankAccount,
  encodeCursor,
  decodeCursor
};