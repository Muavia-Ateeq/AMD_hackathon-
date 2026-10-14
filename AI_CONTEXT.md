# AI_CONTEXT.md

<!-- Header comment: this file defines the constitutional governance for the project. Owned by Ammar -->

## Project Identity
- **Name**: Supplier Document Desk
- **Type**: Backend service / API (Node.js, Express)
- **Scope**: Extract, validate, and process supplier invoices & delivery notes.
- **Core Purpose**: Provide AI‑assisted, verifiable document validation and automated supplier communication.

## Tech Stack
- **Node.js 20** – Server runtime (LTS, AMD‑compatible).
- **Express** – HTTP framework.
- **MongoDB + Mongoose** – Persistent storage.
- **Zod** – Schema validation.
- **Multer** – File uploads.
- **Axios** – HTTP client for Evolus and vLLM.
- **Pino** – Structured logging (all logging goes through `src/utils/logger.js`).
- **express-rate-limit** – Per‑IP rate limiting on `/api`.
- **Jest** – Testing.
- **dotenv** – Config management.
- **Docker** – Containerization.
- **vLLM (ROCm)** – Open‑model inference endpoint.
- **Evolus REST API** – Document extraction & AI tools.
- **Rationale**: All chosen for open‑source friendliness, AMD GPU support, and proven production stability.

## Architecture
- **Directory hierarchy** follows Clean Architecture / MVC separation (see repo tree).
- **Layers**: `src/routes → src/controllers → src/services → src/models`.
- **Exception**: the vLLM client lives in `src/clients/llmClient.js`, not `src/services/`, so it is not confused with the internal services.
- **Boundaries**: Services encapsulate external calls (Evolus, vLLM). Controllers only orchestrate request/response.
- **Rules engine** (`src/rules/`) is pure and dependency‑free: no I/O, no database, no network. It is the single authority for every numeric and policy decision.
- **Reference documentation**: `CONTRACT.md` is the authoritative API contract. Where it disagrees with `docs/api.md`, `CONTRACT.md` wins.

## Design Tokens
*(UI‑related; kept for completeness – frontend owns these)*
- **Colors**: Primary #0066FF, Secondary #00CC66, Background #F5F5F5 (light) / #1A1A1A (dark).
- **Typography**: System font stack, base size 14px.
- **Spacing**: 4‑8‑12‑16‑24 grid.

## Strict Rules
### NEVER
- Use undocumented dependencies.
- Mutate files without an approved plan.
- Introduce hard‑coded secrets or credentials.
- Change the `Document` data contract without notifying Ammar & Moyeon.
- Skip confidence thresholds.
- Report a metric that has not been measured. Unmeasured values are `null`, never a placeholder number.
- Let the LLM decide a status, an amount or a tolerance. It writes prose only.
- Add a JSON file containing `//` comments. Every fixture is strict JSON, enforced by `tests/fixtures.test.js`.

### ALWAYS
- Validate all inputs with Zod schemas.
- Log every external request and response.
- Return errors in `{ error: { code, message } }` shape.
- Keep numeric logic out of LLM prompts – compute in code.
- Update `.env.example` for any new environment variable.
- Run `npm test` before committing. 79 tests across 5 suites, no external services required.

## Model & Tool Strategy
- **Primary model**: Open‑source model served via vLLM (AMD Cloud).
- **Fallback**: If vLLM fails, route to a secondary OpenAI‑compatible endpoint.
- **Tool boundaries**: LLM only generates natural‑language explanations; all calculations, PO matching, and issue detection happen in backend code.

## i18n & Localization
- **Supported languages**: English, French, German, Spanish, Chinese, Arabic.
- **Scripts**: Latin, Cyrillic, Arabic (RTL), Han.
- **Directionality**: LTR default, RTL for Arabic.

## Global Authenticity Rule
- Every technical claim must be verifiable with a citation (DOI, arXiv ID, official docs). No hallucinated APIs or dummy fallbacks.

## Mandatory Planning Governance
- **Never** edit/create/delete files without first presenting a detailed implementation plan and receiving explicit user approval.

## Session Boot Sequences
- **Full Boot**: "Read AI_CONTEXT.md, PROJECT_ROADMAP.md, and SYSTEM_LEDGER.md. Confirm understanding before proceeding."
- **Quick Boot**: "Read AI_CONTEXT.md and SYSTEM_LEDGER.md, then resume work."

## Session Close‑Out Procedure
- **Close‑Out**: "Update PROJECT_ROADMAP.md and SYSTEM_LEDGER.md with completed tasks, new files, and metrics before ending the session."
