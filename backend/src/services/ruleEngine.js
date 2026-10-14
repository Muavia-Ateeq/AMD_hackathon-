// backend/src/services/ruleEngine.js
require('dotenv').config();
const { CONFIDENCE_MIN = 0.90, AMOUNT_RISK_LIMIT = 5000 } = process.env;

/**
 * Helper to create an issue object.
 */
function makeIssue(type, severity, field, message) {
  return { type, severity, field, message };
}

/**
 * Evaluate a document's extracted fields against business rules.
 * Returns an object with { issues, status, explanation }.
 *
 * `extracted` follows the data contract shape.
 * `poLookup` is a function that receives a poNumber and returns the PO total (or null).
 */
function evaluateDocument(extracted, poLookup = () => null) {
  const issues = [];
  const explanationParts = [];

  // Helper to push explanation and optionally severity summary
  const addExplanation = (msg) => explanationParts.push(msg);

  // ---- Confidence checks ----
  if (extracted && extracted.confidence) {
    for (const [field, conf] of Object.entries(extracted.confidence)) {
      if (conf < CONFIDENCE_MIN) {
        issues.push(makeIssue('LOW_CONFIDENCE', 'low', field, `Low confidence on ${field} (${conf})`));
        addExplanation(`Low confidence on ${field}`);
      }
    }
  }

  // ---- Numeric calculations ----
  if (extracted) {
    const lineSum = (extracted.lines || []).reduce((sum, l) => sum + (l.lineTotal || 0), 0);
    if (Math.abs(lineSum - extracted.subtotal) > 0.01) {
      issues.push(makeIssue('TOTAL_MISMATCH', 'high', 'subtotal', `Subtotal (${extracted.subtotal}) does not equal sum of line totals (${lineSum})`));
      addExplanation('Subtotal mismatch');
    }
    const expectedTotal = (extracted.subtotal || 0) + (extracted.tax || 0);
    if (Math.abs(expectedTotal - extracted.total) > 0.01) {
      issues.push(makeIssue('TOTAL_MISMATCH', 'high', 'total', `Total (${extracted.total}) does not match subtotal+tax (${expectedTotal})`));
      addExplanation('Total mismatch');
    }
    // Price / qty mismatches – placeholder: compare to PO if available
    const poTotal = poLookup(extracted.poNumber);
    if (poTotal !== null && Math.abs(extracted.total - poTotal) > 0.01) {
      issues.push(makeIssue('TOTAL_MISMATCH', 'high', 'total', `Total (${extracted.total}) does not match PO amount (${poTotal})`));
      addExplanation('PO total mismatch');
    }
    // Duplicate invoice detection – placeholder stub (could be DB check)
    // For mock purposes we assume no duplicate here.
  }

  // ---- Decision status based on issues and thresholds ----
  let status = 'auto_approved';
  if (issues.some(i => i.severity === 'high')) {
    status = 'rejected';
  } else if (issues.length > 0 || (extracted && extracted.total > AMOUNT_RISK_LIMIT)) {
    status = 'needs_review';
  }

  const explanation = explanationParts.length ? explanationParts.join('; ') : 'All checks passed.';

  return { issues, status, explanation };
}

module.exports = { evaluateDocument, makeIssue };
