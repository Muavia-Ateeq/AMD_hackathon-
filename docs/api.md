# API Documentation (docs/api.md)

## Base URL

All endpoints are relative to the **BASE_URL** defined by the environment variable `API_BASE_URL` (default `http://localhost:3000`).

## CORS

Allowed origins are taken from the env var `CORS_ALLOWED_ORIGINS` (comma‑separated). In mock server we allow `http://localhost:5173`.

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
Typical `code` values: `VALIDATION_ERROR`, `NOT_FOUND`, `INTERNAL_ERROR`.

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
- `status` – filter by status (`processing`, `auto_approved`, `needs_review`, `rejected`). Optional.
- `limit` – number of items to return (default 20, max 100).
- `cursor` – pagination cursor (opaque string returned by previous call). Optional.

**Response**
```json
{
  "documents": [
    {
      "id": "<id>",
      "fileName": "invoice‑123.pdf",
      "uploadedAt": "2026‑10‑14T08:30:00.000Z",
      "supplierName": "Acme Corp",
      "language": "en",
      "type": "invoice",
      "status": "auto_approved"
    }
    // …
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

**Response** – aggregate statistics used in the dashboard.
```json
{
  "countsByStatus": {"processing":10,"auto_approved":25,"needs_review":5,"rejected":2},
  "averageTotalMs": 1345,
  "averageModelMs": 420,
  "fieldAccuracy": 0.96,
  "errorCatchRate": 0.02,
  "falseAlarmRate": 0.01,
  "minutesSavedPerDoc": 3.5,
  "gpu": {"name":"AMD Radeon Instinct MI250","model":"Llama‑2‑70B","tokensPerSecond": 4500,"requestsPerMinute": 30},
  "costPerDocument": 0.015
}
```
---
### 7. Evolus webhook (internal)
**POST** `/api/webhooks/evolus`

Called by Evolus when a workflow finishes. Payload is Evolus‑specific; the mock server just acknowledges.

**Response** – `200 OK` with `{ "status": "received" }`.
---
### 8. Health check
**GET** `/api/health`

**Response** – simple JSON indicating the service is alive.
```json
{ "status": "ok", "timestamp": "2026‑10‑14T08:57:00.000Z" }
```
---
## Polling advice for frontend
When a document is uploaded the client receives `status: "processing"`. The UI should poll **GET** `/api/documents/:id` every **2 seconds** until `status` becomes any of `auto_approved`, `needs_review` or `rejected`.

---
*Owned by Ammar*
