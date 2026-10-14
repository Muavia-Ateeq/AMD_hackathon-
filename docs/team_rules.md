// team_rules.md
# Team Rules

## Branching strategy
- **ammar/** – Backend code, Docker, deployment scripts.
- **muawia/** – vLLM integration, model benchmarks.
- **awais/** – JSON schemas, prompts, knowledge library, handoff policy.
- **moyeon/** – Frontend (React, Vite, Tailwind) – only edits under `frontend/`.

## Merging
- I (Ammar) will merge all branches into `main` each evening before the hackathon deadline.
- Each merge must pass CI (lint, tests) and not introduce secrets.

## Secrets & config
- All secrets live only in `.env` (which is git‑ignored).
- Never commit real keys, passwords, or certificates.
- `.env.example` contains placeholder values for anyone to copy.

## Data contract stability
- The Document schema (fields, enums) is **frozen**.
- Any change must be discussed with **Ammar** and **Moyeon**; otherwise the frontend will break.

## Communication
- Daily stand‑up at 10 am local time on Slack.
- Use GitHub comments for code reviews; keep them short.

*Owned by Ammar*
