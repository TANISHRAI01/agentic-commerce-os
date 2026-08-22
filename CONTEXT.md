# Agentic Commerce OS — Agent Context (READ THIS FIRST)

> **This file is the single source of truth for any agent resuming work on this project.**
> Read this file BEFORE reading any other file. It tells you what's done, what's next,
> and where to find everything.

---

## Project

- **Name:** Agentic Commerce OS
- **Hackathon:** Razorpay AI Buildathon 2026 · Track 01
- **Repo:** https://github.com/TANISHRAI01/agentic-commerce-os.git
- **Stack:** Next.js 14 + TypeScript + SQLite + Google Gemini + Razorpay (TEST MODE)

---

## Current Status

| Phase | Status |
|-------|--------|
| 0 — Architecture & Docs | ✅ Complete (`phase-0` tag) |
| 1 — Foundation | 🔲 Not Started |
| 2 — AI Buyer | 🔲 Not Started |
| 3 — Policy + Approval | 🔲 Not Started |
| 4 — Razorpay Payment | 🔲 Not Started |
| 5 — Failure Handling | 🔲 Not Started |
| 6 — Audit + Premium UX | 🔲 Not Started |
| 7–9 — Stretch | 🔲 Not Started (only after 1–6 stable) |

**Last completed phase:** 0
**Next phase to build:** 1 — Foundation

---

## What's Been Built

- Project scaffold: `.gitignore`, `.env.example`, `README.md`
- All four living documents (see below)
- No application code yet — no `package.json`, no `src/`, no database

---

## What To Do Next

**Phase 1 — Foundation:**
1. Initialize Next.js 14 project with TypeScript
2. Install dependencies: `better-sqlite3`, `@google/generative-ai`, `razorpay`, `vitest`
3. Create SQLite database schema (products, merchants, transactions, audit_events, metrics)
4. Create synthetic product catalog (50+ products, 5+ merchants)
5. Define TypeScript types for all core models
6. Create basic API route stubs
7. Build basic UI shell (chat interface layout)
8. Write seed script + DB tests
9. Tag `phase-1`

---

## Key Architecture Rules (Do NOT Violate)

1. **AI recommends, deterministic code authorizes** — LLM never decides if money moves
2. **Razorpay TEST MODE only** — never use real credentials
3. **Polling over webhooks** for payment verification
4. **SQLite only** — no external database server
5. **Structured LLM output** — JSON schema → validation → then act
6. **Phase gating** — never start stretch phases until 1–6 are stable

---

## Document Map

| File | Purpose | When To Read |
|------|---------|-------------|
| `CONTEXT.md` (this file) | Quick resume for any agent | **Always read first** |
| `docs/PROJECT_PLAN.md` | Detailed phase plan + deliverables | When starting a new phase |
| `docs/ARCHITECTURE.md` | System design, data models, state machine, DB schema | When writing code |
| `docs/AGENT_HANDOFF.md` | Decisions, assumptions, risks, handoff details | When confused about a past decision |
| `docs/DECISIONS.md` | Engineering decision log with rationale | When asked "why X over Y?" |
| `README.md` | Project overview + quick start | For repo visitors |

---

## Important Decisions Summary

- Next.js monolith (not separate frontend + backend)
- Deterministic Policy Engine (not LLM-based)
- Status polling (not webhooks) for payment verification
- SQLite (not PostgreSQL/MongoDB)
- Vitest (not Jest)
- Vanilla CSS (not Tailwind)
- Google Gemini (not OpenAI/Anthropic)
- Idempotency keys for duplicate payment prevention
- Transaction state machine (not boolean flags)

---

## Credentials Needed (in `.env`)

- `RAZORPAY_KEY_ID` — Razorpay test key ID
- `RAZORPAY_KEY_SECRET` — Razorpay test key secret
- `GEMINI_API_KEY` — Google Gemini API key

---

*Last updated: Phase 0 completion*
*Update this file at the end of every phase.*
