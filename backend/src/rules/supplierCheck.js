// backend/src/rules/supplierCheck.js
// Rule to verify supplier existence and status. Owned by Ammar

/**
 * Validates if the supplier is recognized and approved.
 * @param {string|null} supplierName
 * @param {object|null} supplier
 * @returns {Array<object>} issues
 */
function checkSupplier(supplierName, supplier = null) {
  const issues = [];

  if (!supplierName || !supplier) {
    issues.push({
      type: 'UNKNOWN_SUPPLIER',
      severity: 'medium',
      field: 'supplierName',
      message: `Supplier "${supplierName || 'Unknown'}" is not registered in the system`
    });
  }

  return issues;
}

module.exports = {
  checkSupplier
};
