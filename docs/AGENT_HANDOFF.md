# Agentic Commerce OS — Agent Handoff

> **What exists, what was decided, what remains, assumptions, and risks.**
>
> Updated at: Phase 3 completion.

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
- **LLM Service** — Gemini abstraction with structured output, JSON extraction, Zod validation, retry logic
- **Discovery Agent** — Natural language → structured intent (ParsedIntentSchema)
- **Decision Agent** — Product ranking with explainability, hallucination prevention (double safety net)
- **Policy Engine** (`src/engine/policy-engine.ts`) — Pure deterministic function, 4 checks, approval threshold
- **10 API routes** — all implemented (policy and approve fully functional; checkout/payment/verify are stubs for Phase 4)
- **PolicyPanel UI** — PASS/FAIL badge per check, approval waiting/granted/rejected states
- **ApprovalDialog UI** — Product summary + policy results + Approve/Reject buttons
- **Conversational UI** — Chat interface with product cards, ranking explanation, policy panel
- **222 passing tests** across 10 test suites

### What Does NOT Exist Yet

- Razorpay payment integration
- Payment failure/timeout handling
- Idempotency manager (Phase 5)
- Metrics tracking
- Demo mode (seeded/deterministic responses)
- Premium UI polish (advanced animations)

---

## Key Decisions Made (Phase 0 + 1 + 2 + 3)

| Decision | Rationale |
|----------|-----------|
| **sql.js** over better-sqlite3 | better-sqlite3 requires Visual Studio C++ build tools (node-gyp) which weren't available on the dev machine. sql.js is pure JS, zero native compilation |
| **Zod** for schema validation | Runtime validation catches bad data before it hits the DB. Type inference from schemas eliminates type duplication |
| **60 products, 6 merchants** | Enough variety for realistic demo (8 categories), not so many that seed is slow |
| **Seed script** runs on demand | Database is created on first API request; seed is separate to keep startup fast |
| **Unified `/api/shop` endpoint** | Single call orchestrates intent → search → rank → **policy**. Simpler frontend code, fewer network round-trips |
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
5. **Tests run fast** — 222 tests in ~1.5 seconds
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
User types a natural-language shopping query → Discovery Agent parses it into structured intent → Catalog service searches with deterministic filters → Decision Agent ranks real products with explanations → **Policy Engine runs deterministic checks** (budget, agent limit, merchant trust, currency) → UI displays product cards with policy panel. If approval is needed, ApprovalDialog appears. If auto-approved, transaction moves to payment-ready state. 191/191 tests passing.

### Phase 3 Review — Security & Architecture (Conducted post-Phase 3)
- **What was reviewed**: Phase 3 implementation, specifically `Policy Engine`, `/api/policy`, `/api/approve`, `state-machine.ts`, and test coverage.
- **Issues found**: None. The implementation correctly adheres to the architecture. Input validation is present, prices are securely fetched from the backend SQLite DB (preventing frontend price spoofing), and state transitions are strictly enforced.
- **Fixes made**: None required.
- **Remaining risks**: Duplicate payments and idempotency are not yet handled. This is expected, as payment logic and failure handling are scoped for Phase 4 and Phase 5 respectively.
- **AI boundary maintained**: Policy Engine is a pure function with zero LLM involvement. `evaluatePolicy()` is deterministic, side-effect free, and Zod-validated.
- **Approval bypass prevention**: `/api/approve` performs triple verification before accepting any decision: (1) transaction exists, (2) state is exactly `APPROVAL_REQUIRED`, (3) `policyResult.overall === PASS` and `requiresApproval === true`.

