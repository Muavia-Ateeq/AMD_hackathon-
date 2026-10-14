// backend/src/middleware/errorHandler.js
// Central error handling middleware. Owned by Ammar

const pino = require('pino');
const logger = pino();

function errorHandler(err, req, res, next) {
  logger.error(err);

  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR');
  const message = err.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    error: {
      code,
      message
    }
  });
}

module.exports = errorHandler;
