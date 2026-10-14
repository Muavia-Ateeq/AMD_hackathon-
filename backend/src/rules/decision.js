// backend/src/rules/decision.js
// Determines final document status based on issues, thresholds, and risk limits. Owned by Ammar

/**
 * Determines document status based on decision rules.
 * @param {object} params
 * @param {Array<object>} params.issues
 * @param {object} params.confidence
 * @param {number|null} params.total
 * @param {boolean} params.supplierKnown
 * @param {number} params.confidenceMin
 * @param {number} params.amountRiskLimit
 * @returns {{ status: 'auto_approved' | 'needs_review' | 'rejected', explanation: string }}
 */
function determineStatus({
  issues = [],
  confidence = {},
  total = null,
  supplierKnown = false,
  confidenceMin = 0.90,
  amountRiskLimit = 5000
}) {
  const reasons = [];

  // 1. REJECTED (Hold for human confirmation)
  // Triggered by DUPLICATE_INVOICE, BANK_DETAILS_CHANGED, or any high-severity issue
  const hasDuplicate = issues.some(i => i.type === 'DUPLICATE_INVOICE');
  const hasBankChanged = issues.some(i => i.type === 'BANK_DETAILS_CHANGED');
  const hasHighSeverity = issues.some(i => i.severity === 'high');

  if (hasDuplicate || hasBankChanged || hasHighSeverity) {
    if (hasDuplicate) reasons.push('Duplicate invoice detected');
    if (hasBankChanged) reasons.push('Supplier bank account details changed');
    const otherHigh = issues.filter(i => i.severity === 'high' && i.type !== 'DUPLICATE_INVOICE' && i.type !== 'BANK_DETAILS_CHANGED');
    otherHigh.forEach(i => reasons.push(i.message));

    return {
      status: 'rejected',
      explanation: reasons.join('. ') + '.'
    };
  }

  // 2. NEEDS REVIEW
  // Triggered by: any medium issue, any confidence below CONFIDENCE_MIN, new supplier, or amount above limit
  const hasMediumSeverity = issues.some(i => i.severity === 'medium');
  const lowConfidenceFields = Object.entries(confidence || {}).filter(
    ([_, score]) => typeof score === 'number' && score < confidenceMin
  );
  const isAmountOverRiskLimit = typeof total === 'number' && total >= amountRiskLimit;

  if (hasMediumSeverity || lowConfidenceFields.length > 0 || !supplierKnown || isAmountOverRiskLimit) {
    if (!supplierKnown) reasons.push('Supplier is not recognized in approved supplier registry');
    if (isAmountOverRiskLimit) reasons.push(`Document total (${total}) exceeds auto-approval threshold (${amountRiskLimit})`);
    if (lowConfidenceFields.length > 0) {
      reasons.push(`Low confidence on fields: ${lowConfidenceFields.map(([f]) => f).join(', ')}`);
    }
    const mediumIssues = issues.filter(i => i.severity === 'medium');
    mediumIssues.forEach(i => reasons.push(i.message));

    // Also include any low severity notes if present
    const lowIssues = issues.filter(i => i.severity === 'low');
    lowIssues.forEach(i => reasons.push(i.message));

    return {
      status: 'needs_review',
      explanation: reasons.join('. ') + '.'
    };
  }

  // 3. AUTO APPROVED
  // Only if: no issues, every field confidence >= confidenceMin, supplier known, total below amountRiskLimit
  return {
    status: 'auto_approved',
    explanation: 'All validation checks passed. Document auto-approved within policy limits.'
  };
}

module.exports = {
  determineStatus
};
