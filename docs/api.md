# API Documentation (docs/api.md)

> **This document is a summary. [`../CONTRACT.md`](../CONTRACT.md) is authoritative** and includes the full error-code table, the status state machine and the frontend integration guide.

## Base URL

All endpoints are relative to the **BASE_URL** defined by the environment variable `API_BASE_URL` (default `http://localhost:3000`).

## CORS

Allowed origins are taken from the env var `CORS_ALLOWED_ORIGINS` (comma‑separated). Default: `http://localhost:5173, http://localhost:3000, http://127.0.0.1:5173`. A rejected origin returns **403** `CORS_FORBIDDEN`.

## Authentication

**None.** All endpoints except the Evolus webhook are unauthenticated. Do not expose the service publicly without an authenticating gateway in front of it. See `SYSTEM_LEDGER.md`.

## Error format

Every error response follows the same JSON schema:
```json
{
  "error": {
    "code": "<string>",
    "message": "<human readable description>"
  }
}
```

Common codes: `VALIDATION_ERROR`, `INVALID_FILE_TYPE`, `UNAUTHORIZED`, `NOT_FOUND`, `CORS_FORBIDDEN`, `CONFLICT`, `PAYLOAD_TOO_LARGE`, `SERVICE_UNAVAILABLE`, `TOO_MANY_REQUESTS`, `INTERNAL_ERROR`.

Messages for 5xx responses are generic; internal detail is logged server-side only. Errors explicitly marked safe (`err.expose`) such as the database-unavailable 503 do return their message.

## Rate limiting

100 requests per minute per IP, applied to all `/api` routes. Requests with no `Origin` (curl, Postman, server-side calls) are allowed through CORS; rate limiting still applies.

## Endpoints

### 1. Upload a document
**POST** `/api/documents`

*Multipart form* (`Content‑Type: multipart/form-data`)
- **file** – PDF file (required)
- **language** – ISO 639‑1 language code (optional, default inferred)
- **type** – `invoice` or `delivery_note` (optional, default inferred)

**Response (202 Accepted)**
```json
{
  "id": "<document‑id>",
  "status": "processing"
}
```

**Error** – validation errors return 400 with the generic error format.

---
### 2. List documents
**GET** `/api/documents`

Query parameters:
- `status` – filter by status (`processing`, `auto_approved`, `needs_review`, `rejected`, `approved_by_human`). An unknown value returns 400.
- `limit` – number of items to return (default 20, max 100).
- `cursor` – opaque pagination cursor. Pass the previous response's `nextCursor` verbatim. A malformed cursor returns 400.

Pagination is keyset-based on `(createdAt, id)`, sorted newest first.

**Response**
```json
{
  "documents": [
    {
      "id": "<id>",
      "fileName": "invoice-123.pdf",
      "uploadedAt": "2026-10-14T08:30:00.000Z",
      "supplierName": "Acme Corp",
      "language": "en",
      "type": "invoice",
      "status": "auto_approved"
    }
  ],
  "nextCursor": "<string or null>"
}
```
---
### 3. Get a single document
**GET** `/api/documents/:id`

**Response** – full document object as defined in the data contract.
```json
{
  "id": "<id>",
  "fileName": "invoice‑123.pdf",
  "uploadedAt": "2026‑10‑14T08:30:00.000Z",
  "supplierName": "Acme Corp",
  "language": "en",
  "type": "invoice",
  "status": "needs_review",
  "extracted": {
    "invoiceNumber": "INV‑00123",
    "date": "2026‑10‑01",
    "currency": "USD",
    "poNumber": "PO‑456",
    "lines": [{"description":"Widget A","qty":10,"unitPrice":15.0,"lineTotal":150.0}],
    "subtotal": 150.0,
    "tax": 15.0,
    "total": 165.0,
    "bankAccount": "1234567890"
  },
  "confidence": {"invoiceNumber":0.98,"total":0.95},
  "issues": [],
  "explanation": "All fields look good.",
  "supplierReplyDraft": "Dear Supplier, …",
  "redactedFileUrl": "https://example.com/redacted/INV‑00123.pdf",
  "timing": {"totalMs": 1234, "modelMs": 456},
  "costEstimate": 0.012
}
```
---
### 4. Manual decision on a document
**POST** `/api/documents/:id/decision`

Body (JSON):
```json
{
  "action": "approve" | "reject" | "ask_supplier",
  "note": "optional free‑text note for the human reviewer"
}
```

**Response** – updated document summary (same fields as in list endpoint).
---
### 5. List purchase orders
**GET** `/api/orders`

**Response** – array of PO objects (only needed for frontend mock, shape is not critical for this demo). Example:
```json
[
  {"poNumber":"PO‑001","supplierName":"Acme Corp","total":1200.00},
  {"poNumber":"PO‑002","supplierName":"Beta Ltd","total":4500.00}
]
```
---
### 6. Metrics
**GET** `/api/metrics`

**Response** – aggregate statistics used in the dashboard. `countsByStatus` and the timing averages are measured from the database. Accuracy and cost figures require an evaluation run (`npm run eval`) and are `null` until one exists.

```json
{
  "countsByStatus": {"processing":0,"auto_approved":12,"needs_review":3,"rejected":1,"approved_by_human":0},
  "averageTotalMs": 1345,
  "averageModelMs": 420,
  "totalDocuments": 16,
  "fieldAccuracy": null,
  "errorCatchRate": null,
  "falseAlarmRate": null,
  "minutesSavedPerDoc": null,
  "gpu": {"name": null, "model": "meta-llama/Llama-2-70b-chat-hf", "tokensPerSecond": null, "requestsPerMinute": null},
  "costPerDocument": null,
  "evaluationStatus": "not_run"
}
```

`evaluationStatus` is one of `not_run`, `measured`, `database_unavailable` or `error`. Render "not measured yet" for null accuracy figures rather than `0`.
---
### 7. Evolus webhook (internal)
**POST** `/api/webhooks/evolus`

Called by Evolus when a workflow finishes.

**Authentication** – requires the `x-webhook-secret` header to match `EVOLUS_WEBHOOK_SECRET`. The secret is read from the header only, never the query string. Returns **401** on a missing or wrong secret, and **503** when the server has no secret configured (fail closed).

**Response** – `200 OK` with `{ "status": "received" }`.
---
### 8. Health check
**GET** `/api/health`

**Response** – simple JSON indicating the service is alive.
```json
{ "status": "ok", "timestamp": "2026-10-14T08:57:00.000Z" }
```

This is a **liveness probe only**: it confirms the process is serving and does not check MongoDB, Evolus or vLLM.
---
### 9. Export batch results
**GET** `/api/export/results`

Returns `backend/metrics/batch_results.json` produced by `npm run batch`, with an additional `eval` key when `npm run eval` has been run. Returns **404** until a batch has been run — this is expected, not an error.

---
## Database availability

`/api/health`, `/api/orders` and `/api/metrics` work without MongoDB
(orders and metrics fall back to zeroed values). The document endpoints require
it and return **503** `SERVICE_UNAVAILABLE` immediately rather than hanging.

---
## Polling advice for frontend
When a document is uploaded the client receives `status: "processing"`. The UI should poll **GET** `/api/documents/:id` every **2 seconds** until `status` becomes one of `auto_approved`, `needs_review`, `rejected` or `approved_by_human`.

---
*Owned by Ammar*
