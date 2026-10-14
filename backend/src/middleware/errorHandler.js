// backend/src/middleware/errorHandler.js
// Central error handling middleware. Owned by Ammar

const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  // Log the full error server-side (stack included) for debugging.
  logger.error({ err: err.stack || err.message }, 'Request failed');

  const statusCode = err.statusCode || err.status || 500;

  // Only surface the raw message for client errors (4xx), or for errors the
  // thrower explicitly marked as safe to expose. 5xx messages otherwise come
  // from internal machinery (Mongoose buffering, axios, Zod) and would leak
  // implementation detail to the client.
  const isClientError = statusCode >= 400 && statusCode < 500;
  const isExposed = err.expose === true;
  const message = (isClientError || isExposed) && err.message
    ? err.message
    : 'An unexpected error occurred';

  const code = err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR');

  if (res.headersSent) return next(err);

  res.status(statusCode).json({
    error: {
      code,
      message
    }
  });
}

module.exports = errorHandler;