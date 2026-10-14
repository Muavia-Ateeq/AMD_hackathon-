// backend/src/rules/priceQtyCheck.js
// Rule to validate price and quantity consistency. Owned by Ammar

const { toMinor, isCloseMinor } = require('../utils/money');

/**
 * Validates line-level arithmetic and compares line items with PO if available.
 * @param {object} extracted
 * @param {object|null} purchaseOrder
 * @returns {Array<object>} issues
 */
function checkPriceAndQty(extracted, purchaseOrder = null) {
  const issues = [];
  if (!extracted || !Array.isArray(extracted.lines)) return issues;

  // 1. Validate internal line arithmetic: qty * unitPrice = lineTotal
  extracted.lines.forEach((line, idx) => {
    if (typeof line.qty === 'number' && typeof line.unitPrice === 'number' && typeof line.lineTotal === 'number') {
      const calculatedLineTotal = toMinor(line.qty * line.unitPrice);
      if (!isCloseMinor(calculatedLineTotal, toMinor(line.lineTotal))) {
        issues.push({
          type: 'PRICE_MISMATCH',
          severity: 'medium',
          field: `lines[${idx}].lineTotal`,
          message: `Line ${idx + 1} ("${line.description || 'Item'}") total (${line.lineTotal}) does not match qty (${line.qty}) * unitPrice (${line.unitPrice}) = ${calculatedLineTotal}`
        });
      }
    }
  });

  // 2. Cross-check against PO lines if PO provided
  if (purchaseOrder && Array.isArray(purchaseOrder.lines)) {
    extracted.lines.forEach((line, idx) => {
      // Find matching PO line by description or fallback to index
      const poLine = purchaseOrder.lines.find(
        pl => pl.description && line.description && pl.description.toLowerCase().trim() === line.description.toLowerCase().trim()
      ) || purchaseOrder.lines[idx];

      if (poLine) {
        if (typeof line.qty === 'number' && typeof poLine.qty === 'number' && line.qty !== poLine.qty) {
          issues.push({
            type: 'QTY_MISMATCH',
            severity: 'medium',
            field: `lines[${idx}].qty`,
            message: `Line ${idx + 1} quantity (${line.qty}) does not match PO quantity (${poLine.qty})`
          });
        }
        if (typeof line.unitPrice === 'number' && typeof poLine.unitPrice === 'number' && !isCloseMinor(toMinor(line.unitPrice), toMinor(poLine.unitPrice))) {
          issues.push({
            type: 'PRICE_MISMATCH',
            severity: 'medium',
            field: `lines[${idx}].unitPrice`,
            message: `Line ${idx + 1} unit price (${line.unitPrice}) does not match PO unit price (${poLine.unitPrice})`
          });
        }
      }
    });
  }

  return issues;
}

module.exports = {
  checkPriceAndQty
};
