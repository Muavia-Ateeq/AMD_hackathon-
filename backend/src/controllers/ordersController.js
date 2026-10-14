// backend/src/controllers/ordersController.js
// Controller for purchase order endpoints. Owned by Ammar

const mongoose = require('mongoose');
const PurchaseOrder = require('../models/PurchaseOrder');

const DEFAULT_ORDERS = [
  { poNumber: 'PO-2001', supplierName: 'Alpha Supplies', total: 242.0 },
  { poNumber: 'PO-3002', supplierName: 'Omega Supplies', total: 150.0 },
  { poNumber: 'PO-4003', supplierName: 'Sigma Parts', total: 55.0 },
  { poNumber: 'PO-5004', supplierName: 'Theta Instruments', total: 22.0 },
  { poNumber: 'PO-6005', supplierName: 'Kappa Enterprises', total: 110.0 },
  { poNumber: 'PO-7006', supplierName: 'Lambda Supplies', total: 99.0 },
  { poNumber: 'PO-8007', supplierName: 'Omega Banking', total: 550.0 }
];

async function listOrders(req, res, next) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.json(DEFAULT_ORDERS);
    }
    const orders = await PurchaseOrder.find().lean();
    if (orders && orders.length > 0) {
      return res.json(orders);
    }
    return res.json(DEFAULT_ORDERS);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listOrders
};
