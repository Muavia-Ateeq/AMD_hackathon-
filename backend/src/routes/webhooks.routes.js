// backend/src/routes/webhooks.routes.js
// Routes for external webhooks. Owned by Ammar

const express = require('express');
const crypto = require('crypto');
const Document = require('../models/Document');
const { finalizeFromEvolus } = require('../services/pipelineService');
const pino = require('pino');
const logger = pino();

const router = express.Router();

/**
 * Tolerant normalization function to map unknown Evolus webhook payload shapes into our Data Contract.
 * @param {object} payload
 * @returns {object} normalized object conforming to Document schema
 */
function normalizeEvolusResult(payload = {}) {
  // Check common wrapper layers
  const source = payload.result?.document || payload.result || payload.data || payload.output || payload;
  const rawExtracted = source.extracted || source;

  // Normalize line items tolerantly
  const rawLines = Array.isArray(rawExtracted.lines) ? rawExtracted.lines : (Array.isArray(source.lines) ? source.lines : []);
  const lines = rawLines.map(line => ({
    description: line.description || line.name || line.item || null,
    qty: typeof line.qty === 'number' ? line.qty : (typeof line.quantity === 'number' ? line.quantity : null),
    unitPrice: typeof line.unitPrice === 'number' ? line.unitPrice : (typeof line.price === 'number' ? line.price : null),
    lineTotal: typeof line.lineTotal === 'number' ? line.lineTotal : (typeof line.total === 'number' ? line.total : null)
  }));

  const extracted = {
    invoiceNumber: rawExtracted.invoiceNumber || rawExtracted.invoice_number || rawExtracted.id || null,
    date: rawExtracted.date || rawExtracted.invoiceDate || null,
    currency: rawExtracted.currency || 'USD',
    poNumber: rawExtracted.poNumber || rawExtracted.po_number || rawExtracted.purchaseOrderNumber || null,
    lines,
    subtotal: typeof rawExtracted.subtotal === 'number' ? rawExtracted.subtotal : null,
    tax: typeof rawExtracted.tax === 'number' ? rawExtracted.tax : null,
    total: typeof rawExtracted.total === 'number' ? rawExtracted.total : (typeof rawExtracted.amount === 'number' ? rawExtracted.amount : null),
    bankAccount: rawExtracted.bankAccount || rawExtracted.iban || rawExtracted.account_number || null
  };

  const confidence = source.confidence || payload.confidence || {};

  return {
    supplierName: source.supplierName || source.supplier || rawExtracted.supplierName || null,
    language: source.language || payload.language || 'en',
    type: source.type || 'invoice',
    extracted,
    confidence,
    timing: {
      modelMs: payload.timing?.modelMs || source.timing?.modelMs || null,
      totalMs: payload.timing?.totalMs || source.timing?.totalMs || null
    }
  };
}

/**
 * Timing-safe string comparison. Returns false for differing lengths without
 * leaking length information through an early exit.
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * POST /api/webhooks/evolus
 * Called by Evolus when a workflow finishes.
 */
router.post('/evolus', express.json({ limit: '2mb' }), async (req, res, next) => {
  try {
    // Fail closed. An unauthenticated webhook lets anyone reachable on the
    // network overwrite a document's extracted fields, issues and status.
    const configuredSecret = process.env.EVOLUS_WEBHOOK_SECRET;
    if (!configuredSecret) {
      logger.error('EVOLUS_WEBHOOK_SECRET is not configured; rejecting webhook');
      return res.status(503).json({
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Webhook endpoint is not configured' }
      });
    }

    // Secret is accepted from the header only. Query-string secrets leak into
    // access logs, proxy logs and browser history.
    const incomingSecret = req.get('x-webhook-secret');
    if (!safeEqual(incomingSecret, configuredSecret)) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Invalid webhook secret' }
      });
    }

    const docId = req.query.docId || req.body.docId || req.body.documentId;
    const executionId = req.body.executionId || req.body.id;

    logger.info({ docId, executionId }, 'Received Evolus workflow webhook');

    // Find document by docId or executionId
    let query = null;
    if (docId) query = { id: docId };
    else if (executionId) query = { executionId };

    if (query) {
      // Save raw payload
      await Document.findOneAndUpdate(query, {
        rawEvolusPayload: req.body
      });
    }

    // Normalize payload
    const normalized = normalizeEvolusResult(req.body);

    // Hand to pipeline finalization
    if (docId) {
      finalizeFromEvolus(docId, normalized).catch(err => {
        logger.error({ docId, err: err.message }, 'Failed finalizing document from webhook');
      });
    }

    return res.status(200).json({ status: 'received' });
  } catch (err) {
    next(err);
  }
});

router.normalizeEvolusResult = normalizeEvolusResult;

module.exports = router;
