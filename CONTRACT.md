# CONTRACT.md — Frontend integration guide

**Owner:** Ammar (backend) · **Consumer:** Moyeon (frontend)
**Base URL (local):** `http://localhost:3000` · **Mock server:** `npm run mock` → same routes, no backend needed

This is the authoritative description of the API the UI is built against. Where
it disagrees with `docs/api.md`, this file wins.

---

## 1. Connecting

```env
# frontend/.env
VITE_BACKEND_URL=http://localhost:3000
```

The backend allows `http://localhost:5173` by default (`CORS_ALLOWED_ORIGINS`).
A request from an origin outside that list is rejected with **403**
`CORS_FORBIDDEN`.

Offline UI work without the backend:

```bash
npm run mock     # serves every endpoint below from mocks/*.json on :3000
```

---

## 2. Error envelope

Every non-2xx response uses exactly this shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "human readable" } }
```

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Malformed request |
| `INVALID_FILE_TYPE` | 400 | Upload was not `application/pdf` |
| `UNAUTHORIZED` | 401 | Webhook secret missing or wrong |
| `NOT_FOUND` | 404 | No such document / route / results file |
| `FORBIDDEN` | 403 | Origin not allowed by CORS |
| `CONFLICT` | 409 | Document is still `processing` |
| `PAYLOAD_TOO_LARGE` | 413 | Upload exceeded 20 MB |
| `SERVICE_UNAVAILABLE` | 503 | MongoDB unreachable, or webhook unconfigured |
| `TOO_MANY_REQUESTS` | 429 | 100 requests/minute per IP |
| `INTERNAL_ERROR` | 500 | Unexpected (details are logged, not returned) |

---

## 3. Document status state machine

```
                    ┌──────────────────────────────────────┐
   upload           │                                      │
      │             ▼                                      │
      └──► processing ────┬── any high-severity issue ──► rejected
                          ├── medium issue, OR low
                          │   confidence, OR unknown
                          │   supplier, OR total ≥ 5000 ─► needs_review
                          └── everything clean ───────────► auto_approved

   approved_by_human ◄── human "approve" on a document that carries issues
