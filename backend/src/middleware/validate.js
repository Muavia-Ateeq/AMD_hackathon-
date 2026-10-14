// backend/src/middleware/validate.js
// Middleware to validate request bodies using Zod schemas. Owned by Ammar

const { ZodError } = require('zod');

/**
 * Returns an Express middleware that validates req.body (or specified property) using a Zod schema.
 * @param {import('zod').ZodSchema} schema
 * @param {'body' | 'query' | 'params'} property
 */
function validate(schema, property = 'body') {
  return (req, res, next) => {
    try {
      req[property] = schema.parse(req[property]);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const firstIssue = err.issues[0];
        const fieldPath = firstIssue?.path?.join('.') || 'payload';
        const message = firstIssue?.message ? `${fieldPath}: ${firstIssue.message}` : 'Validation error';

        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message
          }
        });
      }
      next(err);
    }
  };
}

module.exports = validate;
