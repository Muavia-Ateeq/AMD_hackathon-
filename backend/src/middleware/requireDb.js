// backend/src/middleware/requireDb.js
// Rejects data endpoints immediately when MongoDB is unreachable. Owned by Ammar

const mongoose = require('mongoose');

/**
 * Mongoose's default command buffering means an unconnected database does not
 * fail fast: every query hangs for bufferTimeoutMS (10s) and then rejects with
 * an internal "buffering timed out" message. In practice a disconnected
 * backend looked broken rather than unavailable.
 *
 * This middleware converts that into an immediate, honest 503.
 */
function requireDb(req, res, next) {
  if (mongoose.connection.readyState === 1) return next();

  const err = new Error(
    'Database is unavailable. Start MongoDB (docker compose up -d mongodb) and retry.'
  );
  err.statusCode = 503;
  err.code = 'SERVICE_UNAVAILABLE';
  // This message is written by us, not derived from internal machinery, so it
  // is safe to return to the client even though the status is 5xx.
  err.expose = true;
  return next(err);
}

module.exports = requireDb;