# Agentic Commerce OS — Architecture

> **Source of truth for system design. All subsequent phases extend — do not redesign — this architecture.**

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js React)                     │
│  ┌──────────┐ ┌────────────┐ ┌─────────────┐ ┌──────────────────┐  │
│  │   Chat   │ │  Product   │ │  Approval   │ │  Audit Timeline  │  │
│  │ Interface│ │   Cards    │ │   Dialog    │ │  + Metrics       │  │
│  └────┬─────┘ └─────┬──────┘ └──────┬──────┘ └───────┬──────────┘  │
│       │              │               │                │             │
│       └──────────────┴───────────────┴────────────────┘             │
│                              │ HTTP                                  │
├──────────────────────────────┼──────────────────────────────────────┤
│                        API ROUTES (Next.js)                         │
│  /api/intent  /api/discover  /api/decide  /api/policy              │
│  /api/checkout  /api/payment/verify  /api/approve  /api/audit      │
├──────────────────────────────┼──────────────────────────────────────┤
│                      APPLICATION LAYER                              │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐               │
│  │  Discovery  │  │   Decision   │  │  Commerce   │  AI AGENTS    │
│  │   Agent     │  │    Agent     │  │   Agent     │  (LLM-backed) │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘               │
│         │                │                  │                       │
│  ┌──────┴────────────────┴──────────────────┴──────┐               │
│  │              LLM Service (Gemini)                │               │
│  │         Structured output + validation           │               │
│  └──────────────────────────────────────────────────┘               │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Policy     │  │ Transaction  │  │ Idempotency  │  ENGINES    │
│  │   Engine     │  │ State Machine│  │   Manager    │  (Determ.)  │
│  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │   Catalog    │  │   Razorpay   │  │    Audit     │  SERVICES   │
│  │   Service    │  │   Service    │  │   Logger     │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                 │                  │                      │
├─────────┼─────────────────┼──────────────────┼─────────────────────┤
│         │                 │                  │                      │
│  ┌──────┴───────┐  ┌─────┴────────┐  ┌──────┴──────┐              │
│  │   SQLite     │  │   Razorpay   │  │   SQLite    │  EXTERNAL   │
│  │  (Catalog +  │  │  Test Mode   │  │  (Audit     │              │
│  │   Txns)      │  │    API       │  │   Events)   │              │
│  └──────────────┘  └──────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. AI vs. Deterministic Boundary

This is the most important architectural principle:

| Concern | Handler | Why |
|---------|---------|-----|
| Intent parsing | **AI** (Discovery Agent) | Natural language understanding |
| Product search/filter | **Deterministic** (Catalog Service) | SQL query on structured data |
| Product ranking + explanation | **AI** (Decision Agent) | Reasoning about fit, preference |
| Budget check | **Deterministic** (Policy Engine) | Financial arithmetic |
| Agent spending limit | **Deterministic** (Policy Engine) | Hard limit, not negotiable |
| Merchant trust evaluation | **Deterministic** (Policy Engine) | Lookup against trust tier |
| Approval decision | **Human** | Explicit consent |
| Order creation | **Deterministic** (Commerce Agent + Razorpay) | API call with validation |
| Payment initiation | **Deterministic** (Razorpay Service) | SDK call |
| Payment verification | **Deterministic** (Razorpay Service) | Signature + polling |
| Retry decision | **Deterministic** (State Machine) | Verify-before-retry |
| Audit logging | **Deterministic** (Audit Logger) | Append-only structured events |

**Rule:** The LLM can *recommend*. The Policy Engine *authorizes*. The State Machine *enforces*.

---

## 3. Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | 20+ LTS |
| Language | TypeScript | 5.x |
| Framework | Next.js (App Router) | 14.x |
| Database | SQLite via `better-sqlite3` | Latest |
| LLM | Google Gemini API | `@google/generative-ai` |
| Payment | Razorpay | `razorpay` npm package |
| CSS | Vanilla CSS + CSS custom properties | — |
| Testing | Vitest | Latest |
| Linting | ESLint + TypeScript strict | — |

