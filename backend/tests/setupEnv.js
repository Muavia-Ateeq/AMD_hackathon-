// backend/tests/setupEnv.js
// Pins environment for the test suite so results do not depend on a developer's
// local .env or on which services happen to be reachable. Owned by Ammar

process.env.NODE_ENV = 'test';
process.env.EVOLUS_MODE = 'mock';

// Webhook auth fails closed when unset. Pin an explicit value so the tests
// exercise the authenticated path deterministically.
process.env.EVOLUS_WEBHOOK_SECRET = 'test-webhook-secret';

// vLLM stays in mock mode: no inference calls from the test suite.
process.env.VLLM_BASE_URL = '';

process.env.LOG_LEVEL = 'silent';