```

| Status | Meaning |
|---|---|
| `processing` | Queued or running. **Poll this.** |
| `auto_approved` | Passed every rule and threshold |
| `needs_review` | Flagged; a human should look |
| `rejected` | Blocked automatically (high severity, duplicate, or bank change) |
| `approved_by_human` | A human explicitly approved a flagged document |

A terminal status is one of the last four. Poll `GET /api/documents/:id`
every **2 s** while `status === "processing"`.

---

## 4. Endpoints

### `POST /api/documents` → `202`

`multipart/form-data`

| Field | Type | Notes |
|---|---|---|
| `file` | PDF | **Required.** `application/pdf` only, 20 MB max |
| `language` | enum | Optional, default `en`. One of `en fr de es zh ar it pt nl` |
| `type` | enum | Optional, default `invoice`. `invoice` or `delivery_note` |

```json
{ "id": "doc-a1b2c3d4e5f6", "status": "processing" }
```

### `GET /api/documents` → `200`

Query: `status` (optional filter), `limit` (1–100, default 20),
`cursor` (opaque, from a previous `nextCursor`).

```json
{
  "documents": [
    {
      "id": "doc-a1b2c3d4e5f6",
      "fileName": "invoice.pdf",
      "uploadedAt": "2026-10-14T07:00:00.000Z",
      "supplierName": "Alpha Supplies",
      "language": "en",
      "type": "invoice",
      "status": "auto_approved"
    }
  ],
  "nextCursor": "MjAyNi0xMC0xNFQwNzowMDowMC4wMDBafGRvYy0xMg=="
}
```

`nextCursor` is `null` on the last page. Pass it back verbatim as `cursor`.

### `GET /api/documents/:id` → `200`

```json
{
  "id": "doc-a1b2c3d4e5f6",
  "fileName": "invoice.pdf",
  "uploadedAt": "2026-10-14T07:00:00.000Z",
  "supplierName": "Alpha Supplies",
  "language": "en",
  "type": "invoice",
  "status": "needs_review",
  "extracted": {
    "invoiceNumber": "INV-1001",
    "date": "2026-09-30",
    "currency": "USD",
    "poNumber": "PO-2001",
    "lines": [
      { "description": "Screwdriver", "qty": 20, "unitPrice": 5, "lineTotal": 100 }
    ],
    "subtotal": 220,
    "tax": 22,
    "total": 242,
    "bankAccount": "****2333"
  },
  "bankAccountMasked": true,
  "confidence": { "invoiceNumber": 0.99, "total": 0.99 },
  "issues": [
    {
      "type": "TOTAL_MISMATCH",
      "severity": "high",
      "field": "subtotal",
      "message": "Subtotal (220) does not match the sum of line items (215)"
    }
  ],
  "ruleExplanation": "machine-derived justification, never overwritten",
  "explanation": "human-readable text; may be LLM-enriched",
  "supplierReplyDraft": "Dear Alpha Supplies, ...",
  "redactedFileUrl": "https://...",
  "timing": { "totalMs": 1350, "modelMs": 420 },
  "costEstimate": null,
  "auditLog": [
    { "action": "approve", "note": "checked against delivery note", "timestamp": "2026-10-14T07:05:00.000Z" }
  ],
  "createdAt": "2026-10-14T07:00:00.000Z",
  "updatedAt": "2026-10-14T07:00:02.000Z"
}
```

Notes:
- `extracted` is **`null`** while `status === "processing"`. Render a loading
  state rather than assuming the object exists.
- `bankAccount` is **always masked** as `****NNNN`. Do not expect a full account.
- `ruleExplanation` is the deterministic rules output. `explanation` may be
  LLM-generated prose; prefer `ruleExplanation` when showing *why* a document was
  rejected.
- Internal fields are **not** returned: `rawEvolusPayload`, `finalizing`,
  `redactionError`.

### `POST /api/documents/:id/decision` → `200`

```json
{ "action": "approve" | "reject" | "ask_supplier", "note": "optional, max 2000 chars" }
```

Returns the document summary plus `note` and the full `auditLog`.
Returns **409** if the document is still `processing`.

### `GET /api/orders` → `200`

```json
[{ "poNumber": "PO-2001", "supplierName": "Alpha Supplies", "total": 242 }]
```

Falls back to a built-in list when MongoDB is unreachable.

### `GET /api/metrics` → `200`

```json
{
  "countsByStatus": { "processing": 0, "auto_approved": 0, "needs_review": 0, "rejected": 0, "approved_by_human": 0 },
  "averageTotalMs": 1350,
  "averageModelMs": 420,
  "fieldAccuracy": null,
  "errorCatchRate": null,
  "falseAlarmRate": null,
  "minutesSavedPerDoc": null,
  "gpu": { "name": "...", "model": "...", "tokensPerSecond": null, "requestsPerMinute": null },
  "costPerDocument": null
}
```

`countsByStatus`, `averageTotalMs` and `averageModelMs` are measured.
The remaining fields are **`null` until an evaluation run exists** — they are
no longer hard-coded demo numbers. Render them as "not measured yet", not `0`.

### `GET /api/export/results` → `200` / `404`

Batch results from `npm run batch`, with an `eval` key when `npm run eval` has
been run. **404 until then** — that is expected, not an error to alert on.

### `GET /api/health` → `200`

`{ "status": "ok", "timestamp": "..." }`. Liveness only; does not probe MongoDB.

### `POST /api/webhooks/evolus`

Called by Evolus, **not** by the frontend. Requires the `x-webhook-secret`
header; returns 503 if the server has no secret configured.

---

## 5. Issue types the UI should render

| `type` | Severity | Badge colour |
|---|---|---|
| `TOTAL_MISMATCH` | high | red |
| `DUPLICATE_INVOICE` | high | red |
| `BANK_DETAILS_CHANGED` | high | red |
| `PRICE_MISMATCH` | medium | amber |
| `QTY_MISMATCH` | medium | amber |
| `MISSING_PO` | medium | amber |
| `UNKNOWN_SUPPLIER` | medium | amber |
| `LOW_CONFIDENCE` | low | grey |

---

## 6. Demo scenarios and their expected outcomes

Driven by `backend/seed/*.json`. `backend/tests/scenarios.test.js` asserts each
of these, so they cannot silently drift.

| Mock file | Status | Trigger |
|---|---|---|
| `document.clean_auto_approved.json` | `auto_approved` | Everything matches |
| `document.price_mismatch.json` | `needs_review` | Unit price ≠ PO |
| `document.qty_mismatch.json` | `needs_review` | Quantity ≠ PO |
| `document.low_confidence.json` | `needs_review` | Field confidence < 0.90 |
| `document.total_mismatch.json` | `rejected` | Total ≠ PO total (high) |
| `document.duplicate_invoice.json` | `rejected` | Invoice number already seen |
| `document.bank_changed.json` | `rejected` | Bank account ≠ master record |

Load these directly in the UI to develop the list and detail screens without
running the backend.