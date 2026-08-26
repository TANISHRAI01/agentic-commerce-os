# Agentic Commerce OS — Project Plan

> **Razorpay AI Buildathon 2026 · Track 01 — AI Growth & Agentic Commerce**
>
> *From "AI that actually recommends" to "AI that actually buys."*

---

## Phase Status

| Phase | Name | Status | Tag | Notes |
|-------|------|--------|-----|-------|
| 0 | Architecture & Documentation | ✅ Complete | `phase-0` | All living docs created, architecture designed |
| 1 | Foundation | ✅ Complete | `phase-1` | 100 tests passing, 60 products, 6 merchants, state machine, audit system |
| 2 | AI Buyer | ✅ Complete | `phase-2` | Discovery + Decision agents, Gemini LLM, 153 tests passing |
| 3 | Policy + Approval | ✅ Complete | `phase-3` | Deterministic policy engine, approval flow |
| 4 | Razorpay Payment | ✅ Complete | `phase-4` | Server-side Razorpay, HMAC verification, 222 tests passing |
| 5 | Failure Handling | 🔲 Not Started | — | Timeout, safe recovery, idempotency |
| 6 | Audit + Premium UX | 🔲 Not Started | — | Audit timeline, metrics, demo mode, polish |
| 7 | AI-readable Catalog | 🔲 Stretch | — | Structured catalog intelligence |
| 8 | Merchant Agent + Growth | 🔲 Stretch | — | Upsell/cross-sell, merchant agent |
| 9 | Agent-to-Agent Commerce | 🔲 Stretch | — | Buyer ↔ merchant negotiation |

---

## Phase Details

### Phase 0 — Architecture & Documentation ✅

**Deliverables:**
- [x] Repository inspected (empty greenfield)
- [x] Tech stack chosen and documented
- [x] Folder structure designed
- [x] Core data models defined
- [x] Payment state machine designed
- [x] Policy model defined
- [x] All four living documents created
- [x] `.gitignore`, `.env.example`, `README.md` created
- [x] Initial commit + `phase-0` tag

---

### Phase 1 — Foundation ✅

**Goal:** Working project scaffold with database, seed data, type system, and basic API routes.

**Deliverables:**
- [x] Next.js 14 project initialized with TypeScript
- [x] SQLite database with schema (sql.js — pure JS, no native deps)
- [x] Synthetic product catalog (60 products, 6 merchants, 8 categories)
- [x] Zod schemas + TypeScript types for all core models (Product, Merchant, User, ShoppingIntent, Cart, Policy, Transaction, Payment, AuditEvent)
- [x] 9 API route stubs (intent, discover, decide, policy, approve, checkout, payment/verify, payment/status, audit)
- [x] Database seed script (`npm run seed`)
- [x] Catalog query service with search, filtering, pagination
- [x] Transaction state machine (17 states, validated transitions)
- [x] Transaction service with CRUD + auto-audit
- [x] Audit system (append-only events, retrieval, timeline builder)
- [x] Basic UI shell (dark theme, chat interface, suggestion chips)
- [x] 100 passing tests (state machine, schemas, catalog, audit)
- [x] `phase-1` tag

**Definition of Done:** ✅ `npm run dev` starts, catalog loads from SQLite, API routes return typed responses, 100/100 tests pass.

---

### Phase 2 — AI Buyer ✅

**Goal:** Natural-language intent parsing, product discovery, and AI-powered ranking.

**Deliverables:**
- [x] LLM provider abstraction (Gemini SDK — `src/services/llm.ts`)
- [x] Discovery Agent: intent → structured query → catalog search (`src/agents/discovery.ts`)
- [x] Decision Agent: candidates → ranked recommendations with explanations (`src/agents/decision.ts`)
- [x] Intent parsing with JSON schema validation (`ParsedIntentSchema`, `RankingResultSchema`)
- [x] Product search with filtering (category, price, delivery, rating) — existing from Phase 1
- [x] UI: conversational chat, product cards, ranking explanation, loading/error states
- [x] Tests: 53 new tests (LLM, discovery, decision, evaluation) — 153 total
- [ ] `phase-2` tag

