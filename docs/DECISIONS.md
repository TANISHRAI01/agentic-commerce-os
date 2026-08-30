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

## Phase 3 Decisions (Policy + Approval)

| # | Decision | Alternative Considered | Rationale |
|---|----------|----------------------|-----------|
| 31 | **Pure Function Policy Engine** over database-coupled logic | Pass DB connection to policy engine | A pure function `(input) → result` is easier to test, completely predictable, and has zero side effects. The caller is responsible for fetching the necessary data from the DB. |
| 32 | **Database-sourced pricing** over frontend-provided pricing | Trust price sent from frontend in `/api/policy` request | Security: Frontend cannot be trusted to provide accurate pricing. The backend must read the canonical price from the SQLite database to prevent price manipulation attacks. |
| 33 | **Triple Verification in `/api/approve`** over simple state transition | Trust the decision without re-verifying state | Security: Even if an authenticated user calls `/api/approve`, the backend must independently verify the transaction exists, is exactly in `APPROVAL_REQUIRED` state, and the policy checks actually passed. |
| 34 | **Inline Policy Execution** in `/api/shop` over separate API call | Make frontend call `/api/policy` after `/api/shop` | Better UX and lower latency. The policy result is immediately available in the same response as the product recommendation, allowing the UI to instantly show if the purchase is blocked, auto-approved, or needs human approval. |
| 35 | **Granular Audit Events** over single "Policy Checked" event | One event for policy + approval | Writing separate `POLICY_CHECK`, `POLICY_EVALUATED`, `APPROVAL_REQUESTED`, `APPROVAL_GRANTED`/`REJECTED` events creates a detailed, unambiguous timeline for auditability. |

## Phase 4 Decisions (Razorpay Payment)

| # | Decision | Alternative Considered | Rationale |
|---|----------|----------------------|-----------|
| 36 | **Strict Server-Side Razorpay Orchestration** | Initialize Razorpay fully on the client | Security. The client is only given the public Key ID and the created Order ID. Order creation and signature verification must happen on the backend to prevent tampering. |
| 37 | **Timing-Safe Signature Verification** | Use standard string equality (`===`) | Security. `crypto.timingSafeEqual` prevents timing attacks when comparing the HMAC-SHA256 signature from Razorpay. |
| 38 | **State-Aware Idempotency** | Simply return the existing order if `razorpayOrderId` is set | Prevent double checkouts on paid orders. If a transaction is in a terminal state (like `COMPLETED`), returning the existing order could allow the frontend to retry checkout. The API now throws a 409 Conflict if the transaction isn't in `PAYMENT_PENDING` or an approved state. |

## Phase 5 Decisions (Failure Handling)

| # | Decision | Alternative Considered | Rationale |
|---|----------|----------------------|-----------|
| 39 | **PaymentSimulator via env var** over mocking at the test layer | Use `vi.mock` for all simulator tests | Env var mode means the simulator runs through the full real code path (route → service), not a mock bypass. This tests the actual guard and audit logic, not just the happy path. |
| 40 | **`/api/payment/recover` owns all reconciliation** over distributing recovery logic | Let `/api/checkout` retry internally | A single endpoint makes it impossible to retry without going through explicit verification. Any bypass of this endpoint is a code audit issue, not a runtime issue. |
| 41 | **Hard 409 block in checkout for `PAYMENT_UNKNOWN`** over soft warning | Show a warning but allow retry | A soft warning can be ignored by a buggy or malicious client. A hard 409 with `action: 'CALL_RECOVER'` forces the correct path. |
| 42 | **`RETRY_BLOCKED` as a first-class audit event** over a server log | Log to console only | An audit event is immutable, timestamped, and queryable. A console log disappears. This makes the block visible in the IncidentTimeline for the user. |
| 43 | **`STILL_UNKNOWN` → 503 (not 200)** when provider is unreachable | Return 200 with `reconciled: false` | 503 is the correct HTTP status when a downstream dependency is unavailable. It signals to the client to not retry immediately. |

## Phase 6 Decisions (Audit + Premium UX)

| # | Decision | Alternative Considered | Rationale |
|---|----------|----------------------|-----------|
| 44 | **Deterministic simple explanations** from policy data, not LLM-generated | Use the LLM to generate human-readable explanations | LLM output is non-deterministic and could hallucinate reasons. String templates from policy check data are 100% accurate and instant. |
| 45 | **Demo scenarios use real queries against real pipeline** | Create a mock/seeded API that returns canned responses | Real queries prove the system actually works end-to-end. Canned responses prove nothing. |
| 46 | **Audit trail disclosure line** ("No API keys or model prompts displayed") | Assume the user trusts the UI | Explicit disclosure prevents confusion. The user should know what they're seeing is application events, not LLM chain-of-thought. |
| 47 | **Section cards** (Intent, Recommendation, Policy, Payment, Audit) in ChatMessage | Flat linear layout with dividers | Cards create visual hierarchy. A judge scanning the screen immediately sees 5 labeled phases of the transaction. |
| 48 | **Audit trail auto-expands on terminal states** | Always show or always hide | Auto-expand on terminal states means the judge sees the full audit trail after a completed purchase without clicking anything. During the flow, a toggle button avoids clutter. |

## Phase 10A — Auth Decisions

