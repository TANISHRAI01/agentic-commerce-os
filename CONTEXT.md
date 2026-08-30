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
|----------|--------|
| 0 — Architecture & Docs | ✅ Complete (`phase-0` tag) |
| 1 — Foundation | ✅ Complete (`phase-1` tag) |
| 2 — AI Buyer | ✅ Complete (`v0.2-ai-buyer` tag) |
| 3 — Policy + Approval | ✅ Complete |
| 4 — Razorpay Payment | ✅ Complete (`v0.4-payments` tag) |
| 5 — Failure Handling | ✅ Complete |
| 6 — Audit + Premium UX | ✅ Complete |
| 7 — AI-Readable Merchant Layer | ✅ Complete |
| 8 — Merchant AI + Growth | ✅ Complete (tagged `v0.8-growth`) |
| 9 — Agent-to-Agent Commerce | ✅ Complete |
| 10A — Role-Based Auth & User Profiles | ✅ Complete |

**Last completed phase:** 10A
**316 tests passing. Auth system live.**

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

### Phase 4 — Razorpay Payment ✅ Complete
- **Razorpay Service** (`src/services/razorpay.ts`): Server-side only. Order creation via `razorpay.orders.create()`, HMAC-SHA256 signature verification using `crypto.timingSafeEqual()`, order status polling. No LLM involvement.
- **API Routes**: `POST /api/checkout` (8-point security guard, idempotency, DB-sourced pricing), `POST /api/payment/verify` (HMAC verification, state guards, order ID matching), `GET /api/payment/status` (transaction state polling)
- **UI Components**: `CheckoutButton.tsx` (order summary, Razorpay Standard Checkout modal, verify callback), `PaymentReceipt.tsx` (verified payment details, test mode notice)
- **Security**: All 8 guards enforced before any Razorpay call. Price always from DB. Signature verified server-side. Idempotency prevents duplicate orders. LLM never touches payment.
- **Tests**: 31 new tests (HMAC verification, security guards, config validation, state machine flow). Total: 222 tests passing.

### Phase 5 — Failure Handling ✅ Complete
- **PaymentSimulator** (`src/services/payment-simulator.ts`): Dev-only test abstraction with 4 named modes (`NORMAL`, `TIMEOUT_THEN_SUCCESS`, `TIMEOUT_THEN_FAILURE`, `VERIFICATION_ERROR`). Production guard throws if activated outside dev. Controlled via `PAYMENT_SIM_MODE` env var.
- **Recovery Endpoint** (`POST /api/payment/recover`): Owns the entire verify-before-retry contract. Fetches external payment status, reconciles `PAYMENT_UNKNOWN` to `COMPLETED` or `PAYMENT_FAILED` deterministically, or leaves it `PAYMENT_UNKNOWN` if the provider is unreachable. Every branch is audited.
- **Guard 2b** in `/api/checkout`: Hard-blocks checkout when state is `PAYMENT_UNKNOWN`. Emits `RETRY_BLOCKED` audit event. Directs client to `/api/payment/recover` first.
- **Audit Endpoint** (`GET /api/payment/audit`): Returns the full chronological audit trail for a transaction. Used by IncidentTimeline.
- **IncidentTimeline** (`src/app/components/IncidentTimeline.tsx`): Auto-polling visual timeline of audit events. Color-coded by result. Shows safety notice in `PAYMENT_UNKNOWN` state. Stops polling on terminal state.
- **CheckoutButton** updated: Detects if Razorpay modal was dismissed without a handler callback while the server is still `PAYMENT_PENDING`. Transitions to `unknown` UI state with "Verify Payment Status" button — blocking silent retry.
- **AuditEventType**: Added `RETRY_BLOCKED` and `PAYMENT_RECONCILED` to the schema.
- **Tests**: 12 new tests in `tests/recovery.test.ts`. Total: 238 tests passing.

### Phase 6 — Audit + Premium UX ✅ Complete
- **DemoPanel** (`src/app/components/DemoPanel.tsx`): 4 pre-configured demo scenario buttons (success, rejection, approval, timeout). Auto-fills real queries. Labeled as test mode.
- **IncidentTimeline** updated: Simple/Technical view toggle. Simple shows human-readable sentences. Technical shows event IDs, types, and metadata. Disclosure line clarifies no secrets are shown.
- **PolicyPanel** updated: Plain-language explanation generated deterministically from policy check data. Shows sentences like “Purchase allowed because the product costs ₹3,799 and your agent limit is ₹5,000.”
- **ChatMessage** refactored: Section cards (Intent, AI Recommendation, Policy, Payment, Audit Trail) with labeled headers. Audit trail auto-expands on terminal states, toggleable during the flow.
- **Page refresh**: Premium welcome with feature badges and glow effect. Phase badge in header. DemoPanel integrated.
- **CSS**: 350+ new lines covering demo cards, section cards, audit toggle, policy explanations, welcome glow.
- **Tests**: All 238 tests passing. No backend changes in this phase.