### Phase 4 Review — Security & Architecture (Conducted post-Phase 4)
- **What was reviewed**: Phase 4 implementation, specifically `Razorpay Service`, `/api/checkout`, `/api/payment/verify`, state transitions, and test coverage.
- **Issues found**: In `/api/checkout`, the idempotency check (Guard 7) returned an existing order ID without first verifying if the transaction had already moved to a terminal or paid state (e.g., `COMPLETED`). This could potentially allow the frontend to retry checkout for an already paid order.
- **Fixes made**: Added a state validation check (Guard 2) before the idempotency return to ensure `txn.state` is either `APPROVED`, `AUTO_APPROVED`, or `PAYMENT_PENDING`. If the state is terminal, it correctly returns a 409 error, preventing duplicate checkout attempts.
- **Remaining risks**: Failure recovery, timeout simulation, and duplicate webhook/polling collisions are not yet fully managed. Scoped for Phase 5.
- **AI boundary maintained**: Razorpay integration is 100% server-side and deterministic. LLMs have zero ability to trigger payment functions.
- **Security verified**: Pricing is strictly sourced from the backend database during checkout. Payment signatures are verified using `crypto.timingSafeEqual` with HMAC-SHA256 to prevent timing attacks and tampering.
- **Current stable functionality**: End-to-end Razorpay Test Mode integration is active. 222/222 tests passing.

### Recommended Next Phase
Proceed to **Phase 5 — Failure Handling** (timeout simulation, verify-before-retry, idempotency keys, duplicate payment detection).

### Phase 5 Review — Security & Architecture (Conducted post-Phase 5)

* **What was reviewed**: The full Phase 5 failure recovery implementation. This includes `PaymentSimulator` (`src/services/payment-simulator.ts`), the verify-before-retry contract in `POST /api/payment/recover`, Guard 2b in `/api/checkout`, `IncidentTimeline.tsx`, `CheckoutButton.tsx` (unknown state handling), and audit event schemas.
* **Issues found**: None. The verify-before-retry architecture is highly restrictive by design.
* **Fixes made**: None required during review. 
* **Remaining risks**: None blocking Phase 6. The UI correctly handles timeout scenarios and duplicate webhooks/callbacks are mitigated by idempotency keys and state checks.
* **Current stable functionality**: Full end-to-end payment lifecycle including failure handling. The system handles happy paths, simulated timeouts recovering to SUCCESS, simulated timeouts recovering to FAILURE, and provider network failures. 238/238 tests passing.
* **Recommended next phase**: Proceed to **Phase 6 — Audit + Premium UX** (audit timeline dashboard, metrics, demo mode, visual polish).

**Concise Engineering Review:**
The Phase 5 implementation accurately matches the intended architecture. There are no security vulnerabilities found; the frontend cannot bypass backend authorization because `/api/checkout` strictly blocks retries (409 Conflict) when a transaction is in `PAYMENT_UNKNOWN` state. The LLM cannot trigger money movement; it is strictly a deterministic state machine flow. Duplicate payments are prevented via state enforcement and idempotency keys. All external inputs are Zod-validated, errors are caught and logged, and audit events accurately reflect the incident timeline. The test suite is meaningful (testing all 9 deterministic recovery branches via a clean abstraction, `PaymentSimulator`), and no dead abstractions exist. The code remains highly maintainable.

### Phase 6 — Audit + Premium UX (Completed)

* **What was built**: DemoPanel with 4 scenario presets, Simple/Technical audit toggle, deterministic policy explanations, section card layout in ChatMessage, premium welcome screen, audit trail auto-expansion on terminal states.
* **No backend changes**: This was a frontend-only phase. All 238 tests pass unchanged.
* **No secrets exposed**: The audit trail shows application events (policy checks, state transitions, Razorpay order IDs). A disclosure line explicitly states no API keys, model prompts, or credentials are displayed.
* **Demo scenarios use real pipeline**: Each scenario button auto-fills a real query that executes against the real LLM, catalog search, policy engine, and Razorpay integration. Nothing is faked.
* **Current stable functionality**: All 6 mandatory phases complete. The system is demo-ready.

### All Mandatory Phases Complete
Phases 1–6 are complete and stable. Phases 7–9 are stretch goals that should only be started if there is time and all current functionality is verified.

---

## Handoff Instructions

1. Read `CONTEXT.md` first
2. `npm install` → `npm test` (should show **238 passing**)
3. `npm run seed` → creates `data/commerce.db`
4. Set `GEMINI_API_KEY` in `.env` (required for live AI features)
5. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env`
6. `npm run dev` → opens http://localhost:3000
7. Use the DemoPanel to run through all 4 scenarios
8. Do not redesign architecture — extend `docs/ARCHITECTURE.md`
9. Follow phase order strictly

