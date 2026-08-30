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
| 5 | Failure Handling | ✅ Complete | `phase-5` | Timeout, safe recovery, idempotency, 238 tests passing |
| 6 | Audit + Premium UX | ✅ Complete | `phase-6` | Audit timeline, metrics, demo mode, polish |
| 7 | AI-readable Catalog | ✅ Complete | `phase-7` | Structured catalog intelligence, merchant APIs |
| 8 | Merchant Agent + Growth | ✅ Complete | `phase-8` | Upsell/cross-sell, merchant agent, growth dashboard, 278 tests passing |
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
- [x] Audit timeline UI (structured events → readable timeline)
- [x] Metrics tracking (intent count, policy results, payment success, timing)
- [x] Seeded/deterministic demo mode
- [x] Premium UI polish (glassmorphism, animations, dark mode)
- [x] Screen recordings: happy path + failure path
- [x] Full end-to-end demo flow test
- [x] Tests: audit integrity, demo mode determinism
- [x] `phase-6` tag

**Definition of Done:** ✅ Complete demo flow runs start-to-finish. UI is polished. 238 tests passing.

---

### Phases 7–9 — Stretch

**Gate check:** ✅ Phases 1–6 are stable, tested, and demo-ready.

- [x] **Phase 7:** AI-readable catalog with schema extensions, merchant intelligence APIs — **COMPLETE**
- [x] **Phase 8:** Merchant Agent, upsell/cross-sell, growth dashboard, campaign recommendations — **COMPLETE** (278 tests passing, tagged `v0.8-growth`)
- [x] **Phase 9:** Buyer ↔ Merchant agent negotiation, multi-merchant comparison — **COMPLETE** (289 tests passing)

---

## What's Next

**Current:** All phases (1–10D) complete and stable. Build passing. **375/375 tests green.**

**Next:** Project is complete. All phases delivered.

---

### Phase 10A — Role-Based Authentication & User Profiles ✅

**Goal:** Introduce CUSTOMER and MERCHANT roles with secure local auth, role persistence, and server-enforced authorization.