### Phase 7 — AI-Readable Merchant Layer ✅ Complete
- **Schema Updates**: Added `policies`, `deliveryRegions`, `paymentCapabilities`, `businessRules` to `MerchantSchema`. Added `availability` and `offerEligibility` to `ProductSchema`.
- **Database Schema**: Recreated `commerce.db` with new columns storing JSON strings for arrays and objects.
- **API Routes**: Built structured, predictable RESTful APIs under `/api/merchants`:
  - `GET /api/merchants` — Catalog discovery
  - `GET /api/merchants/[merchantId]` — Merchant metadata
  - `GET /api/merchants/[merchantId]/catalog` — Product lookup
  - `GET /api/merchants/[merchantId]/inventory/[productId]` — Inventory & availability
  - `GET /api/merchants/[merchantId]/offers` — Eligible offers
- **Buyer Integration**: Updated `src/app/api/shop/route.ts` to fetch merchant details. Enriched `Decision Agent` prompt (`src/agents/decision.ts`) with new product and merchant metadata, enabling AI comparison across "Merchant, Product, Price, Delivery, Trust, Offer".
- **Tests**: All tests passing.

### Phase 8 — Merchant AI + Growth Intelligence ✅ Complete
- **MerchantRecommendationsSchema** (`src/types/ranking.ts`): Added `MerchantRecommendationItem` (with `isOptional: z.literal(true)` guardrail), `MerchantRecommendationsSchema` (cross-sells, upsells, bundles, contextual offer). Two new `AuditEventType` values: `MERCHANT_AGENT_STARTED`, `MERCHANT_AGENT_COMPLETE`.
- **Merchant Agent** (`src/agents/merchant.ts`): LLM-powered optional recommendations. Builds prompt from buyer intent + selected product + other candidates. Post-validates all returned IDs against candidate list (same hallucination guard as Decision Agent). Filters selected product before validation. Non-fatal in the shop pipeline.
- **Growth Intelligence Service** (`src/services/growth-intelligence.ts`): Fully deterministic (no LLM). Five signal types: top recommended (by rating), upsell opportunities (20–80% above category median), cross-sell pairs (tag-overlap heuristic), abandoned cart signals (stale non-terminal transactions), campaign suggestions (structural catalog analysis). No revenue claims.
- **API Routes**: `POST /api/shop` enriched with `merchantRecommendations` field (non-fatal agent call after CART_READY). New `GET /api/merchant-intelligence` returns full `GrowthIntelligenceReport`.
- **UI Components**: `RecommendationCard.tsx` (Accept = informational only, Dismiss = removes card), `MerchantRecommendations.tsx` (collapsible grouped panel), `MerchantDashboard.tsx` (5-tab dashboard: Top Products, Upsell, Cross-sell, Abandoned, Campaigns). Main page has 💬 Shop / 📊 Dashboard view toggle. Phase badge updated to Phase 8.
- **Tests**: 40 new tests (10 merchant-agent, 30 growth-intelligence). **Total: 278 tests passing.**
- **Guardrails**: Payment amount never touched by Merchant Agent. `isOptional: true` enforced at Zod schema level. All LLM output post-validated. Errors in Merchant Agent are non-fatal — shop flow always continues.

