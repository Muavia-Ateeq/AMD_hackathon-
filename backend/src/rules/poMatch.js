// backend/src/rules/poMatch.js
// Rule to match PO number between document and system. Owned by Ammar

const { toMinor, isCloseMinor } = require('../utils/money');

/**
 * Validates purchase order presence and compares total amount.
 * @param {object} extracted
 * @param {object|null} purchaseOrder
 * @returns {Array<object>} issues
 */
function checkPurchaseOrder(extracted, purchaseOrder = null) {
  const issues = [];
  if (!extracted) return issues;

  if (!extracted.poNumber) {
    issues.push({
      type: 'MISSING_PO',
      severity: 'medium',
      field: 'poNumber',
      message: 'Purchase order number is missing from the document'
    });
    return issues;
  }

  if (!purchaseOrder) {
    issues.push({
      type: 'MISSING_PO',
      severity: 'medium',
      field: 'poNumber',
      message: `Purchase order "${extracted.poNumber}" not found in system`
    });
    return issues;
  }

  // Cross-check document total against PO total
  if (typeof extracted.total === 'number' && typeof purchaseOrder.total === 'number') {
    if (!isCloseMinor(toMinor(extracted.total), toMinor(purchaseOrder.total))) {
      issues.push({
        type: 'TOTAL_MISMATCH',
        severity: 'high',
        field: 'total',
        message: `Invoice total (${extracted.total}) does not match purchase order total (${purchaseOrder.total})`
      });
    }
  }

  return issues;
}

module.exports = {
  checkPurchaseOrder
};
