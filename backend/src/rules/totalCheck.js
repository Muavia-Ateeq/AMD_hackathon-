// backend/src/rules/totalCheck.js
// Rule to verify total amount matches line sums and tax. Owned by Ammar

const { toMinor, isCloseMinor } = require('../utils/money');

/**
 * Validates subtotal against line totals and total against subtotal + tax.
 * @param {object} extracted
 * @returns {Array<object>} issues
 */
function checkTotals(extracted) {
  const issues = [];
  if (!extracted) return issues;

  const lines = Array.isArray(extracted.lines) ? extracted.lines : [];
  
  if (lines.length > 0) {
    const computedLineSum = lines.reduce((sum, line) => sum + toMinor(line.lineTotal), 0);
    if (typeof extracted.subtotal === 'number' && !isCloseMinor(computedLineSum, toMinor(extracted.subtotal))) {
      issues.push({
        type: 'TOTAL_MISMATCH',
        severity: 'high',
        field: 'subtotal',
        message: `Subtotal (${extracted.subtotal}) does not match sum of line items (${computedLineSum})`
      });
    }
  }

  if (typeof extracted.subtotal === 'number' && typeof extracted.tax === 'number' && typeof extracted.total === 'number') {
    const expectedTotal = toMinor(extracted.subtotal + extracted.tax);
    if (!isCloseMinor(expectedTotal, toMinor(extracted.total))) {
      issues.push({
        type: 'TOTAL_MISMATCH',
        severity: 'high',
        field: 'total',
        message: `Total (${extracted.total}) does not match subtotal + tax (${expectedTotal})`
      });
    }
  }

  return issues;
}

module.exports = {
  checkTotals
};
