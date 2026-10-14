// backend/tests/rules.test.js
// Tests for rule functions and decision engine. Owned by Ammar

const {
  runAllRules,
  checkTotals,
  checkPriceAndQty,
  checkPurchaseOrder,
  checkDuplicate,
  checkBankAccount,
  checkSupplier,
  checkConfidence,
  determineStatus
} = require('../src/rules');
const { roundMoney, isClose } = require('../src/utils/money');

describe('Money utility functions', () => {
  test('roundMoney rounds to 2 decimals correctly', () => {
    expect(roundMoney(10.555)).toBe(10.56);
    expect(roundMoney(10.554)).toBe(10.55);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });

  test('isClose compares values within 0.01 tolerance', () => {
    expect(isClose(100.00, 100.009)).toBe(true);
    expect(isClose(100.00, 100.02)).toBe(false);
  });
});

describe('Rules: checkTotals', () => {
  test('passes on valid line totals, subtotal, and tax', () => {
    const extracted = {
      lines: [
        { qty: 2, unitPrice: 50, lineTotal: 100 },
        { qty: 1, unitPrice: 25, lineTotal: 25 }
      ],
      subtotal: 125,
      tax: 12.5,
      total: 137.5
    };
    const issues = checkTotals(extracted);
    expect(issues).toHaveLength(0);
  });

  test('detects subtotal mismatch when line sums differ from subtotal', () => {
    const extracted = {
      lines: [
        { qty: 2, unitPrice: 50, lineTotal: 100 },
        { qty: 1, unitPrice: 25, lineTotal: 25 }
      ],
      subtotal: 150, // Should be 125
      tax: 15,
      total: 165
    };
    const issues = checkTotals(extracted);
    expect(issues.some(i => i.type === 'TOTAL_MISMATCH' && i.field === 'subtotal')).toBe(true);
  });

  test('detects total mismatch when subtotal + tax does not equal total', () => {
    const extracted = {
      lines: [{ qty: 1, unitPrice: 100, lineTotal: 100 }],
      subtotal: 100,
      tax: 10,
      total: 120 // Should be 110
    };
    const issues = checkTotals(extracted);
    expect(issues.some(i => i.type === 'TOTAL_MISMATCH' && i.field === 'total')).toBe(true);
  });
});

describe('Rules: checkPriceAndQty', () => {
  test('flags PRICE_MISMATCH if qty * unitPrice does not equal lineTotal', () => {
    const extracted = {
      lines: [{ description: 'Widget', qty: 10, unitPrice: 5, lineTotal: 60 }] // 10 * 5 != 60
    };
    const issues = checkPriceAndQty(extracted);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('PRICE_MISMATCH');
  });

  test('flags QTY_MISMATCH if invoice quantity exceeds PO quantity', () => {
    const extracted = {
      lines: [{ description: 'Widget', qty: 15, unitPrice: 10, lineTotal: 150 }]
    };
    const po = {
      lines: [{ description: 'Widget', qty: 10, unitPrice: 10, lineTotal: 100 }]
    };
    const issues = checkPriceAndQty(extracted, po);
    expect(issues.some(i => i.type === 'QTY_MISMATCH')).toBe(true);
  });
});

describe('Rules: checkPurchaseOrder', () => {
  test('flags MISSING_PO if document has no poNumber', () => {
    const extracted = { poNumber: null };
    const issues = checkPurchaseOrder(extracted, null);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('MISSING_PO');
  });

  test('flags MISSING_PO if poNumber is not found in database', () => {
    const extracted = { poNumber: 'PO-9999' };
    const issues = checkPurchaseOrder(extracted, null);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('MISSING_PO');
  });

  test('flags TOTAL_MISMATCH if invoice total does not match PO total', () => {
    const extracted = { poNumber: 'PO-100', total: 500 };
    const po = { poNumber: 'PO-100', total: 450 };
    const issues = checkPurchaseOrder(extracted, po);
    expect(issues.some(i => i.type === 'TOTAL_MISMATCH')).toBe(true);
  });
});

describe('Rules: checkDuplicate', () => {
  test('flags DUPLICATE_INVOICE with high severity when duplicate exists', () => {
    const extracted = { invoiceNumber: 'INV-12345' };
    const issues = checkDuplicate(extracted, true);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('DUPLICATE_INVOICE');
    expect(issues[0].severity).toBe('high');
  });
});