**Deliverables:**
- [x] `src/types/auth.ts` — Zod schemas: UserRole, AuthUser, CustomerProfile, MerchantProfile, Signup/Login/Session schemas
- [x] `src/db/connection.ts` — Additive migration: `auth_users`, `customer_profiles`, `merchant_profiles` tables
- [x] `src/services/auth.ts` — bcryptjs hashing, JWT session (jsonwebtoken), signupUser, loginUser, profile fetchers
- [x] `POST /api/auth/signup` — Zod-validated, httpOnly JWT cookie
- [x] `POST /api/auth/login` — Validates credentials, sets cookie
- [x] `POST /api/auth/logout` — Clears cookie
- [x] `GET /api/auth/me` — Returns current user + role-specific profile
- [x] `middleware.ts` — Edge middleware (jose) protecting /customer/* and /merchant/*
- [x] `/auth` — Role-selection landing page (glassmorphism, Customer + Merchant cards)
- [x] `/auth/login` — Login page with role toggle
- [x] `/auth/signup` — Signup page with role-specific fields
- [x] `AuthProvider.tsx` — React context + `useAuth()` hook
- [x] 27 new tests — signup, login, JWT, profiles, schema validation
- [x] Zero regression — all 289 Phase 1-9 tests still pass (316 total)

**Definition of Done:** ✅ Customer and merchant can sign up/login. Roles persist in JWT. Route authorization works server-side (middleware). All existing Phase 1-9 functionality intact.

---

### Phase 10B — Customer Dashboard ✅

**Goal:** Build a full-featured customer application shell that integrates and wraps all existing Phase 1–9 AI commerce functionality.

**Deliverables:**
- [x] `src/db/connection.ts` — Additive migration: `user_id TEXT` column on `transactions` + index
- [x] `src/services/transaction.ts` — `userId` param on `createTransaction`; new `getTransactionsByUserId`, `countTransactionsByUserId`, `getTransactionForUser` (ownership-verified)
- [x] `src/app/api/shop/route.ts` — Optional `user_id` stamping from session cookie (backward-compatible, no auth required)
- [x] `GET /api/customer/transactions` — Paginated customer transaction list
- [x] `GET /api/customer/transactions/:id` — Detail + full audit trail, ownership-verified
- [x] `GET /api/customer/stats` — Monthly spend, pending approvals, activity feed
- [x] `PATCH /api/customer/profile` — Update name + spending limits
- [x] `/customer` — Full 6-view customer dashboard:
  - Home: greeting, spending progress bar, stat cards, recent purchases, recent AI activity
  - AI Shop: existing ChatMessage/LoadingState/DemoPanel/CheckoutButton — zero code duplication
  - Purchase History: paginated list + expandable detail with audit timeline + negotiation savings
  - Spending & Limits: editable monthly/agent/approval limits with live progress
  - Activity: chronological audit event feed grouped by date with timeline UI
  - Profile: name editing, role display, logout
- [x] Slide-out sidebar nav, sticky top bar, dark glassmorphism design
- [x] 17 new tests — transaction ownership, pagination, cross-customer access prevention, failed states
- [x] Zero regression — all 316 Phase 1-10A tests still pass (333 total)

**Definition of Done:** ✅ Customer dashboard live at `/customer`. All 6 views work. Existing AI pipeline fully accessible via AI Shop tab. Purchase history scoped to authenticated user. Spending limits editable and enforced.

---

### Phase 10C — Customer Spending & AI Limits ✅

**Goal:** Give customers explicit control over what their AI Buyer is allowed to do financially, wired directly into the deterministic Policy Engine.

**Deliverables:**
- [x] `src/db/connection.ts` — Additive migration: `trusted_merchants_only`, `require_approval_first_purchase` on `customer_profiles`
- [x] `src/types/auth.ts` — Zod schema extensions for new policy fields
- [x] `src/engine/policy-engine.ts` — Extended `evaluatePolicy()` to support new controls and enriched audit reasons, while remaining a pure function
- [x] `src/services/customer-policy.ts` — New service to fetch profile, compute monthly spent dynamically from `transactions` table, and load authoritative config
- [x] `src/app/api/shop/route.ts` — Wired live customer policy into shop route (fallback to defaults for anonymous users)
- [x] API updates: `GET /api/customer/profile` (full profile + computed spending), `PATCH /api/customer/profile` (accepts toggles), `GET /api/customer/stats` (authoritative spending)
- [x] UI updates: `SpendingView` updated with live policy preview, toggle switches, and monthly income display
- [x] 20 new tests — `tests/customer-policy.test.ts` (monthly limit, single purchase limit, approval threshold, toggles, computeMonthlySpent)
- [x] Zero regression — all 333 tests still pass (353 total)

**Definition of Done:** ✅ Policy Engine is authoritative. AI cannot override limits. Customers can edit limits in the UI and see changes reflected in the AI Shop behavior.

---

### Phase 10D — Merchant Dashboard ✅

**Goal:** Replace the stub `/merchant` page with a full-featured 6-view Merchant Dashboard exposing Phase 7/8 AI Growth Intelligence.

**Deliverables:**
- [x] `GET /api/merchant/stats` — aggregate catalog + transaction stats (products, orders, revenue, top product)
- [x] `GET /api/merchant/orders` — paginated platform transaction list (demo-labeled)
- [x] `src/app/merchant/page.tsx` — full rewrite: 6-view dashboard with sidebar nav
  - Overview: stats grid, trust tier, revenue, AI Growth snapshot cards
  - Products: catalog products with AI Top Pick / Upsell badges
  - AI Growth: 5-tab panel (Top Picks, Upsell, Cross-sell, Abandoned Carts, Campaigns)
  - Orders: paginated list with state badges, negotiated price detection
  - Analytics: category breakdown bars, avg rating bars, price range table
  - Settings: shop info display, trust tier, logout
- [x] 22 new tests in `tests/merchant-dashboard.test.ts`
- [x] Zero regression — all 353 Phase 1-10C tests still pass (375 total)

**Definition of Done:** ✅ Merchant dashboard live at `/merchant`. All 6 views work. AI Growth Intelligence fully integrated. Demo data labeled. Role isolation enforced by middleware.

---

### Phase 10E — Merchant Product Management ✅

**Goal:** Implement full product catalog management for merchants (CRUD, AI-assisted suggestions, ownership enforcement).

**Deliverables:**
- [x] `connection.ts` — additive migration: merchant_catalog_id on merchant_profiles
- [x] `schemas.ts` — ProductCreateSchema, ProductUpdateSchema, AIProductSuggestionSchema
- [x] `src/services/merchant-catalog.ts` — CRUD functions with ownership enforcement
- [x] `src/app/api/merchant/products/...` — API routes for listing, creating, updating, deactivating products
- [x] `src/app/api/merchant/products/ai-suggest/route.ts` — AI product metadata and price suggestion
- [x] `page.tsx` — replace ProductsView with management UI (list, add form, AI suggest, preview)
- [x] `tests/merchant-product.test.ts` — 7 new tests for CRUD and ownership
- [x] Zero regression — all 375 Phase 1-10D tests still pass (382 total)

**Definition of Done:** ✅ Merchant can create, update, and deactivate products. AI suggestions work but require explicit approval before save. 
