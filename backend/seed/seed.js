// backend/seed/seed.js
// Run with: npm run seed
// Populates the Supplier and PurchaseOrder collections with a deterministic
// demo dataset aligned with the fixtures in backend/fixtures and mocks/.
//
// Deliberately NOT random: the mock scenarios in mocks/document.*.json are
// written against these exact suppliers, PO numbers and bank accounts, so
// that every rule path is reproducible.
//
// Note on PO totals: poMatch compares the invoice's tax-inclusive `total`
// against the purchase order `total`, while `lines` sum pre-tax. PO-2001
// therefore has lines summing to 220.00 and a total of 242.00 (220 + 10%
// tax), matching mocks/orders.json. See docs/api.md for the semantics.

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

// Model file names are capitalised. These were previously required as
// '../src/models/supplier' and '../src/models/purchaseOrder', which resolves
// on a case-insensitive Windows filesystem but fails with MODULE_NOT_FOUND in
// the Linux container.
const Supplier = require('../src/models/Supplier');
const PurchaseOrder = require('../src/models/PurchaseOrder');

function loadJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Seed fixture not found: ${filePath}`);
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON array`);
    }
    return parsed;
  } catch (err) {
    // Previously this threw a bare SyntaxError, because the fixture files
    // held only `//` comments rather than JSON.
    throw new Error(`Could not parse ${label} at ${filePath}: ${err.message}`);
  }
}

(async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/supplier-docs';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`Connected to MongoDB at ${mongoUri}`);

    const suppliers = loadJson(path.resolve(__dirname, 'suppliers.json'), 'suppliers.json');
    const purchaseOrders = loadJson(path.resolve(__dirname, 'purchaseOrders.json'), 'purchaseOrders.json');
    console.log(`Loaded ${suppliers.length} suppliers and ${purchaseOrders.length} purchase orders`);

    const supplierNames = new Set(suppliers.map(s => s.name));
    const orphans = purchaseOrders.filter(po => !supplierNames.has(po.supplierName));
    if (orphans.length > 0) {
      throw new Error(
        `Purchase orders reference unknown suppliers: ${orphans.map(p => p.poNumber).join(', ')}`
      );
    }

    await Promise.all([
      Supplier.deleteMany({}),
      PurchaseOrder.deleteMany({})
    ]);

    await Supplier.insertMany(suppliers);
    await PurchaseOrder.insertMany(purchaseOrders);

    console.log(`Seeded ${suppliers.length} suppliers and ${purchaseOrders.length} purchase orders`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err.message);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
})();