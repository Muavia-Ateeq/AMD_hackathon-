// backend/src/routes/health.routes.js
// Simple health‑check endpoint used by monitoring and CI.
// Returns JSON with status and current UTC timestamp.

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
