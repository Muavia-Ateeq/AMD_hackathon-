// backend/tests/fixtures.test.js
// Guards the repository's data files against the failure mode that repeatedly
// slipped through: JSON files carrying a leading `//` comment, which JSON.parse
// rejects outright. Owned by Ammar

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'coverage']);
const SKIP_FILES = new Set(['package-lock.json']);

function collectJson(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJson(full, found);
    } else if (entry.name.endsWith('.json') && !SKIP_FILES.has(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

describe('JSON fixtures', () => {
  const files = collectJson(ROOT);

  test('the repository actually contains JSON fixtures', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  test.each(files.map(f => [path.relative(ROOT, f).replace(/\\/g, '/'), f]))(
    '%s parses as strict JSON',
    (_label, file) => {
      const raw = fs.readFileSync(file, 'utf8');
      expect(() => JSON.parse(raw)).not.toThrow();
    }
  );

  test('seed fixtures are non-empty arrays', () => {
    const suppliers = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend/seed/suppliers.json'), 'utf8'));
    const orders = JSON.parse(fs.readFileSync(path.join(ROOT, 'backend/seed/purchaseOrders.json'), 'utf8'));

    expect(Array.isArray(suppliers)).toBe(true);
    expect(Array.isArray(orders)).toBe(true);
    expect(suppliers.length).toBeGreaterThan(0);
    expect(orders.length).toBeGreaterThan(0);

    suppliers.forEach(s => {
      expect(s.name).toBeTruthy();
      expect(s.bankAccount).toBeTruthy();
    });

    orders.forEach(po => {
      expect(po.poNumber).toBeTruthy();
      expect(po.supplierName).toBeTruthy();
      expect(typeof po.total).toBe('number');
      expect(Array.isArray(po.lines)).toBe(true);
      po.lines.forEach(l => {
        expect(typeof l.qty).toBe('number');
        expect(typeof l.unitPrice).toBe('number');
        expect(typeof l.lineTotal).toBe('number');
      });
    });
  });

  test('the JSON schema status enum matches the Mongoose model', async () => {
    const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai/schemas/invoice.schema.json'), 'utf8'));
    const Document = require('../src/models/Document');
    const modelStatuses = Document.schema.path('status').enumValues;

    expect(schema.properties.status.enum.sort()).toEqual([...modelStatuses].sort());
  });

  test('every mock scenario declares a status the model accepts', async () => {
    const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'ai/schemas/invoice.schema.json'), 'utf8'));
    const allowed = schema.properties.status.enum;
    const mocksDir = path.join(ROOT, 'mocks');

    fs.readdirSync(mocksDir)
      .filter(f => /^document\..*\.json$/.test(f))
      .forEach(file => {
        const parsed = JSON.parse(fs.readFileSync(path.join(mocksDir, file), 'utf8'));
        const docs = Array.isArray(parsed) ? parsed : [parsed];
        docs.forEach(doc => {
          expect(allowed).toContain(doc.status);
        });
      });
  });
});

describe('Documentation references', () => {
  test('every file path cited in the docs exists', () => {
    // Guards against documentation pointing at renamed or deleted files,
    // which is how the submission previously came to claim eight passing
    // requirements backed by files that did not exist.
    const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts/check_docs.js')], {
      encoding: 'utf8'
    });

    expect(result.stdout + result.stderr).toContain('All referenced paths exist.');
    expect(result.status).toBe(0);
  });
});