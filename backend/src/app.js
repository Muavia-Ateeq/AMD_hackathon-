// backend/src/app.js
// Express app setup, middleware and route registration. Owned by Ammar

require('dotenv').config();
const express = require('express');
const cors = require('./middleware/cors');
const errorHandler = require('./middleware/errorHandler');

const documentsRouter = require('./routes/documents.routes');
const ordersRouter = require('./routes/orders.routes');
const metricsRouter = require('./routes/metrics.routes');
const exportRouter = require('./routes/export.routes');
const healthRouter = require('./routes/health.routes');
const webhooksRouter = require('./routes/webhooks.routes');

const rateLimit = require('./middleware/rateLimit');
// Register rate limiter for all API routes
app.use('/api', rateLimit);


app.use(cors);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register API routes
app.use('/api/documents', documentsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/export', exportRouter);
app.use('/api/health', healthRouter);
app.use('/api/webhooks', webhooksRouter);

// Central error handler
app.use(errorHandler);

module.exports = app;