**Definition of Done:** ✅ User types shopping intent → system returns ranked products with explanations.

---

### Phase 3 — Policy + Approval ✅

**Goal:** Deterministic financial guardrails and human-in-the-loop approval.

**Deliverables:**
- [x] Policy Engine: budget check, agent spending limit, merchant trust tier
- [x] Approval flow: auto-approve below threshold, require human above
- [x] Policy result UI (pass/fail badges with reasons)
- [x] Approval dialog UI
- [x] Transaction state machine (initiated → policy → approval → ready)
- [x] Tests: all policy check combinations, edge cases (38 tests)
- [x] `phase-3` tag

**Definition of Done:** ✅ Policy engine blocks overspend, explains why, approval dialog works.

---

### Phase 4 — Razorpay Payment ✅

**Goal:** End-to-end Razorpay test-mode payment flow.

**Deliverables:**
- [x] Razorpay SDK integration (test mode only)
- [x] Order creation API (`POST /api/checkout` with 8 security guards)
- [x] Razorpay Standard Checkout (frontend `CheckoutButton.tsx`)
- [x] Payment status polling (`GET /api/payment/status`)
- [x] Payment verification (server-side HMAC-SHA256, `POST /api/payment/verify`)
- [x] Transaction state: APPROVED → PAYMENT_PENDING → PAYMENT_SUCCESS → VERIFIED → COMPLETED
- [x] Tests: 31 new tests (HMAC verification, security guards, state flow)
- [x] `phase-4` tag

**Definition of Done:** ✅ Full payment flow works with Razorpay test credentials. Money does not move.

---

### Phase 5 — Failure Handling

**Goal:** Safe payment failure recovery and duplicate prevention.

**Deliverables:**
- [ ] Payment timeout simulation
- [ ] PENDING_VERIFICATION state with safe polling
- [ ] Idempotency key system (prevent duplicate orders)
- [ ] Duplicate payment detection
- [ ] Safe retry logic (verify-before-retry)
- [ ] UI: pending state, safe recovery messaging
- [ ] Tests: timeout recovery, idempotency, duplicate prevention
- [ ] `phase-5` tag

**Definition of Done:** Timeout → verify → safe continue. No duplicate charges. Audit trail shows recovery.

---

### Phase 7: AI-Readable Merchant Layer
**Status:** Completed
**Goal:** Make merchants directly legible to AI buyers.

**Tasks:**
- [x] **Merchant Model**: Create profiles with trust tier, policies, delivery regions, payment capabilities, business rules.
- [x] **Product Schema**: Add availability, offer eligibility, inventory.
- [x] **Merchant API**: Build `/api/merchants` structured REST endpoints.
- [x] **Buyer Integration**: Enhance Discovery/Decision Agents to consider merchant policies, offers, and metadata.

---

### Phase 6 — Audit + Premium UX

**Goal:** Complete audit trail, metrics, demo mode, premium visual polish.

**Deliverables:**
- [ ] Audit timeline UI (structured events → readable timeline)
- [ ] Metrics tracking (intent count, policy results, payment success, timing)
- [ ] Seeded/deterministic demo mode
- [ ] Premium UI polish (glassmorphism, animations, dark mode)
- [ ] Screen recordings: happy path + failure path
- [ ] Full end-to-end demo flow test
- [ ] Tests: audit integrity, demo mode determinism
- [ ] `phase-6` tag

**Definition of Done:** Complete demo flow runs start-to-finish. Recordings captured. UI is polished.

---

### Phases 7–9 — Stretch (Attempt ONLY if Phases 1–6 stable)

**Gate check:** Are Phases 1–6 stable, tested, and demo-ready?

- **Phase 7:** AI-readable catalog with schema extensions, merchant intelligence
- **Phase 8:** Merchant Agent, upsell/cross-sell, campaign recommendations
- **Phase 9:** Buyer ↔ Merchant agent negotiation, multi-merchant comparison

---

## What's Next

**Immediate:** Begin Phase 5 — Failure Handling (timeout, safe recovery, idempotency, verify-before-retry).
