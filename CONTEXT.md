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
| 2 — AI Buyer | ✅ Complete (`v0.2-ai-buyer` tag) |
| 3 — Policy + Approval | ✅ Complete |
| 4 — Razorpay Payment | 🔲 Not Started |
| 5 — Failure Handling | 🔲 Not Started |
| 6 — Audit + Premium UX | 🔲 Not Started |
| 7–9 — Stretch | 🔲 Not Started (only after 1–6 stable) |

**Last completed phase:** 3
**Next phase to build:** 4 — Razorpay Payment

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

### Phase 2 — AI Buyer
- **LLM Service** (`src/services/llm.ts`): Google Gemini abstraction with structured output generation, JSON extraction (strips code fences), Zod schema validation, retry logic (2 retries), custom error classes
- **Discovery Agent** (`src/agents/discovery.ts`): Natural language → structured intent parsing via Gemini. ParsedIntentSchema with category, price range, delivery deadline, required/preferred attributes, exclusions, brand, quantity, ambiguity questions. Maps intent to CatalogSearchParams for deterministic search
- **Decision Agent** (`src/agents/decision.ts`): Product ranking with explainability. Receives real catalog candidates only, ranks by price fit, delivery, rating, attributes, merchant trust. Post-validates all product IDs (prevents hallucination). Returns structured reasons + alternatives with explanations
- **API Routes**: Intent route (LLM-powered parsing + transaction creation), Decide route (LLM-powered ranking + product validation), Unified `/api/shop` route (orchestrates full pipeline: intent → search → rank in one call, with search relaxation)
- **UI**: Conversational shopping interface with chat history, ProductCard component (trust badges, star ratings, delivery, stock, tags), RankingExplanation component (confidence ring, reason chips, expandable alternatives), LoadingState (step-by-step progress, shimmer skeletons), ChatMessage (user/AI/error variants), error/retry handling
- **Types**: `ParsedIntentSchema` (intent.ts), `RankingResultSchema` (ranking.ts) — full Zod schemas for all LLM output
- **Tests**: 53 new tests across 4 suites (llm-service, discovery, decision, evaluation). Total: 153 tests passing
- **Safety**: LLM only discovers and recommends. No payments, no price modification, no inventory invention. All LLM output schema-validated. Hallucinated product IDs rejected

---

## What To Do Next

### Phase 3 — Policy + Approval ✅ Complete
See `docs/AGENT_HANDOFF.md` for full details.

**Phase 4 — Razorpay Payment (Next):**
1. Install `razorpay` npm package + add `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` to `.env`
2. Implement `POST /api/checkout` — create Razorpay order server-side, store `razorpayOrderId` on transaction
3. Add Razorpay Standard Checkout on the frontend (after APPROVED or AUTO_APPROVED state)
4. Implement `POST /api/payment/verify` — verify HMAC signature server-side
5. Implement `GET /api/payment/status` — poll Razorpay for payment status
6. Handle `PAYMENT_SUCCESS` / `PAYMENT_FAILED` / `PAYMENT_TIMEOUT` → `VERIFIED` / `COMPLETED`
7. Tag `phase-4`

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
- Unified `/api/shop` endpoint (not multi-step client calls)
- Candidate-only ranking (LLM never sees full catalog, only filtered results)
- Mocked LLM for tests (no API key needed to run tests)
- `gemini-1.5-flash` model (fast, cheap, sufficient for structured extraction)

---

## Credentials Needed (in `.env`)

- `RAZORPAY_KEY_ID` — Razorpay test key ID
- `RAZORPAY_KEY_SECRET` — Razorpay test key secret
- `GEMINI_API_KEY` — Google Gemini API key

---

## Quick Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm test         # Run all tests (153 passing)
npm run seed     # Seed the database with 60 products
npm run build    # Build for production
```

---

*Last updated: Phase 3 completion*
*Update this file at the end of every phase.*
