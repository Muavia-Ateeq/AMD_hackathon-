// backend/src/routes/metrics.routes.js
// Routes for metrics endpoint. Owned by Ammar

const express = require('express');
const { getSystemMetrics } = require('../services/metricsService');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const metrics = await getSystemMetrics();
    res.json(metrics);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
