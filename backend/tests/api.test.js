// backend/tests/api.test.js
// API integration tests. Owned by Ammar

const http = require('http');
const app = require('../src/app');

let server;
let baseUrl;

beforeAll((done) => {
  // Listen on ephemeral port (0) for isolation
  server = app.listen(0, () => {
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

describe('API Integration Tests', () => {
  test('GET /api/health returns 200 with status ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });

  test('GET /api/orders returns array of purchase orders', async () => {
    const res = await fetch(`${baseUrl}/api/orders`);
    expect(res.status).toBe(200);
    const orders = await res.json();
    expect(Array.isArray(orders)).toBe(true);
    expect(orders.length).toBeGreaterThan(0);
    expect(orders[0].poNumber).toBeDefined();
  });

  test('GET /api/metrics returns system metrics and GPU stats', async () => {
    const res = await fetch(`${baseUrl}/api/metrics`);
    expect(res.status).toBe(200);
    const metrics = await res.json();
    expect(metrics.countsByStatus).toBeDefined();
    expect(metrics.gpu).toBeDefined();
    expect(metrics.gpu.name).toBeDefined();
  });

  test('POST /api/documents/:id/decision validates action with Zod', async () => {
    const res = await fetch(`${baseUrl}/api/documents/doc-test/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invalid_action' })
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST /api/webhooks/evolus acknowledges workflow hook', async () => {
    const res = await fetch(`${baseUrl}/api/webhooks/evolus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowId: 'wf-123', status: 'completed' })
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('received');
  });
});
