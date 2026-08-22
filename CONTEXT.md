# Agentic Commerce OS — Agent Context (READ THIS FIRST)

> **This file is the single source of truth for any agent resuming work on this project.**
> Read this file BEFORE reading any other file. It tells you what's done, what's next,
> and where to find everything.

---

## Project

- **Name:** Agentic Commerce OS
- **Hackathon:** Razorpay AI Buildathon 2026 · Track 01
- **Repo:** https://github.com/TANISHRAI01/agentic-commerce-os.git
- **Stack:** Next.js 14 + TypeScript + SQLite (sql.js) + Google Gemini + Razorpay (TEST MODE)

---

## Current Status

| Phase | Status |
|-------|--------|
| 0 — Architecture & Docs | ✅ Complete (`phase-0` tag) |
| 1 — Foundation | ✅ Complete (`phase-1` tag) |
| 2 — AI Buyer | 🔲 Not Started |
| 3 — Policy + Approval | 🔲 Not Started |
| 4 — Razorpay Payment | 🔲 Not Started |
| 5 — Failure Handling | 🔲 Not Started |
| 6 — Audit + Premium UX | 🔲 Not Started |
| 7–9 — Stretch | 🔲 Not Started (only after 1–6 stable) |

**Last completed phase:** 1
**Next phase to build:** 2 — AI Buyer

---

## What's Been Built

### Phase 0
- Project scaffold: `.gitignore`, `.env.example`, `README.md`
- All four living documents

### Phase 1 — Foundation
- **Shared schemas** (Zod): Product, Merchant, User, ShoppingIntent, Cart, Policy, Transaction, Payment, AuditEvent — all with runtime validation
- **Database**: SQLite via sql.js, schema with 5 tables (merchants, products, transactions, audit_events, metrics), indexes, FK constraints
- **Catalog**: 60 products across 8 categories, 6 merchants with varied trust tiers. Search with filtering (category, price, delivery, rating, merchant trust, text query, tags, stock, pagination)
- **Transaction state machine**: 17 states, explicit valid transitions, terminal state detection, StateMachineError
- **Transaction service**: CRUD + state machine integration, auto-audit on every transition
- **Audit system**: Append-only event creation, chronological retrieval, human-readable timeline builder
- **API routes**: 9 routes (intent, discover, decide, policy, approve, checkout, payment/verify, payment/status, audit) — discover and audit are functional, others are stubs for later phases
- **UI shell**: Dark-themed chat interface with suggestion chips, Inter font, glassmorphism design system
- **Tests**: 100 tests passing (state machine, schemas, catalog search, audit events)

---

## What To Do Next

**Phase 2 — AI Buyer:**
1. Install `@google/generative-ai` SDK
2. Create LLM service abstraction (`src/services/llm.ts`)
3. Implement Discovery Agent: natural language → structured intent → catalog query
4. Implement Decision Agent: product candidates → ranked recommendations with explanations
5. JSON schema validation on all LLM outputs
6. Wire chat UI to the AI pipeline (send intent → show products → show ranking)
7. Add product card and ranking explanation UI components
8. Tests for intent parsing and product ranking logic
9. Tag `phase-2`

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
- **sql.js** (not better-sqlite3) — pure JS, no native compilation needed on Windows
- Vitest (not Jest)
- Vanilla CSS (not Tailwind)
- Google Gemini (not OpenAI/Anthropic)
- Idempotency keys for duplicate payment prevention
- Transaction state machine (not boolean flags)
- Zod for runtime schema validation (not just TypeScript types)

---

## Credentials Needed (in `.env`)

- `RAZORPAY_KEY_ID` — Razorpay test key ID
- `RAZORPAY_KEY_SECRET` — Razorpay test key secret
- `GEMINI_API_KEY` — Google Gemini API key

---

## Quick Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm test         # Run all tests (100 passing)
npm run seed     # Seed the database with 60 products
npm run build    # Build for production
```

---

*Last updated: Phase 1 completion*
*Update this file at the end of every phase.*
