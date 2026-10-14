// backend/src/models/Document.js
// Mongoose model for Document schema. Owned by Ammar

const mongoose = require('mongoose');

const DocumentLineSchema = new mongoose.Schema({
  description: { type: String, default: null },
  qty: { type: Number, default: null },
  unitPrice: { type: Number, default: null },
  lineTotal: { type: Number, default: null }
}, { _id: false });

const ExtractedDataSchema = new mongoose.Schema({
  invoiceNumber: { type: String, default: null },
  date: { type: String, default: null },
  currency: { type: String, default: null },
  poNumber: { type: String, default: null },
  lines: [DocumentLineSchema],
  subtotal: { type: Number, default: null },
  tax: { type: Number, default: null },
  total: { type: Number, default: null },
  bankAccount: { type: String, default: null }
}, { _id: false });

const DocumentIssueSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'TOTAL_MISMATCH',
      'QTY_MISMATCH',
      'PRICE_MISMATCH',
      'MISSING_PO',
      'DUPLICATE_INVOICE',
      'UNKNOWN_SUPPLIER',
      'LOW_CONFIDENCE',
      'BANK_DETAILS_CHANGED'
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true
  },
  field: { type: String, default: null },
  message: { type: String, required: true }
}, { _id: false });

const DocumentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  executionId: { type: String, default: null, index: true },
  fileName: { type: String, required: true },
  uploadedAt: { type: String, required: true },
  supplierName: { type: String, default: null },
  language: { type: String, default: 'en' },
  type: {
    type: String,
    enum: ['invoice', 'delivery_note'],
    default: 'invoice'
  },
  status: {
    type: String,
    enum: ['processing', 'auto_approved', 'needs_review', 'rejected', 'approved_by_human'],
    default: 'processing',
    index: true
  },
  extracted: { type: ExtractedDataSchema, default: null },
  confidence: { type: Map, of: Number, default: {} },
  issues: [DocumentIssueSchema],
  explanation: { type: String, default: null },
  supplierReplyDraft: { type: String, default: null },
  redactedFileUrl: { type: String, default: null },
  timing: {
    totalMs: { type: Number, default: null },
    modelMs: { type: Number, default: null }
  },
  costEstimate: { type: Number, default: null },
  auditLog: [{
    action: { type: String, required: true },
    note: { type: String, default: null },
    timestamp: { type: Date, default: Date.now }
  }],
  rawEvolusPayload: { type: mongoose.Schema.Types.Mixed, default: null },
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

module.exports = mongoose.model('Document', DocumentSchema);
