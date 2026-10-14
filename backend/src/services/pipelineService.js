// backend/src/services/pipelineService.js
// Orchestrates document processing pipeline with webhook and polling fallback. Owned by Ammar

const fs = require('fs');
const path = require('path');
const os = require('os');
const Document = require('../models/Document');
const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');
const { runAllRules } = require('../rules');
const { executeWorkflow, getExecution, runAiTool } = require('./evolusClient');
const pino = require('pino');
const logger = pino();
const { generate } = require('../clients/llmClient');

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:3000';

/**
 * Starts processing for a newly uploaded document.
 * @param {object} document - Document mongoose record or plain object
 * @param {Buffer} fileBuffer
 * @param {string} fileName
 * @param {object} options
 */
async function start(document, fileBuffer, fileName, options = {}) {
  const startTime = Date.now();
  const documentId = document.id;

  // Write temporary file for multipart streaming if not on disk
  let tempFilePath = null;
  try {
    tempFilePath = path.join(os.tmpdir(), `upload-${documentId}-${fileName}`);
    fs.writeFileSync(tempFilePath, fileBuffer);

    const callbackUrl = `${PUBLIC_BASE_URL}/api/webhooks/evolus?docId=${encodeURIComponent(documentId)}`;

    logger.info({ documentId, callbackUrl }, 'Starting Evolus workflow execution');
    const execResponse = await executeWorkflow({
      filePath: tempFilePath,
      language: options.language || 'en',
      callbackUrl
    });

    const executionId = execResponse.executionId;

    await Document.findOneAndUpdate(
      { id: documentId },
      { executionId, status: 'processing' }
    );

    // Fallback: poll execution in background in case webhook is blocked or in local dev
    pollExecutionFallback(documentId, executionId, startTime, fileBuffer, fileName, options).catch(err => {
      logger.error({ documentId, err: err.message }, 'Polling fallback encountered an error');
    });

    return { executionId, status: 'processing' };
  } catch (error) {
    logger.error({ documentId, err: error.message }, 'Workflow execution initiation failed');

    // Never crash: set status to needs_review with a LOW_CONFIDENCE issue
    await Document.findOneAndUpdate(
      { id: documentId },
      {
        status: 'needs_review',
        issues: [
          {
            type: 'LOW_CONFIDENCE',
            severity: 'low',
            field: 'workflow',
            message: `Workflow could not be started: ${error.message}`
          }
        ],
        explanation: `Processing error: ${error.message}`,
        timing: { totalMs: Date.now() - startTime, modelMs: 0 }
      }
    );

    return { error: error.message };
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (_) {}
    }
  }
}

/**
 * Polls getExecution every 2 seconds for up to 3 minutes (90 iterations)
 */
async function pollExecutionFallback(documentId, executionId, startTime, fileBuffer, fileName, options = {}) {
  const maxAttempts = 90; // 90 * 2000ms = 3 minutes
  const pollInterval = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, pollInterval));

    // If webhook already finalized the document, exit polling
    const currentDoc = await Document.findOne({ id: documentId }).lean();
    if (!currentDoc || currentDoc.status !== 'processing') {
      logger.info({ documentId }, 'Document already finalized. Exiting poll loop.');
      return;
    }

    try {
      const execution = await getExecution(executionId);
      const status = (execution.status || '').toUpperCase();

      if (status === 'COMPLETED' || status === 'SUCCESS') {
        logger.info({ documentId, attempt }, 'Poll detected workflow completion');

        const { normalizeEvolusResult } = require('../routes/webhooks.routes');
        const normalized = normalizeEvolusResult(execution);

        await finalizeFromEvolus(documentId, normalized, fileBuffer, fileName);
        return;
      } else if (status === 'FAILED' || status === 'ERROR') {
        throw new Error(execution.error?.message || 'Evolus execution failed');
      }
    } catch (pollErr) {
      if (attempt === maxAttempts) {
        throw pollErr;
      }
    }
  }

  // Timeout reached after 3 minutes
  await Document.findOneAndUpdate(
    { id: documentId, status: 'processing' },
    {
      status: 'needs_review',
      issues: [
        {
          type: 'LOW_CONFIDENCE',
          severity: 'low',
          field: 'execution',
          message: 'Workflow processing timed out after 3 minutes'
        }
      ],
      explanation: 'Workflow timed out waiting for extraction result.',
      timing: { totalMs: Date.now() - startTime, modelMs: 0 }
    }
  );
}

/**
 * Finalizes document processing using normalized extraction results and rules engine.
 * @param {string} documentId
 * @param {object} normalized
 * @param {Buffer} [fileBuffer]
 * @param {string} [fileName]
 */
async function finalizeFromEvolus(documentId, normalized, fileBuffer = null, fileName = null) {
  const doc = await Document.findOne({ id: documentId });
  if (!doc) return;

  const extracted = normalized.extracted || {};
  const confidence = normalized.confidence || {};
  const supplierName = normalized.supplierName || doc.supplierName || 'Unknown';
  const language = normalized.language || doc.language || 'en';

  // 1. Context queries from Database
  const [supplier, purchaseOrder, duplicateDoc] = await Promise.all([
    Supplier.findOne({ name: new RegExp(`^${supplierName}$`, 'i') }).lean(),
    extracted.poNumber ? PurchaseOrder.findOne({ poNumber: extracted.poNumber }).lean() : null,
    extracted.invoiceNumber ? Document.findOne({
      id: { $ne: documentId },
      'extracted.invoiceNumber': extracted.invoiceNumber
    }).lean() : null
  ]);

  // 2. Rules engine evaluation (CODE does all math and policy decisions)
  const confidenceMin = parseFloat(process.env.CONFIDENCE_MIN || '0.90');
  const amountRiskLimit = parseFloat(process.env.AMOUNT_RISK_LIMIT || '5000');

  const ruleResult = runAllRules({
    extracted,
    confidence,
    supplierName,
    supplier,
    purchaseOrder,
    isDuplicate: Boolean(duplicateDoc),
    confidenceMin,
    amountRiskLimit
  });

  // 3. AI Tool: PII Redaction
  let redactedFileUrl = null;
  try {
    const redactionRes = await runAiTool('pii-redaction', {
      documentId,
      supplierName,
      bankAccount: extracted.bankAccount
    });
    redactedFileUrl = redactionRes.redactedFileUrl || null;
  } catch (err) {
    logger.warn({ err: err.message }, 'PII Redaction tool execution skipped');
  }

// 4. Generate explanation and supplier reply via LLM
let supplierReplyDraft = null;
let llmResult = { explanation: '', reply: '' };
if (ruleResult.issues.length > 0) {
  llmResult = await generate({
    language,
    supplierName,
    issues: ruleResult.issues,
    extracted
  });
  supplierReplyDraft = llmResult.reply;
  // Overwrite explanation with LLM generated one
  ruleResult.explanation = llmResult.explanation;
}

  // 5. Update document record
  doc.status = ruleResult.status;
  doc.supplierName = supplierName;
  doc.language = language;
  doc.extracted = extracted;
  doc.confidence = confidence;
  doc.issues = ruleResult.issues;
  doc.explanation = ruleResult.explanation;
  doc.supplierReplyDraft = supplierReplyDraft;
  doc.redactedFileUrl = redactedFileUrl;
  doc.timing = {
    totalMs: normalized.timing?.totalMs || 1200,
    modelMs: normalized.timing?.modelMs || 400
  };
  doc.costEstimate = 0.012;

  await doc.save();
  logger.info({ documentId, status: doc.status }, 'Document pipeline finalized successfully');
}

module.exports = {
  start,
  finalizeFromEvolus
};