---

## 4. Core Data Models

### 4.1 Shopping Intent

```typescript
interface ShoppingIntent {
  id: string;
  rawQuery: string;               // Original user input
  category: string;               // Parsed: "headphones"
  maxBudget: number;              // Parsed: 8000
  currency: string;               // "INR"
  constraints: {
    maxDeliveryDays?: number;     // Parsed: 3
    minRating?: number;
    features?: string[];          // ["noise-cancelling"]
    brand?: string;
  };
  createdAt: string;
}
```

### 4.2 Product (Catalog)

```typescript
interface Product {
  id: string;
  merchantId: string;
  name: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  stock: number;
  rating: number;                 // 1.0 – 5.0
  deliveryDays: number;
  merchantTrustTier: 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'UNRATED';
  attributes: Record<string, string>;  // e.g., { "type": "over-ear", "anc": "true" }
  tags: string[];
  imageUrl?: string;
  createdAt: string;
}
```

### 4.3 Transaction

```typescript
type TransactionState =
  | 'INITIATED'
  | 'DISCOVERY'
  | 'DECISION'
  | 'POLICY_CHECK'
  | 'POLICY_FAIL'
  | 'APPROVAL_REQUIRED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED'
  | 'AUTO_APPROVED'
  | 'ORDER_CREATED'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_TIMEOUT'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'FAILED';

interface Transaction {
  id: string;
  state: TransactionState;
  intentId: string;
  selectedProductId?: string;
  selectedProductName?: string;
  selectedProductPrice?: number;
  policyResult?: PolicyResult;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  idempotencyKey: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}
```

### 4.4 Policy Result

```typescript
interface PolicyCheck {
  name: string;                   // "BUDGET_CHECK" | "AGENT_LIMIT" | "MERCHANT_TRUST"
  result: 'PASS' | 'FAIL';
  reason: string;                 // Human-readable explanation
  details: {
    actual: number | string;
    limit: number | string;
  };
}

interface PolicyResult {
  overall: 'PASS' | 'FAIL';
  requiresApproval: boolean;
  approvalReason?: string;
  checks: PolicyCheck[];
}

// Configurable policy parameters
interface PolicyConfig {
  userBudget: number;             // Max the user is willing to spend
  agentSpendingLimit: number;     // Max the agent can auto-transact
  approvalThreshold: number;      // Require approval above this amount
  allowedMerchantTiers: string[]; // Which merchant tiers are acceptable
}
```

### 4.5 Audit Event

```typescript
type AuditEventType =
  | 'INTENT_RECEIVED'
  | 'DISCOVERY_STARTED'
  | 'DISCOVERY_COMPLETE'
  | 'DECISION_STARTED'
  | 'DECISION_COMPLETE'
  | 'POLICY_CHECK'
  | 'POLICY_RESULT'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_RECEIVED'
  | 'ORDER_CREATED'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_STATUS_POLLED'
  | 'PAYMENT_VERIFIED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_TIMEOUT'
  | 'RECOVERY_ATTEMPTED'
  | 'DUPLICATE_PREVENTED'
  | 'TRANSACTION_COMPLETE'
  | 'TRANSACTION_FAILED';

interface AuditEvent {
  id: string;
  timestamp: string;
  transactionId: string;
  event: AuditEventType;
  result: 'SUCCESS' | 'FAILURE' | 'INFO' | 'WARNING';
  reason: string;
  metadata?: Record<string, unknown>;
}
```

---

## 5. Transaction State Machine

