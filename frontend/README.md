# Supplier Document Desk — Frontend

> **Owner:** Moyeon  
> React + Vite + Tailwind CSS  
> AMD Hackathon ACT III — Team Code Voyagers

## Quick start

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

By default the app runs with **mock data** (no backend needed).  
Set `VITE_USE_MOCK=false` in `.env` and run the backend to switch to live data.

## Pages

| Route | Page | Task |
|---|---|---|
| `/` | Dashboard | F2 — counts, recent docs |
| `/upload` | Upload | F3 — drag-drop + live progress |
| `/documents/:id` | Document Detail | F4 — main demo screen |
| `/review` | Review Queue | F5 — human handoff |
| `/metrics` | Metrics / AMD | F6 — GPU numbers |

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `VITE_USE_MOCK` | `true` | Use local mock data instead of backend |
| `VITE_API_URL` | `/api` | Backend base URL (uses Vite proxy by default) |

## Demo scenarios (mock mode)

Navigate directly to these URLs to demo each scenario:

| URL | Scenario |
|---|---|
| `/documents/doc-clean-001` | Auto-approved invoice ✅ |
| `/documents/doc-price-mismatch` | Price mismatch 🟡 |
| `/documents/doc-qty-mismatch` | Quantity mismatch 🟡 |
| `/documents/doc-total-mismatch` | Italian invoice, wrong total 🔴 |
| `/documents/doc-duplicate-invoice` | Duplicate invoice 🔴 |
| `/documents/doc-bank-changed-001` | Bank details changed 🔴 |
| `/documents/doc-low-confidence` | Blurry scan, low confidence 🟡 |

## Build for production

```bash
npm run build      # outputs to dist/
npm run preview    # serves the built app
```

## Docker

```bash
# from repo root
docker compose up frontend
```

Or standalone:
```bash
docker build -t sdd-frontend --build-arg VITE_USE_MOCK=false .
docker run -p 80:80 sdd-frontend
```