| # | Decision | Alternative Considered | Rationale |
|---|----------|----------------------|-----------|
| 49 | **bcryptjs** (pure JS) over **bcrypt** (native) | bcrypt npm package | bcrypt requires native C++ compilation (node-gyp, Visual Studio on Windows). bcryptjs is pure JavaScript, zero-dependency, same API. Consistent with the sql.js decision (pure-JS SQLite) already made in Phase 1. |
| 50 | **JWT in httpOnly cookie** over **localStorage token** | Store JWT in localStorage | httpOnly cookies are inaccessible to JavaScript — immune to XSS attacks. localStorage is vulnerable to any XSS that could exfiltrate the token. httpOnly + SameSite=lax provides CSRF protection for free. |
| 51 | **jose** for middleware JWT verification over **jsonwebtoken** | jsonwebtoken in middleware | Next.js middleware runs in the **Edge runtime**, which does not support all Node.js APIs. `jsonwebtoken` uses `crypto` (Node-only). `jose` is fully Edge-compatible and Web-crypto based. |
| 52 | **No email verification** in Phase 10A | Send verification email | Hackathon prototype — no email server setup needed. The auth system is explicitly local/demo. Email verification adds complexity without demo value. |
| 53 | **Additive DB migrations** for auth tables | Separate migration script / drop-and-recreate | Same pattern already established for Phase 9 negotiation columns. `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE IF NOT EXISTS` pattern is safe on existing databases and never destroys existing data. |
| 54 | **24-hour JWT expiry** | Shorter (1h) or longer (7d) | 24 hours is long enough for a demo session (no constant re-logins), short enough to not leave sessions permanently open. No refresh token complexity needed for a hackathon. |
| 55 | **middleware.ts matcher config** instead of matching all routes | Run middleware on every route | Using `matcher: ['/customer/:path*', '/merchant/:path*', ...]` means middleware only runs on protected routes. Phase 1-9 API routes (/, /api/shop, /api/checkout, etc.) never hit the middleware — zero performance impact and zero risk of breaking existing functionality. |

---

## Phase 10B — Customer Dashboard Decisions

| # | Decision | Alternative Considered | Rationale |
|---|----------|----------------------|-----------|
| 56 | **Nullable `user_id` column** on `transactions` over separate ownership table | Create `transaction_owners` join table | Single nullable column is simpler, faster to query, and safer for additive migration. A join table would require schema design and make anonymous transactions more complex. Consistent with the existing `ALTER TABLE IF NOT EXISTS` pattern. |
| 57 | **Optional userId stamping in `/api/shop`** — no auth required | Require auth for all shop requests | Phase 1–9 demo mode must continue working without login. Making auth optional means logged-in customers get ownership stamped, while demo/unauthenticated users create anonymous transactions. No behavioral change for existing users. |
| 58 | **Single-page client-side navigation** (view state in React) over separate Next.js pages | `/customer/home`, `/customer/shop`, etc. as separate routes | A single-page shell avoids full page reloads between views, allows smooth transitions, and lets the AI Shop input bar persist state as users switch tabs. Separate pages would lose the chat history on every navigate. |
| 59 | **Ownership policy: anonymous transactions visible to any authenticated user** | Strict ownership — only NULL creator sees NULL-user_id transactions | Demo mode creates anonymous transactions (no session). If a user logs in *after* a demo session, showing nothing in their history is confusing. Allowing NULL-user_id transactions to be visible by any customer is a pragmatic demo-mode accommodation. |
| 60 | **AI Shop tab imports existing components directly** (ChatMessage, LoadingState, DemoPanel) over iframe embed | Embed `/` in an iframe inside the dashboard | Direct import shares the same session context, avoids cross-frame communication, and keeps the CSP simple. Iframe would be isolated, require `postMessage` for payment events, and have scroll/height complexity. |
| 61 | **`getTransactionForUser` returns null for wrong owner** rather than 403 | Return HTTP 403 with "forbidden" message | Returning `null → 404` prevents the customer from learning that a transaction ID exists (user enumeration via status codes). 404 is the correct behavior — the resource "doesn't exist" for this user. |

---

## Phase 10C — Customer Spending & AI Limits Decisions

| # | Decision | Alternative Considered | Rationale |
|---|----------|----------------------|-----------|
| 62 | **Policy engine overrides allowed tiers for trusted mode** | Add a separate check for trusted mode outside policy | Keeping all financial rules inside `evaluatePolicy()` ensures it remains the single source of truth for all checks. The pure function architecture scales perfectly to support this additive rule. |
| 63 | **`requireApprovalFirstPurchase` additive logic** | Create a separate rule engine for first purchases | This logic maps perfectly to the existing `requiresApproval` Boolean returned by the policy engine. It cleanly modifies the existing `APPROVAL_THRESHOLD` check logic, keeping the engine cohesive. |
| 64 | **Server-side authoritative spending calculation** | Store monthly spent on the profile and increment | Calculating `monthlySpent` dynamically from the `transactions` table ensures the limit is always authoritative. If a transaction fails, it won't mistakenly increment limits, avoiding race conditions and complex rollback logic. |
| 65 | **Dynamic fallback to default limits in `/api/shop`** | Force users to log in | Maintain compatibility with demo mode. Unauthenticated requests use the existing static defaults, authenticated requests pull authoritative dynamically fetched profiles. |
| 66 | **UI is display-only, backend enforces** | Validate limits on the client before `/api/shop` | The UI Policy Preview is just a visual aid. The actual `evaluatePolicy()` function runs on the server AFTER all LLM interactions, guaranteeing limits can never be bypassed, even by a maliciously crafted request. |

---

*This document is updated at the end of every phase.*
