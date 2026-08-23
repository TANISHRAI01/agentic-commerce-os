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

## Phase 1 Decisions

| # | Decision | Alternative Considered | Rationale |
|---|----------|----------------------|-----------|
| 19 | **sql.js** (pure JS SQLite) over better-sqlite3 | better-sqlite3 (native addon) | better-sqlite3 requires Visual Studio C++ build tools (node-gyp) for native compilation on Windows. sql.js is a pure JavaScript SQLite compiled via Emscripten — zero native dependencies, works on any platform without build tools. Slight performance trade-off is irrelevant for a single-user hackathon demo. |
| 20 | **Zod** for runtime schema validation over TypeScript-only types | Plain TypeScript interfaces | Zod provides runtime validation (catches bad data from LLM/API before it hits the DB), automatic TypeScript type inference (no type duplication), and composable schema building. Essential for the "validate LLM output against schema" requirement. |
| 21 | **60 products across 8 categories** over fewer | 10-20 products | Enough variety to make demo realistic (user can search headphones, laptops, books, etc.) without being so large that seed/search is slow. 6 merchants with different trust tiers enable meaningful policy demonstrations. |
| 22 | **Transaction service auto-audits** on every state transition | Manual audit calls at each transition site | Guarantees no state transition goes unrecorded. Reduces the chance of an engineer forgetting to add audit logging when adding new transition paths. |

## Phase 2 Decisions (AI Buyer)

| # | Decision | Alternative Considered | Rationale |
|---|----------|----------------------|-----------|
| 23 | **Unified `/api/shop` endpoint** over multi-step client calls | Client calls intent → discover → decide separately | Single network round-trip reduces latency and frontend complexity. Individual endpoints still exist for debugging and testing. |
| 24 | **Candidate-only ranking** (LLM sees filtered results) over full catalog | Send entire catalog to LLM for ranking | Prevents hallucination of products outside search results. Reduces prompt size. LLM only ranks products that deterministic search already approved. |
| 25 | **Post-validation of product IDs** after LLM ranking | Trust LLM output directly | Double safety net: verify selected product ID and all alternative IDs exist in both the candidate list and the database. Catches hallucinated IDs. |
| 26 | **Mocked LLM for tests** over live API calls | Require GEMINI_API_KEY for test suite | Tests must be deterministic and runnable without API keys. Schema validation and hallucination prevention are tested with mock data. |
| 27 | **`gemini-1.5-flash`** over `gemini-1.5-pro` | gemini-1.5-pro (higher quality) | Flash is faster, cheaper, and sufficient for structured extraction (low temperature + schema validation). Pro would add latency without meaningful quality improvement for this use case. |
| 28 | **Search relaxation** (progressive filter loosening) over strict-only search | Return empty when filters match nothing | Better UX: if strict filters return nothing, progressively relax (remove tags, then price limit) to still provide relevant results. User is notified when search was broadened. |
| 29 | **Retry on malformed LLM output** (2 retries) over fail-fast | Return error immediately on bad output | LLMs occasionally return malformed JSON. 2 retries with a stronger instruction catches most transient issues. If all retries fail, a clear error is returned. |
| 30 | **Separate `ParsedIntentSchema` and `RankingResultSchema`** over reusing existing schemas | Extend ShoppingIntentSchema for LLM output | LLM output shape differs from internal schemas (e.g., `maximumPrice` vs `maxBudget`, `ambiguityQuestions`). Separate schemas keep the LLM interface decoupled from internal types. |

---

*This document is updated at the end of every phase.*

