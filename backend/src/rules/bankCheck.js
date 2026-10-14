// backend/src/rules/bankCheck.js
// Rule to detect bank account changes. Owned by Ammar

/**
 * Validates extracted bank details against known supplier records.
 * @param {object} extracted
 * @param {object|null} supplier
 * @returns {Array<object>} issues
 */
function checkBankAccount(extracted, supplier = null) {
  const issues = [];
  if (!extracted || !extracted.bankAccount || !supplier || !supplier.bankAccount) {
    return issues;
  }

  const cleanExtracted = String(extracted.bankAccount).replace(/\s+/g, '');
  const cleanKnown = String(supplier.bankAccount).replace(/\s+/g, '');

  if (cleanExtracted !== cleanKnown) {
    issues.push({
      type: 'BANK_DETAILS_CHANGED',
      severity: 'high',
      field: 'bankAccount',
      message: `Bank account on document (${extracted.bankAccount}) differs from supplier records on file (${supplier.bankAccount})`
    });
  }

  return issues;
}

module.exports = {
  checkBankAccount
};
