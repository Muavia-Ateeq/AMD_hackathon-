// backend/src/services/metricsService.js
// Handles collection and reporting of metrics. Owned by Ammar

const mongoose = require('mongoose');
const Document = require('../models/Document');

const ALL_STATUSES = ['processing', 'auto_approved', 'needs_review', 'rejected', 'approved_by_human'];

/**
 * Evaluation figures (fieldAccuracy, errorCatchRate, falseAlarmRate) can only
 * be computed by comparing pipeline output against ground truth, which lives in
 * data/ground_truth.json and is produced by scripts/compute_eval.js.
 *
 * These were previously hard-coded literals presented as measurements, and the
 * no-database fallback reported countsByStatus of 28 auto-approved documents
 * against an empty database. They are now null until genuinely measured.
 */
function loadEvalSummary() {
  try {
    const fs = require('fs');
    const path = require('path');
    const evalPath = path.resolve(__dirname, '..', '..', 'metrics', 'eval_results.json');
    if (!fs.existsSync(evalPath)) return null;
    const parsed = JSON.parse(fs.readFileSync(evalPath, 'utf8'));
    return typeof parsed === 'object' ? parsed : null;
  } catch (err) {
    return null;
  }
}

function emptyMetrics() {
  return {
    countsByStatus: Object.fromEntries(ALL_STATUSES.map(s => [s, 0])),
    averageTotalMs: null,
    averageModelMs: null,
    totalDocuments: 0,
    fieldAccuracy: null,
    errorCatchRate: null,
    falseAlarmRate: null,
    minutesSavedPerDoc: null,
    gpu: {
      name: process.env.GPU_NAME || null,
      model: process.env.MODEL_NAME || process.env.VLLM_MODEL || null,
      tokensPerSecond: null,
      requestsPerMinute: null
    },
    costPerDocument: null,
    // Tells the UI to render "not measured yet" rather than showing zeros.
    evaluationStatus: 'not_run'
  };
}

/**
 * Computes current aggregate metrics across all processed documents.
 *
 * countsByStatus and the timing averages are measured from the database.
 * Accuracy and cost figures require an evaluation run and are merged in only
 * when one exists.
 * @returns {Promise<object>}
 */
async function getSystemMetrics() {
  const metrics = emptyMetrics();

  if (mongoose.connection.readyState !== 1) {
    metrics.evaluationStatus = 'database_unavailable';
    return metrics;
  }

  try {
    // Aggregate in the database rather than loading every document into
    // memory, which previously grew without bound.
    const [grouped, timing] = await Promise.all([
      Document.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Document.aggregate([
        {
          $match: { 'timing.totalMs': { $type: 'number' } }
        },
        {
          $group: {
            _id: null,
            avgTotalMs: { $avg: '$timing.totalMs' },
            avgModelMs: { $avg: '$timing.modelMs' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    grouped.forEach(g => {
      if (ALL_STATUSES.includes(g._id)) {
        // Previously the accumulator omitted approved_by_human, so manually
        // approved documents were silently dropped from live metrics while
        // still appearing in the fallback payload.
        metrics.countsByStatus[g._id] = g.count;
        metrics.totalDocuments += g.count;
      }
    });

    if (timing.length > 0) {
      metrics.averageTotalMs = Math.round(timing[0].avgTotalMs);
      metrics.averageModelMs = Math.round(timing[0].avgModelMs || 0);
    }

    const evalSummary = loadEvalSummary();
    if (evalSummary) {
      metrics.fieldAccuracy = evalSummary.fieldAccuracy ?? null;
      metrics.errorCatchRate = evalSummary.errorCatchRate ?? null;
      metrics.falseAlarmRate = evalSummary.falseAlarmRate ?? null;
      metrics.evaluationStatus = 'measured';
      if (typeof evalSummary.costPerDocument === 'number') {
        metrics.costPerDocument = evalSummary.costPerDocument;
      }
    }

    return metrics;
  } catch (err) {
    metrics.evaluationStatus = 'error';
    return metrics;
  }
}

module.exports = {
  getSystemMetrics,
  emptyMetrics,
  ALL_STATUSES
};