// backend/src/models/Supplier.js
// Mongoose model for Supplier schema. Owned by Ammar

const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, index: true },
  bankAccount: { type: String, required: true },
  currency: { type: String, default: 'USD' },
  contactEmail: { type: String, default: null },
  isApproved: { type: Boolean, default: true }
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

module.exports = mongoose.model('Supplier', SupplierSchema);
