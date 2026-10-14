// backend/src/rules/confidenceCheck.js
// Rule to verify extraction confidence scores. Owned by Ammar

/**
 * Checks all extracted field confidences against the minimum confidence threshold.
 * @param {object} confidence
 * @param {number} minConfidence
 * @returns {Array<object>} issues
 */
function checkConfidence(confidence = {}, minConfidence = 0.90) {
  const issues = [];
  if (!confidence || typeof confidence !== 'object') return issues;

  for (const [field, score] of Object.entries(confidence)) {
    if (typeof score === 'number' && score < minConfidence) {
      issues.push({
        type: 'LOW_CONFIDENCE',
        severity: 'low',
        field,
        message: `Extraction confidence for "${field}" (${score}) is below minimum threshold (${minConfidence})`
      });
    }
  }

  return issues;
}

module.exports = {
  checkConfidence
};
