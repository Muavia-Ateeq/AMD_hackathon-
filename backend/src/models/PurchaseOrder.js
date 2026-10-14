// backend/src/models/PurchaseOrder.js
// Mongoose model for Purchase Order schema. Owned by Ammar

const mongoose = require('mongoose');

const POLineSchema = new mongoose.Schema({
  description: { type: String, required: true },
  qty: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  lineTotal: { type: Number, required: true }
}, { _id: false });

const PurchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, required: true, unique: true, index: true },
  supplierName: { type: String, required: true, index: true },
  currency: { type: String, default: 'USD' },
  lines: [POLineSchema],
  total: { type: Number, required: true },
  status: { type: String, enum: ['open', 'matched', 'closed'], default: 'open' }
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);
