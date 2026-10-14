// backend/src/app.js
// Express app setup, middleware and route registration. Owned by Ammar

require('dotenv').config();
const express = require('express');
const cors = require('./middleware/cors');
const errorHandler = require('./middleware/errorHandler');

const app = express();

const documentsRouter = require('./routes/documents.routes');
const ordersRouter = require('./routes/orders.routes');
const metricsRouter = require('./routes/metrics.routes');
const exportRouter = require('./routes/export.routes');
const healthRouter = require('./routes/health.routes');
const webhooksRouter = require('./routes/webhooks.routes');

const rateLimit = require('./middleware/rateLimit');

// CORS runs before the rate limiter so that preflight OPTIONS requests are
// answered without consuming the request quota, and so 429 responses still
// carry CORS headers (otherwise browsers cannot read the rate-limit body).
app.use(cors);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register rate limiter for all API routes, after CORS and body parsing.
app.use('/api', rateLimit);

// Register API routes
app.use('/api/documents', documentsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/export', exportRouter);
app.use('/api/health', healthRouter);
app.use('/api/webhooks', webhooksRouter);

// 404 handler for unmatched API routes
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`
    }
  });
});

// Central error handler
app.use(errorHandler);

module.exports = app;