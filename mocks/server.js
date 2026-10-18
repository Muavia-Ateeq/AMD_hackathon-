// mocks/server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'] }));

const MOCK_DIR = path.resolve(__dirname);

// Helper to load JSON fixture
function loadFixture(file) {
  const fp = path.join(MOCK_DIR, file);
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

// 1. Upload document (mock)
app.post('/api/documents', (req, res) => {
  // In real server we would handle multipart, but mock just returns a static id
  res.status(202).json({ id: 'doc-mock-001', status: 'processing' });
});

// 2. List documents
app.get('/api/documents', (req, res) => {
  const data = loadFixture('documents.list.json');
  res.json({ documents: data, nextCursor: null });
});

// 3. Get single document
app.get('/api/documents/:id', (req, res) => {
  const id = req.params.id;
  // map known ids to fixture filenames
  const map = {
    'doc-clean-001': 'document.clean_auto_approved.json',
    'doc-mock-001': 'document.clean_auto_approved.json',
    'doc-total-mismatch': 'document.total_mismatch.json',
    'doc-qty-mismatch': 'document.qty_mismatch.json',
    'doc-price-mismatch': 'document.price_mismatch.json',
    'doc-duplicate-001': 'document.duplicate_invoice.json',
    'doc-low-conf-001': 'document.low_confidence.json',
    'doc-bank-changed-001': 'document.bank_changed.json',
    'doc-processing-001': 'document.processing.json'
  };
  const file = map[id];
  if (!file) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Document not found' } });
  }
  const data = loadFixture(file);
  res.json(data);
});

// 4. Decision endpoint (mock – just echo back)
app.post('/api/documents/:id/decision', (req, res) => {
  const { action, note } = req.body;
  if (!action) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Missing action' } });
  }
  // Return a minimal summary similar to list endpoint
  res.json({ id: req.params.id, status: action === 'approve' ? 'auto_approved' : action === 'reject' ? 'rejected' : 'needs_review', note: note || null });
});

// 5. Orders
app.get('/api/orders', (req, res) => {
  const data = loadFixture('orders.json');
  res.json(data);
});

// 6. Metrics
app.get('/api/metrics', (req, res) => {
  const data = loadFixture('metrics.json');
  res.json(data);
});

// 7. Evolus webhook (internal)
app.post('/api/webhooks/evolus', (req, res) => {
  // just acknowledge
  res.json({ status: 'received' });
});

// 8. Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || process.env.MOCK_SERVER_PORT || 4000;
app.listen(PORT, () => {
  console.log(`Mock server listening on http://localhost:${PORT}`);
});
