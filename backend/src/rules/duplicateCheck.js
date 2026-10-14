// backend/src/rules/duplicateCheck.js
// Rule to detect duplicate invoices. Owned by Ammar

/**
 * Checks if the invoice has already been processed in the system.
 * @param {object} extracted
 * @param {boolean} isDuplicate
 * @returns {Array<object>} issues
 */
function checkDuplicate(extracted, isDuplicate = false) {
  const issues = [];
  if (!extracted || !extracted.invoiceNumber) return issues;

  if (isDuplicate) {
    issues.push({
      type: 'DUPLICATE_INVOICE',
      severity: 'high',
      field: 'invoiceNumber',
      message: `Invoice number "${extracted.invoiceNumber}" has already been processed in the system`
    });
  }

  return issues;
}

module.exports = {
  checkDuplicate
};