describe('Rules: checkBankAccount', () => {
  test('flags BANK_DETAILS_CHANGED if bank account differs from records', () => {
    const extracted = { bankAccount: 'GB88BARC1234567890' };
    const supplier = { bankAccount: 'GB88BARC9999999999' };
    const issues = checkBankAccount(extracted, supplier);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('BANK_DETAILS_CHANGED');
    expect(issues[0].severity).toBe('high');
  });

  test('passes when bank accounts match (even with formatting spaces)', () => {
    const extracted = { bankAccount: 'GB88 BARC 1234 5678 90' };
    const supplier = { bankAccount: 'GB88BARC1234567890' };
    const issues = checkBankAccount(extracted, supplier);
    expect(issues).toHaveLength(0);
  });
});

describe('Rules: checkSupplier', () => {
  test('flags UNKNOWN_SUPPLIER when supplier is not in registry', () => {
    const issues = checkSupplier('Unapproved Supplier LLC', null);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('UNKNOWN_SUPPLIER');
    expect(issues[0].severity).toBe('medium');
  });
});

describe('Rules: checkConfidence', () => {
  test('flags LOW_CONFIDENCE when any field is below threshold', () => {
    const confidence = { total: 0.95, invoiceNumber: 0.82 };
    const issues = checkConfidence(confidence, 0.90);
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('LOW_CONFIDENCE');
    expect(issues[0].field).toBe('invoiceNumber');
  });
});

describe('Rules: determineStatus (Decision Rules)', () => {
  test('auto_approved when all checks pass and total is below risk limit', () => {
    const decision = determineStatus({
      issues: [],
      confidence: { total: 0.98, invoiceNumber: 0.95 },
      total: 1200,
      supplierKnown: true,
      confidenceMin: 0.90,
      amountRiskLimit: 5000
    });
    expect(decision.status).toBe('auto_approved');
  });

  test('rejected when DUPLICATE_INVOICE issue exists', () => {
    const decision = determineStatus({
      issues: [{ type: 'DUPLICATE_INVOICE', severity: 'high', field: 'invoiceNumber', message: 'Duplicate' }],
      confidence: { total: 0.98 },
      total: 500,
      supplierKnown: true
    });
    expect(decision.status).toBe('rejected');
  });

  test('rejected when BANK_DETAILS_CHANGED issue exists', () => {
    const decision = determineStatus({
      issues: [{ type: 'BANK_DETAILS_CHANGED', severity: 'high', field: 'bankAccount', message: 'Bank changed' }],
      confidence: { total: 0.98 },
      total: 500,
      supplierKnown: true
    });
    expect(decision.status).toBe('rejected');
  });

  test('needs_review when amount exceeds AMOUNT_RISK_LIMIT', () => {
    const decision = determineStatus({
      issues: [],
      confidence: { total: 0.98 },
      total: 6500, // > 5000
      supplierKnown: true,
      amountRiskLimit: 5000
    });
    expect(decision.status).toBe('needs_review');
  });

  test('needs_review when supplier is unknown', () => {
    const decision = determineStatus({
      issues: [{ type: 'UNKNOWN_SUPPLIER', severity: 'medium', field: 'supplierName', message: 'Unknown' }],
      confidence: { total: 0.95 },
      total: 500,
      supplierKnown: false
    });
    expect(decision.status).toBe('needs_review');
  });

  test('needs_review when a field confidence is below CONFIDENCE_MIN', () => {
    const decision = determineStatus({
      issues: [{ type: 'LOW_CONFIDENCE', severity: 'low', field: 'tax', message: 'Low confidence' }],
      confidence: { total: 0.95, tax: 0.85 },
      total: 500,
      supplierKnown: true,
      confidenceMin: 0.90
    });
    expect(decision.status).toBe('needs_review');
  });
});

describe('Rules: Full Pipeline runAllRules', () => {
  test('processes clean invoice into auto_approved', () => {
    const result = runAllRules({
      extracted: {
        invoiceNumber: 'INV-100',
        poNumber: 'PO-200',
        subtotal: 100,
        tax: 10,
        total: 110,
        bankAccount: 'ACC123',
        lines: [{ description: 'Paper', qty: 10, unitPrice: 10, lineTotal: 100 }]
      },
      confidence: { invoiceNumber: 0.99, total: 0.95 },
      supplierName: 'Paper Co',
      supplier: { name: 'Paper Co', bankAccount: 'ACC123' },
      purchaseOrder: {
        poNumber: 'PO-200',
        total: 110,
        lines: [{ description: 'Paper', qty: 10, unitPrice: 10, lineTotal: 100 }]
      },
      isDuplicate: false,
      confidenceMin: 0.90,
      amountRiskLimit: 5000
    });

    expect(result.status).toBe('auto_approved');
    expect(result.issues).toHaveLength(0);
  });
});
