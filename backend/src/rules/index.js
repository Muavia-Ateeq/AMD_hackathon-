// backend/src/rules/index.js
// Orchestrates all document rule checks and derives final decision. Owned by Ammar

const { checkTotals } = require('./totalCheck');
const { checkPriceAndQty } = require('./priceQtyCheck');
const { checkPurchaseOrder } = require('./poMatch');
const { checkDuplicate } = require('./duplicateCheck');
const { checkBankAccount } = require('./bankCheck');
const { checkSupplier } = require('./supplierCheck');
const { checkConfidence } = require('./confidenceCheck');
const { determineStatus } = require('./decision');

/**
 * Runs all business and numerical rules on a document.
 * @param {object} params
 * @param {object} params.extracted
 * @param {object} params.confidence
 * @param {string} params.supplierName
 * @param {object|null} params.supplier
 * @param {object|null} params.purchaseOrder
 * @param {boolean} params.isDuplicate
 * @param {number} params.confidenceMin
 * @param {number} params.amountRiskLimit
 * @returns {{ issues: Array<object>, status: string, explanation: string }}
 */
function runAllRules({
  extracted,
  confidence = {},
  supplierName = '',
  supplier = null,
  purchaseOrder = null,
  isDuplicate = false,
  confidenceMin = 0.90,
  amountRiskLimit = 5000
}) {
  const issues = [];

  // 1. Math checks on document totals
  issues.push(...checkTotals(extracted));

  // 2. Line arithmetic and item comparison against PO
  issues.push(...checkPriceAndQty(extracted, purchaseOrder));

  // 3. Purchase order verification
  issues.push(...checkPurchaseOrder(extracted, purchaseOrder));

  // 4. Duplicate invoice detection
  issues.push(...checkDuplicate(extracted, isDuplicate));

  // 5. Supplier existence check
  issues.push(...checkSupplier(supplierName, supplier));

  // 6. Bank details change check
  issues.push(...checkBankAccount(extracted, supplier));

  // 7. Confidence scores check
  issues.push(...checkConfidence(confidence, confidenceMin));

  // 8. Final status determination based on issues and thresholds
  const { status, explanation } = determineStatus({
    issues,
    confidence,
    total: extracted ? extracted.total : null,
    supplierKnown: Boolean(supplier),
    confidenceMin,
    amountRiskLimit
  });

  return {
    issues,
    status,
    explanation
  };
}

module.exports = {
  runAllRules,
  checkTotals,
  checkPriceAndQty,
  checkPurchaseOrder,
  checkDuplicate,
  checkBankAccount,
  checkSupplier,
  checkConfidence,
  determineStatus
};
