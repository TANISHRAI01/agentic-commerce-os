# Agentic Commerce OS — Agent Handoff

> **What exists, what was decided, what remains, assumptions, and risks.**
>
> Updated at: Phase 7 completion.

---

## Current State

### What Exists

- **Full Next.js 14 project** with TypeScript, running on `npm run dev`
- **SQLite database** via sql.js (pure JS) with 5 tables, indexes, JSON columns, FK constraints
- **60-product synthetic catalog** across 8 categories from 6 merchants
- **Zod schemas** with runtime validation for all core models
- **Transaction state machine** with 17 states and validated transitions
- **Transaction service** with CRUD + state machine + auto-audit
- **Audit system** with append-only events, retrieval, and timeline builder
- **LLM Service** — Gemini abstraction with structured output, JSON extraction, Zod validation, retry logic
- **Discovery Agent** — Natural language → structured intent (ParsedIntentSchema)
- **Decision Agent** — Product ranking with explainability, hallucination prevention (double safety net)
- **Policy Engine** (`src/engine/policy-engine.ts`) — Pure deterministic function, 4 checks, approval threshold
- **15 API routes** — all core payment, policy, transaction, and merchant endpoints implemented
- **PolicyPanel UI** — PASS/FAIL badge per check, approval waiting/granted/rejected states
- **ApprovalDialog UI** — Product summary + policy results + Approve/Reject buttons
- **Conversational UI** — Chat interface with product cards, ranking explanation, policy panel, audit trail
- **DemoPanel** — Fast-forward tests of success, failure, and policy approval flows
- **238 passing tests** across 12 test suites

### What Does NOT Exist Yet

- Stretch goals: Multi-agent negotiation (Phases 8-9)
- Real production database (currently using local SQLite)

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

### Phase 8 — Merchant Agent (Stretch)
- Upsell/cross-sell suggestions
- Campaign recommendations

### Phase 9 — Multi-Agent Negotiation (Stretch)
- Buyer ↔ Merchant negotiation
- Multi-merchant comparison and dynamic pricing

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

### Phase Review — Overall System (Conducted post-Phase 6)

- **What was reviewed**: The complete Agentic Commerce OS implementation (Phases 1-6), focusing on architecture adherence, security boundaries (LLM vs Deterministic), idempotency, TOCTOU race conditions, input validation, secret management, error handling, audit logging, and tests.
- **Issues found**: 
  1. **TOCTOU Race Condition in State Transitions**: `transitionTransaction` updated the database without Optimistic Concurrency Control (OCC). Concurrent requests to `/api/checkout` could fetch the transaction state simultaneously and create duplicate Razorpay orders, violating idempotency.
  2. **Architectural Deviation (Minor)**: The state machine names in the code (e.g., `PAYMENT_PENDING`, `CART_READY`) deviate from the original 19 states outlined in `docs/ARCHITECTURE.md` (e.g., `PAYMENT_INITIATED`, `ORDER_CREATED`).
- **Fixes made**: 
  - Fixed the TOCTOU vulnerability in `src/services/transaction.ts` by adding `AND state = ?` to the SQL `UPDATE` statement and checking `db.getRowsModified() > 0`. This strictly enforces OCC and prevents concurrent state overwrites.
- **Remaining risks**: 
  - The architectural drift in state naming was left unfixed in code because aligning it would require refactoring 20+ files and 238 tests, risking stability. The drift does not affect security or functionality.
- **Current stable functionality**: All 6 mandatory phases are fully complete, stable, and secure. The system correctly isolates LLM decision-making from deterministic policy enforcement and payment execution. Concurrent payment vulnerabilities are mitigated. 238/238 tests pass.
- **Recommended next phase**: Consider aligning the `docs/ARCHITECTURE.md` state machine with the actual codebase in a documentation update, then proceed to stretch goals (Phases 7-9) if desired.

**Concise Engineering Review:**
The system is robust and strictly adheres to the core architectural principles: the LLM recommends, the Policy Engine authorizes, and the state machine enforces. The separation of concerns between AI and deterministic logic is well-maintained, preventing LLMs from triggering money movement. External inputs are validated, secrets are protected server-side, errors are gracefully handled, and the audit trail is accurate. The discovery and resolution of the TOCTOU vulnerability in the state machine ensures that idempotency is strictly enforced even under concurrent load. The test suite is fast, meaningful, and comprehensive. The codebase is highly maintainable, though the documentation for the state machine requires an update to match the current stable implementation.

### Phase 7 Review — Security, Architecture & Polish (Conducted post-Phase 7)

- **What was reviewed**: Phase 7 implementation (AI-Readable Merchant Layer), focusing on the API route integrity, architectural adherence, data validation, idempotency, error handling, and test comprehensiveness against the 14-point audit checklist.
- **Issues found**: 
  1. **Dead/Unnecessary Abstractions**: Leftover API routes (`/api/discover`, `/api/intent`, `/api/decide`) from Phase 2 were found. These were superseded by the unified `/api/shop` route in Phase 3. The `/api/decide` route was also broken due to the `rankProducts` signature change in Phase 7.
  2. **Idempotency Crash in Shop Route**: The `/api/shop` endpoint properly retrieved existing transactions for duplicate idempotency keys, but it failed to check if the state was `CREATED`, blindly passing the existing transaction to `transitionTransaction` and causing a 500 State Machine Error.
- **Fixes made**: 
  - Deleted the dead API routes (`/api/intent`, `/api/discover`, `/api/decide`) to clean up the codebase and reduce the attack surface.
  - Added a state guard in `src/app/api/shop/route.ts` to return a `409 Conflict` if the transaction is already past the `CREATED` state. This prevents the state machine from crashing when receiving a duplicate idempotency key.
- **Remaining risks**:
  - The stretch phases (Phase 8 and 9) are still to be built. 
- **Current stable functionality**: All 7 phases are fully complete and stable. 238/238 tests pass.
- **Recommended next phase**: Proceed to Phase 8 (Merchant Agent) if desired.

**Concise Engineering Review:**
The Phase 7 implementation accurately matches the intended architecture. There are no security vulnerabilities found; the frontend cannot bypass backend authorization, as the Policy Engine remains deterministic and server-side. The LLM cannot trigger money movement; its outputs are strictly validated and only serve to recommend products. Duplicate payments are correctly prevented via state enforcement and idempotency keys, with the newly fixed edge-case in `/api/shop`. All external inputs are validated, secrets are protected, errors are caught, and the audit trail is accurate. No features are falsely presented, dead abstractions have been removed, and the code remains highly maintainable.

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