```
                    ┌──────────┐
                    │ INITIATED│
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │ DISCOVERY│
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │ DECISION │
                    └────┬─────┘
                         │
                 ┌───────▼────────┐
                 │  POLICY_CHECK  │
                 └───┬────────┬───┘
                     │        │
              FAIL   │        │  PASS
           ┌─────────▼──┐     │
           │ POLICY_FAIL │     │
           │  (BLOCKED)  │     │
           └─────────────┘     │
                               │
                    ┌──────────▼──────────┐
                    │  Approval needed?   │
                    └──────┬─────────┬────┘
                     YES   │         │  NO
              ┌────────────▼──┐  ┌───▼───────────┐
              │APPROVAL_REQD  │  │ AUTO_APPROVED  │
              └───┬───────┬───┘  └───────┬────────┘
          APPROVE │       │ REJECT       │
    ┌─────────────▼─┐ ┌───▼──────────┐   │
    │APPROVAL_GRANTED│ │APPROVAL_REJD │   │
    └───────┬───────┘ │  (BLOCKED)   │   │
            │         └──────────────┘   │
            └────────────┬───────────────┘
                         │
                 ┌───────▼────────┐
                 │ ORDER_CREATED  │
                 └───────┬────────┘
                         │
              ┌──────────▼──────────┐
              │  PAYMENT_INITIATED  │
              └──┬──────┬───────┬───┘
                 │      │       │
         SUCCESS │ FAIL │       │ TIMEOUT
    ┌────────────▼┐ ┌───▼────┐ ┌▼──────────────────┐
    │PAY_SUCCESS  │ │PAY_FAIL│ │  PAYMENT_TIMEOUT   │
    └──────┬──────┘ └───┬────┘ └────────┬───────────┘
           │            │               │
           │        ┌───▼────┐  ┌───────▼────────────┐
           │        │ FAILED │  │PENDING_VERIFICATION │
           │        └────────┘  └───────┬────────────┘
           │                            │ (poll status)
           └────────────┬───────────────┘
                        │
                   ┌────▼────┐
                   │VERIFIED │
                   └────┬────┘
                        │
                  ┌─────▼──────┐
                  │ COMPLETED  │
                  └────────────┘
```

### Valid State Transitions

| From | To | Trigger |
|------|----|---------|
| INITIATED | DISCOVERY | Intent parsed |
| DISCOVERY | DECISION | Products found |
| DECISION | POLICY_CHECK | Product selected |
| POLICY_CHECK | POLICY_FAIL | Any policy check fails |
| POLICY_CHECK | APPROVAL_REQUIRED | Passes but needs human approval |
| POLICY_CHECK | AUTO_APPROVED | Passes and below approval threshold |
| APPROVAL_REQUIRED | APPROVAL_GRANTED | Human approves |
| APPROVAL_REQUIRED | APPROVAL_REJECTED | Human rejects |
| AUTO_APPROVED | ORDER_CREATED | Razorpay order created |
| APPROVAL_GRANTED | ORDER_CREATED | Razorpay order created |
| ORDER_CREATED | PAYMENT_INITIATED | Checkout shown to user |
| PAYMENT_INITIATED | PAYMENT_SUCCESS | Razorpay callback success |
| PAYMENT_INITIATED | PAYMENT_FAILED | Razorpay callback failure |
| PAYMENT_INITIATED | PAYMENT_TIMEOUT | No response within timeout |
| PAYMENT_SUCCESS | VERIFIED | Server-side signature verified |
| PAYMENT_TIMEOUT | PENDING_VERIFICATION | Status poll initiated |
| PENDING_VERIFICATION | VERIFIED | Poll confirms success |
| PENDING_VERIFICATION | FAILED | Poll confirms failure |
| VERIFIED | COMPLETED | Transaction finalized |

---

## 6. Policy Engine Design

The Policy Engine is a **pure function**: `(cart, config) → PolicyResult`.

```
Input:                          Output:
┌─────────────────┐            ┌──────────────────┐
│ cartTotal: 3799 │            │ overall: PASS     │
│ userBudget: 8000│     ──►    │ requiresApproval: │
│ agentLimit: 5000│            │   true (>₹3000)   │
│ approvalAt: 3000│            │ checks: [         │
│ merchantTier:   │            │   BUDGET: PASS    │
│   "GOLD"        │            │   AGENT_LIM: PASS │
│ allowedTiers:   │            │   MERCHANT: PASS  │
│   [PLAT,GOLD]   │            │ ]                 │
└─────────────────┘            └──────────────────┘
```

