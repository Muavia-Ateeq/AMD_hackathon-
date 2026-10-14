// backend/src/middleware/rateLimit.js
// Simple rate limiting using express-rate-limit.
// Allows 100 requests per minute per IP on all API routes.

const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded' } },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false
});

module.exports = apiLimiter;