### Phase 9 — Agent-to-Agent Commerce ✅ Complete
- **Negotiation Types** (`src/types/negotiation.ts`): Full Zod schema protocol — `BuyerOffer`, `MerchantOffer`, `BuyerCounter`, `MerchantFinal`, `NegotiationRound`, `NegotiationResult`, `NegotiationOutcome` (DEAL/NO_DEAL/SKIPPED).
- **Negotiation Agent** (`src/agents/negotiation.ts`): Bounded 2-round Buyer ↔ Merchant negotiation loop. `BuyerNegotiationAgent` and `MerchantNegotiationAgent` are LLM-powered. Server-side price clamp enforces `merchant.businessRules.maxDiscountPercent` cap regardless of LLM output. Non-fatal — pipeline always continues.
- **State Machine**: Added `NEGOTIATING` state. Transitions: `CART_READY → NEGOTIATING → CART_READY` (with `negotiatedPrice` stored).
- **Database**: Added `negotiated_price`, `negotiation_rounds`, `negotiation_log` columns with additive migration.
- **API Route** (`POST /api/negotiate`): Guards: transaction must be CART_READY, product must exist in DB, merchant must have `businessRules`. Runs negotiation, emits 4 audit events, stores result.
- **Checkout** (`/api/checkout`): Uses `negotiatedPrice` if set and strictly less than DB price (guards against markup).
- **UI**: `NegotiationPanel.tsx` — animated Buyer/Merchant chat bubbles, deal badge, savings summary. Shown in `ChatMessage` after product selection. `page.tsx` calls `/api/negotiate` after `/api/shop`.
- **Tests**: 11 new tests (SKIPPED outcome, Round 1 deal, server clamp, Round 2, schema validation, state machine). **Total: 289 tests passing.**
- **Guardrails**: `negotiatedPrice` can never exceed `product.price` (enforced in checkout). Merchant Agent failures are non-fatal. Discount cap enforced server-side, not trusted from LLM.

**Phase 9 is the final stretch phase. All 9 phases are complete.**

---

## What To Do Next

*All phases (1–10A) complete. System is demo-ready with full auth.*

### Phase 10A — Role-Based Auth & User Profiles ✅ Complete
- **Auth Types** (`src/types/auth.ts`): Zod schemas — `UserRole`, `AuthUserSchema`, `CustomerProfileSchema`, `MerchantProfileSchema`, `SignupRequestSchema` (discriminated union), `LoginRequestSchema`, `SessionPayloadSchema`
- **DB Schema** (`src/db/connection.ts`): Three new tables added via additive migration — `auth_users` (email/password_hash/role), `customer_profiles` (spending limits with defaults), `merchant_profiles` (shopName/category/trustTier)
- **Auth Service** (`src/services/auth.ts`): `signupUser`, `loginUser` (bcryptjs), `createSessionToken`, `verifySessionToken` (jsonwebtoken), `getUserById`, `getCustomerProfile`, `getMerchantProfile`. Custom `AuthError` class.
- **API Routes**: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` — all with Zod validation, httpOnly JWT cookie
- **Middleware** (`middleware.ts`): Edge middleware using `jose`. Protects `/customer/*` and `/merchant/*` server-side. All Phase 1–9 routes unaffected via explicit `matcher` config.
- **UI**: `/auth` (role-selection landing), `/auth/login`, `/auth/signup`, `/customer` (stub dashboard), `/merchant` (stub dashboard)
- **AuthProvider** (`src/app/components/AuthProvider.tsx`): React context for session state, `useAuth()` hook
- **Tests**: 27 new tests in `tests/auth.test.ts`. **Total: 316 tests passing.**
- **Zero regression**: All 289 Phase 1–9 tests unchanged and still passing


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
- `gemini-2.0-flash` model (fast, cheap, sufficient for structured extraction)

---

## Credentials Needed (in `.env`)

- `RAZORPAY_KEY_ID` — Razorpay test key ID
- `RAZORPAY_KEY_SECRET` — Razorpay test key secret
- `GEMINI_API_KEY` — Google Gemini API key

---

## Quick Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm test         # Run all tests (289 passing)
npm run seed     # Seed the database with 60 products
npm run build    # Build for production

# Phase 5 test scenarios (set env var before npm run dev):
# PAYMENT_SIM_MODE=TIMEOUT_THEN_SUCCESS npm run dev
# PAYMENT_SIM_MODE=TIMEOUT_THEN_FAILURE npm run dev
# PAYMENT_SIM_MODE=VERIFICATION_ERROR   npm run dev

# Phase 8 — Test Merchant Dashboard:
# 1. npm run dev
# 2. Click "📊 Dashboard" tab in header
# 3. Browse Top Products, Upsell, Cross-sell, Abandoned, Campaigns tabs

# Phase 9 — Demo Negotiation:
# 1. npm run dev
# 2. Type: "Find me noise-cancelling headphones under ₹8,000"
# 3. Watch the NegotiationPanel animate after product selection
# 4. Audit trail shows: NEGOTIATION_STARTED → NEGOTIATION_ROUND → NEGOTIATION_COMPLETE
```

---

*Last updated: Phase 9 completion — all phases complete.*
*Update this file at the end of every phase.*
