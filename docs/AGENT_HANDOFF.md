# Agentic Commerce OS — Agent Handoff

> **What exists, what was decided, what remains, assumptions, and risks.**
>
> Updated at: Phase 2 completion.

---

## Current State

### What Exists

- **Full Next.js 14 project** with TypeScript, running on `npm run dev`
- **SQLite database** via sql.js (pure JS) with 5 tables, indexes, FK constraints
- **60-product synthetic catalog** across 8 categories from 6 merchants
- **Zod schemas** with runtime validation for all core models
- **Transaction state machine** with 17 states and validated transitions
- **Transaction service** with CRUD + state machine + auto-audit
- **Audit system** with append-only events, retrieval, and timeline builder
- **LLM Service** (`src/services/llm.ts`) — Gemini abstraction with structured output, JSON extraction, Zod validation, retry logic
- **Discovery Agent** (`src/agents/discovery.ts`) — Natural language → structured intent (ParsedIntentSchema)
- **Decision Agent** (`src/agents/decision.ts`) — Product ranking with explainability, hallucination prevention
- **10 API routes** — intent, discover, decide, shop (unified pipeline), policy, approve, checkout, payment/verify, payment/status, audit
- **Conversational UI** — Chat interface with product cards, ranking explanation, loading/error states
- **153 passing tests** across 8 test suites

### What Does NOT Exist Yet

- Policy Engine implementation
- Approval flow
- Razorpay payment integration
- Payment failure/timeout handling
- Idempotency manager
- Metrics tracking
- Demo mode (seeded/deterministic responses)
- Premium UI polish (advanced animations)

---

## Key Decisions Made (Phase 0 + 1 + 2)

| Decision | Rationale |
|----------|-----------|
| **sql.js** over better-sqlite3 | better-sqlite3 requires Visual Studio C++ build tools (node-gyp) which weren't available on the dev machine. sql.js is pure JS, zero native compilation |
| **Zod** for schema validation | Runtime validation catches bad data before it hits the DB. Type inference from schemas eliminates type duplication |
| **60 products, 6 merchants** | Enough variety for realistic demo (8 categories), not so many that seed is slow |
| **Seed script** runs on demand | Database is created on first API request; seed is separate to keep startup fast |
| **Unified `/api/shop` endpoint** | Single call orchestrates intent → search → rank. Simpler frontend code, fewer network round-trips. Individual endpoints (intent, discover, decide) still available for testing |
| **Candidate-only ranking** | LLM only sees filtered catalog results, never the full catalog. Prevents hallucination of products outside the search results |
| **Post-validation of product IDs** | After LLM returns a ranking, we verify every product ID exists in the candidate list AND in the database. Double safety net |
| **Mocked LLM for tests** | Tests validate schemas and logic deterministically without API calls. No GEMINI_API_KEY needed to run tests |
| **`gemini-1.5-flash`** | Fast inference, low cost, sufficient for structured extraction. Can be swapped via the LLM service |
| **Search relaxation** | If strict filters return no products, the `/api/shop` route progressively relaxes constraints (remove tags, then price limit) to provide results |
| Other decisions from Phase 0–1 carry forward | See `docs/DECISIONS.md` |

---

## What Remains (By Phase)

### Phase 3 — Policy + Approval
- Policy Engine (pure function, no LLM)
- Approval flow (frontend dialog + backend state)
- Policy UI components

### Phase 4 — Razorpay Payment
- Razorpay SDK setup
- Order creation
- Standard Checkout
- Signature verification
- Status polling

### Phase 5 — Failure Handling
- Timeout simulation
- Idempotency manager
- Duplicate prevention
- Safe recovery flow

### Phase 6 — Audit + Premium UX
- Audit timeline component
- Metrics dashboard
- Seeded demo mode
- Visual polish + animations

---

## Important Assumptions

1. **sql.js works for all phases** — no need to switch back to better-sqlite3
2. **Gemini free tier** is sufficient for development
3. **Single user** — no auth, no multi-tenancy
4. **Catalog is static** — products don't change during a demo session
5. **Tests run fast** — 153 tests in ~1 second
6. **LLM output is always JSON** — gemini-1.5-flash reliably produces structured output with low temperature

---

## Known Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| sql.js performance vs better-sqlite3 | Low | Single-user demo, small dataset |
| Gemini API latency | Medium | Demo mode with seeded responses (Phase 6) |
| Gemini output non-determinism | Medium | Low temperature (0.1), schema validation, retry on malformed |
| Razorpay test-mode quirks | Medium | Early integration in Phase 4 |
| Time pressure | High | Strict phase gating, 100% test pass before next phase |

---

## Phase Review — Security & Architecture Audit

*Completed at the end of Phase 2*

### What Was Reviewed
1. Architecture constraints & money movement safety
2. Transaction state transitions and input validation (Zod)
3. Security vulnerabilities (SQL Injection check in `src/services/catalog.ts`)
4. Idempotency and duplicate payment prevention
5. Error handling, LLM validation, and audit log accuracy
6. 153 unit tests
7. Unnecessary abstractions (none found)
8. Frontend vs Backend boundaries

### Issues Found & Fixes Made
1. **Issue (Idempotency):** `createTransaction` in `transaction.ts` did not check if the `idempotencyKey` already existed before attempting an insert, which caused a 500 SQLite constraint error instead of gracefully returning the existing transaction.
   **Fix:** Updated `createTransaction` to explicitly query by `idempotencyKey` and return the existing transaction if found.
2. **Issue (LLM API & Validation):** Discovered that `gemini-1.5-flash` is unavailable/deprecated for newer keys, and that `gemini-3.5-flash` occasionally outputs `null` for optional fields, breaking Zod schema validation.
   **Fix:** Updated the model in `src/services/llm.ts` to `gemini-3.5-flash` and modified `ParsedIntentSchema` in `src/types/intent.ts` to use `.nullish().transform(v => v ?? undefined)` for graceful null handling.

### Security & Architecture Verification
- **AI boundary maintained:** LLM parses intents and ranks products but cannot create payments, modify prices, bypass policies, or invent inventory.
- **Structured output only:** All LLM responses validated against Zod schemas.
- **Hallucination prevention:** Post-validation checks all product IDs in ranking output against the candidate list.
- **State Machine enforced:** Cannot bypass `POLICY_PENDING` to reach `PAYMENT_PENDING`.
- **API error handling:** Distinct error types for validation errors (422), connection errors (503), and server errors (500).

### Remaining Risks
- **Frontend Idempotency:** The UI doesn't actively send idempotency keys yet (can be done in later phases when payments are implemented).
- **Phase 3 Authorization:** Backend authorization logic (Policy Engine) is currently unbuilt as it belongs to Phase 3.

### Current Stable Functionality
User types a natural-language shopping query → Discovery Agent parses it into structured intent → Catalog service searches with deterministic filters → Decision Agent ranks real products with explanations → UI displays product cards with reasons and alternatives. 153/153 tests passing.

### Recommended Next Phase
Proceed to **Phase 3 — Policy + Approval** (deterministic policy engine, approval flow, UI).

---

## Handoff Instructions

1. Read `CONTEXT.md` first
2. `npm install` → `npm test` (should show 153 passing)
3. `npm run seed` → creates `data/commerce.db`
4. Set `GEMINI_API_KEY` in `.env` (required for live AI features)
5. `npm run dev` → opens http://localhost:3000
6. Do not redesign architecture — extend `docs/ARCHITECTURE.md`
7. Follow phase order strictly
