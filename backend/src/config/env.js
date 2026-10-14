// env.js
// Loads and validates environment variables using zod. Owned by Ammar

const { z } = require('zod');

const EnvSchema = z.object({
  PORT: z.string().default('3000'),
  MONGODB_URI: z.string().url(),
  EVOLUS_ENDPOINT: z.string().url(),
  EVOLUS_API_KEY: z.string().optional(),
  EVOLUS_MODE: z.enum(['mock', 'prod']).default('mock'),
  CONFIDENCE_MIN: z.string().default('0.90'),
  AMOUNT_RISK_LIMIT: z.string().default('5000'),
  LOG_LEVEL: z.string().default('info'),
});

const env = EnvSchema.parse(process.env);
module.exports = env;
