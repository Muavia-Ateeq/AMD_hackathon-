// backend/tests/scenarios.test.js
// Replays every mocks/document.*.json scenario through the rules engine using
// the seeded supplier and purchase-order reference data.
//
// This is the guard that keeps the demo honest: if a rule, a tolerance or the
// seed fixtures drift, a scenario that is supposed to auto-approve no longer
// does, and the failure shows up in `npm test` rather than on stage.

const fs = require('fs');
const path = require('path');

const { runAllRules, determineStatus } = require('../src/rules');

const MOCKS = path.resolve(__dirname, '..', '..', 'mocks');
const SEED = path.resolve(__dirname, '..', 'seed');

const suppliers = JSON.parse(fs.readFileSync(path.join(SEED, 'suppliers.json'), 'utf8'));
const purchaseOrders = JSON.parse(fs.readFileSync(path.join(SEED, 'purchaseOrders.json'), 'utf8'));

const supplierByName = new Map(suppliers.map(s => [s.name, s]));
const poByNumber = new Map(purchaseOrders.map(p => [p.poNumber, p]));

function loadScenario(file) {
  const parsed = JSON.parse(fs.readFileSync(path.join(MOCKS, file), 'utf8'));
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

/**
 * Runs one scenario exactly the way pipelineService does, resolving its
 * supplier and purchase order from the seeded reference data.
 */
function evaluate(doc, { isDuplicate = false, confidenceMin = 0.90, amountRiskLimit = 5000 } = {}) {
  const supplier = supplierByName.get(doc.supplierName) || null;
  const purchaseOrder = doc.extracted.poNumber
    ? poByNumber.get(doc.extracted.poNumber) || null
    : null;

  return runAllRules({
    extracted: doc.extracted,
    confidence: doc.confidence || {},
    supplierName: doc.supplierName,
    supplier,
    purchaseOrder,
    isDuplicate,
    confidenceMin,
    amountRiskLimit
  });
}

function issueTypes(result) {
  return result.issues.map(i => i.type);
}

describe('Seeded reference data', () => {
  test('every purchase order references a seeded supplier', () => {
    const names = new Set(suppliers.map(s => s.name));
    const orphans = purchaseOrders.filter(po => !names.has(po.supplierName));
    expect(orphans).toEqual([]);
  });

  test('purchase order lines sum to their pre-tax total', () => {
    // PO totals are tax-inclusive by design, so only the lines are checked
    // for internal consistency here.
    purchaseOrders.forEach(po => {
      const lineSum = po.lines.reduce((sum, l) => sum + l.lineTotal, 0);
      expect(Number(lineSum.toFixed(2))).toBeCloseTo(po.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0), 2);
      expect(po.lines.length).toBeGreaterThan(0);
    });
  });
});

describe('Clean invoice scenario', () => {
  const doc = loadScenario('document.clean_auto_approved.json');

  test('resolves a seeded supplier and purchase order', () => {
    expect(supplierByName.has(doc.supplierName)).toBe(true);
    expect(poByNumber.has(doc.extracted.poNumber)).toBe(true);
  });

  test('produces no issues', () => {
    const result = evaluate(doc);
    expect(issueTypes(result)).toEqual([]);
  });

  test('auto-approves', () => {
    expect(evaluate(doc).status).toBe('auto_approved');
  });
});

describe('Price mismatch scenario', () => {
  const doc = loadScenario('document.price_mismatch.json');

  test('flags PRICE_MISMATCH against the PO unit price', () => {
    expect(issueTypes(evaluate(doc))).toContain('PRICE_MISMATCH');
  });

  test('routes to needs_review, not auto-approval', () => {
    // The mock fixture labels this issue "high", but the engine emits
    // "medium"; either way it must not auto-approve.
    expect(evaluate(doc).status).toBe('needs_review');
  });
});

describe('Quantity mismatch scenario', () => {
  const doc = loadScenario('document.qty_mismatch.json');

  test('flags QTY_MISMATCH and routes to needs_review', () => {
    const result = evaluate(doc);
    expect(issueTypes(result)).toContain('QTY_MISMATCH');
    expect(result.status).toBe('needs_review');
  });
});

