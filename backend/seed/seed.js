// seed/seed.js
// Run with: npm run seed
// Populates Supplier and PurchaseOrder collections.
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const Supplier = require('../src/models/supplier');
const PurchaseOrder = require('../src/models/purchaseOrder');

(async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/supplier-docs';
    await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const suppliersPath = path.resolve(__dirname, 'suppliers.json');
    const poPath = path.resolve(__dirname, 'purchaseOrders.json');

    let suppliers = [];
    if (fs.existsSync(suppliersPath)) {
      suppliers = JSON.parse(fs.readFileSync(suppliersPath, 'utf8'));
      console.log(`Loaded ${suppliers.length} suppliers from fixture`);
    } else {
      // Generate fake suppliers (8)
      const faker = require('faker');
      for (let i = 0; i < 8; i++) {
        suppliers.push({
          name: faker.company.companyName(),
          bankAccount: faker.finance.iban(),
          currency: 'USD',
          contactEmail: faker.internet.email(),
          isApproved: true
        });
      }
      console.log('Generated fake suppliers');
    }

    let purchaseOrders = [];
    if (fs.existsSync(poPath)) {
      purchaseOrders = JSON.parse(fs.readFileSync(poPath, 'utf8'));
      console.log(`Loaded ${purchaseOrders.length} purchase orders from fixture`);
    } else {
      const faker = require('faker');
      for (let i = 0; i < 20; i++) {
        const items = [];
        const lineCount = faker.datatype.number({ min: 1, max: 5 });
        for (let j = 0; j < lineCount; j++) {
          const qty = faker.datatype.number({ min: 1, max: 10 });
          const unitPrice = faker.datatype.number({ min: 10, max: 500, precision: 0.01 });
          items.push({ description: faker.commerce.productName(), qty, unitPrice });
        }
        const total = items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
        purchaseOrders.push({
          poNumber: `PO-${1000 + i}`,
          supplierName: suppliers[i % suppliers.length].name,
          items,
          total: Math.round(total * 100) / 100
        });
      }
      console.log('Generated fake purchase orders');
    }

    await Supplier.deleteMany({});
    await PurchaseOrder.deleteMany({});
    await Supplier.insertMany(suppliers);
    await PurchaseOrder.insertMany(purchaseOrders);
    console.log('Seed data written to database');
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
})();
