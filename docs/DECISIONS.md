# Agentic Commerce OS — Engineering Decisions

> **One line per non-obvious decision and why it was made over the alternative.**
>
> This document exists to answer panel questions like "why did you choose X over Y?"

---

## Architecture Decisions

| # | Decision | Alternative Considered | Rationale |
|---|----------|----------------------|-----------|
| 1 | **Deterministic Policy Engine** over LLM-based authorization | Let LLM decide spending limits | Financial decisions must be auditable, reproducible, and non-probabilistic. An LLM might hallucinate a budget check result. |
| 2 | **Status polling** over webhooks for payment verification | Razorpay webhooks | Webhooks require a public callback URL (e.g., ngrok). Polling works entirely locally, is easier to make deterministic for demo, and avoids a common last-minute demo blocker. |
| 3 | **SQLite** over PostgreSQL/MongoDB | PostgreSQL, MongoDB, in-memory only | Zero infrastructure setup, real persistence (not in-memory), sufficient for single-user hackathon demo. No separate database server to manage. |
| 4 | **Next.js monolith** over separate frontend + backend | React SPA + Express API | Single deployable, shared types, API routes co-located with frontend, easier to demo and deploy. No CORS configuration needed. |
| 5 | **Structured LLM output** (JSON schema) over free-text parsing | Let LLM return free text, parse with regex | Structured output is validatable, type-safe, and prevents the LLM from injecting unexpected behavior. Regex parsing of LLM free text is fragile. |
| 6 | **Google Gemini** over OpenAI/Anthropic | GPT-4, Claude | Generous free tier for hackathon, good structured output support, fast inference. Can be swapped via the LLM abstraction layer. |
| 7 | **Vanilla CSS** over Tailwind | TailwindCSS | Maximum control over design system, no build dependency, smaller bundle, easier to customize glassmorphism/animations. |
| 8 | **Vitest** over Jest | Jest | Faster, native TypeScript support, better ESM handling, works well with Next.js App Router. |

## Payment Design Decisions

| # | Decision | Alternative Considered | Rationale |
|---|----------|----------------------|-----------|
| 9 | **Idempotency keys** for order creation | Allow duplicate orders, dedupe later | Prevents double-charging at the source. Each transaction maps to exactly one Razorpay order. |
| 10 | **Verify-before-retry** on timeout | Auto-retry on timeout | A timeout does not mean failure. Retrying without verification risks duplicate payment. System must poll existing order status first. |
| 11 | **Razorpay Standard Checkout** over Custom Checkout | Custom Checkout (build own payment form) | Standard Checkout handles PCI compliance, card input, UPI flow — less code, more secure, faster to integrate. |
| 12 | **Transaction state machine** over status flags | Boolean flags (isPaid, isApproved, etc.) | State machine enforces valid transitions, prevents impossible states (e.g., paid but not approved), makes audit trail clearer. |

## Data Design Decisions

| # | Decision | Alternative Considered | Rationale |
|---|----------|----------------------|-----------|
| 13 | **Synthetic catalog** over real API | Amazon/Flipkart API scraping | No API key needed, no rate limits, no legal risk, full control over data for demo scenarios. |
| 14 | **Merchant trust tier** as enum | Numeric trust score | Simpler to reason about in policy checks, clearer in UI ("Gold merchant" vs "trust: 0.73"), more demo-friendly. |
| 15 | **Append-only audit events** over mutable transaction log | Update transaction record with status history | Immutable audit trail is more trustworthy, easier to debug, satisfies auditability requirement. |

## UX Decisions

| # | Decision | Alternative Considered | Rationale |
|---|----------|----------------------|-----------|
| 16 | **Chat-style interface** over form-based | Traditional search + filter UI | Matches the "AI commerce product" experience described in the spec. Natural language is the core interaction model. |
| 17 | **Seeded demo mode** over live-only | Only live LLM calls | Demo determinism: same intents always produce same results. Eliminates LLM latency/non-determinism risk during judging. |
| 18 | **Expandable audit timeline** over separate page | Audit on a different page/tab | Keeps the user in context, shows the AI's reasoning alongside the conversation, reinforces transparency. |

---

*This document is updated at the end of every phase.*