**No LLM involvement. Pure arithmetic + lookup.**

---

## 7. Payment Integration Design

### Flow

1. **Order Creation** — Server creates Razorpay order via API (`POST /orders`)
2. **Checkout** — Frontend opens Razorpay Standard Checkout with order ID
3. **Callback** — Razorpay JS SDK calls handler with `payment_id`, `order_id`, `signature`
4. **Verification** — Server verifies HMAC signature: `SHA256(order_id + "|" + payment_id, key_secret)`
5. **Polling** — If callback doesn't arrive, poll `GET /orders/{order_id}/payments`

### Idempotency

- Each transaction has a unique `idempotencyKey` (UUID v4)
- Before creating a new Razorpay order, check if one already exists for this transaction
- Razorpay order IDs are stored in the transaction record
- Duplicate order prevention: reject if transaction already has `razorpayOrderId`

### Timeout Handling

```
PAYMENT_INITIATED
     │
     ├── Callback received → verify signature → VERIFIED
     │
     └── No callback within 30s → PAYMENT_TIMEOUT
              │
              └── Poll Razorpay /payments endpoint
                    │
                    ├── Payment found + paid → VERIFIED
                    ├── Payment found + failed → FAILED  
                    └── No payment found → keep PENDING (do NOT retry)
```

---

## 8. Audit System Design

- **Append-only** — events are never modified or deleted
- **Structured** — every event has a fixed schema
- **Per-transaction** — events keyed by `transactionId`
- **Stored in SQLite** — `audit_events` table
- **Queryable** — `GET /api/audit?transactionId=xxx` returns ordered events
- **UI-rendered** — events transformed into human-readable timeline

---

## 9. Database Schema (SQLite)

### Tables

```sql
-- Products catalog
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  currency TEXT DEFAULT 'INR',
  stock INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  delivery_days INTEGER DEFAULT 7,
  merchant_trust_tier TEXT DEFAULT 'UNRATED',
  attributes TEXT,     -- JSON
  tags TEXT,           -- JSON array
  image_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Transactions
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'INITIATED',
  intent_id TEXT,
  intent_raw TEXT,
  selected_product_id TEXT,
  selected_product_name TEXT,
  selected_product_price REAL,
  policy_result TEXT,         -- JSON
  approval_status TEXT,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  idempotency_key TEXT UNIQUE NOT NULL,
  failure_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Audit events
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  timestamp TEXT DEFAULT (datetime('now')),
  transaction_id TEXT NOT NULL,
  event TEXT NOT NULL,
  result TEXT NOT NULL,
  reason TEXT,
  metadata TEXT,              -- JSON
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

-- Merchants
CREATE TABLE merchants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trust_tier TEXT DEFAULT 'UNRATED',
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Metrics (simple counter table)
CREATE TABLE metrics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  value REAL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now'))
);
```

---

## 10. API Route Map

| Method | Path | Purpose | Handler |
|--------|------|---------|---------|
| POST | `/api/intent` | Parse shopping intent | Discovery Agent |
| POST | `/api/discover` | Search catalog | Catalog Service |
| POST | `/api/decide` | Rank and select product | Decision Agent |
| POST | `/api/policy` | Run policy checks | Policy Engine |
| POST | `/api/approve` | Record approval decision | State Machine |
| POST | `/api/checkout` | Create Razorpay order | Commerce Agent + Razorpay |
| POST | `/api/payment/verify` | Verify payment signature | Razorpay Service |
| GET | `/api/payment/status` | Poll payment status | Razorpay Service |
| GET | `/api/audit` | Get audit trail | Audit Logger |
| GET | `/api/demo` | Get seeded demo data | Demo Service |

---

## 11. Security Boundaries

- Razorpay `key_secret` — **server-side only**, never exposed to frontend
- Razorpay `key_id` — safe for frontend (used in checkout JS)
- LLM API key — **server-side only**
- All `.env` values — in `.env.example` as templates, `.env` in `.gitignore`
- Payment signature verification — **server-side only**
- No direct DB access from frontend — all through API routes