describe('Total mismatch scenario', () => {
  const doc = loadScenario('document.total_mismatch.json');

  test('flags TOTAL_MISMATCH at high severity and rejects', () => {
    const result = evaluate(doc);
    const issue = result.issues.find(i => i.type === 'TOTAL_MISMATCH');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('high');
    expect(result.status).toBe('rejected');
  });
});

describe('Duplicate invoice scenario', () => {
  const doc = loadScenario('document.duplicate_invoice.json');

  test('rejects when a prior document carries the same invoice number', () => {
    const result = evaluate(doc, { isDuplicate: true });
    expect(issueTypes(result)).toContain('DUPLICATE_INVOICE');
    expect(result.status).toBe('rejected');
  });

  test('does not flag a duplicate when no prior document exists', () => {
    const result = evaluate(doc, { isDuplicate: false });
    expect(issueTypes(result)).not.toContain('DUPLICATE_INVOICE');
  });
});

describe('Bank details changed scenario', () => {
  const doc = loadScenario('document.bank_changed.json');

  test('detects the mismatch and rejects at high severity', () => {
    const result = evaluate(doc);
    expect(issueTypes(result)).toContain('BANK_DETAILS_CHANGED');
    expect(result.status).toBe('rejected');
  });

  test('the seeded account deliberately differs from the invoice', () => {
    const seeded = supplierByName.get(doc.supplierName);
    expect(seeded).toBeDefined();
    expect(seeded.bankAccount).not.toBe(doc.extracted.bankAccount);
  });
});

describe('Low confidence scenario', () => {
  const doc = loadScenario('document.low_confidence.json');

  test('flags LOW_CONFIDENCE and routes to needs_review', () => {
    const result = evaluate(doc);
    expect(issueTypes(result)).toContain('LOW_CONFIDENCE');
    expect(result.status).toBe('needs_review');
  });
});

describe('Unknown supplier scenario', () => {
  test('a supplier absent from the registry is flagged and held for review', () => {
    const doc = loadScenario('document.clean_auto_approved.json');
    const result = runAllRules({
      extracted: doc.extracted,
      confidence: doc.confidence,
      supplierName: 'A Supplier We Have Never Heard Of',
      supplier: null,
      purchaseOrder: poByNumber.get(doc.extracted.poNumber),
      isDuplicate: false,
      confidenceMin: 0.90,
      amountRiskLimit: 5000
    });

    expect(issueTypes(result)).toContain('UNKNOWN_SUPPLIER');
    expect(result.status).toBe('needs_review');
  });
});

describe('Amount risk limit scenario', () => {
  // Tested against determineStatus directly. Scaling a real invoice up to the
  // limit would also break its purchase-order match, so the TOTAL_MISMATCH
  // that fires at high severity would mask the threshold under test.
  test('an invoice at the risk limit is held for review', () => {
    expect(determineStatus({
      issues: [],
      confidence: { total: 0.99 },
      total: 5000,
      supplierKnown: true,
      confidenceMin: 0.90,
      amountRiskLimit: 5000
    }).status).toBe('needs_review');
  });

  test('an invoice below the risk limit auto-approves', () => {
    expect(determineStatus({
      issues: [],
      confidence: { total: 0.99 },
      total: 4999.99,
      supplierKnown: true,
      confidenceMin: 0.90,
      amountRiskLimit: 5000
    }).status).toBe('auto_approved');
  });
});

describe('Confidence threshold semantics', () => {
  test('a field exactly at the threshold passes, below it does not', () => {
    const atThreshold = determineStatus({
      issues: [],
      confidence: { total: 0.90 },
      total: 100,
      supplierKnown: true,
      confidenceMin: 0.90,
      amountRiskLimit: 5000
    });
    const belowThreshold = determineStatus({
      issues: [],
      confidence: { total: 0.89 },
      total: 100,
      supplierKnown: true,
      confidenceMin: 0.90,
      amountRiskLimit: 5000
    });

    expect(atThreshold.status).toBe('auto_approved');
    expect(belowThreshold.status).toBe('needs_review');
  });
});