// backend/src/utils/logger.js
// Simple wrapper around pino logger. Owned by Ammar

const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino/file',
    options: { destination: 1 } // stdout
  } : undefined
});

module.exports = logger;
