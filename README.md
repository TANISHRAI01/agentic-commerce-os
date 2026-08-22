# Agentic Commerce OS

> **Razorpay AI Buildathon 2026 · Track 01 — AI Growth & Agentic Commerce**
>
> *From "AI that actually recommends" to "AI that actually buys."*

An AI-native commerce system where a human gives a natural-language shopping intent and an AI Buyer safely moves from intent to verified payment — with deterministic financial guardrails, human approval, and a complete audit trail.

## What It Does

```
Human Intent → AI Discovery → AI Decision → Policy Check → Human Approval →
Razorpay Payment (TEST MODE) → Verification → Audit Trail
```

**Key principle:** AI recommends, deterministic code authorizes, humans approve.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend + API | Next.js 14 (App Router) + TypeScript |
| Database | SQLite (better-sqlite3) |
| AI | Google Gemini API |
| Payments | Razorpay Standard Checkout (Test Mode) |
| Styling | Vanilla CSS |
| Testing | Vitest |

## Quick Start

```bash
# 1. Clone
git clone https://github.com/TANISHRAI01/agentic-commerce-os.git
cd agentic-commerce-os

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your Razorpay test keys and Gemini API key

# 4. Seed the database
npm run seed

# 5. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/          # Next.js pages + API routes
├── agents/       # AI agents (Discovery, Decision, Commerce)
├── engine/       # Deterministic engines (Policy, State Machine, Idempotency)
├── services/     # External integrations (Razorpay, LLM, Catalog)
├── db/           # SQLite schema, connection, seed data
├── audit/        # Structured event logging
├── types/        # Shared TypeScript types
└── components/   # React UI components
docs/
├── PROJECT_PLAN.md
├── ARCHITECTURE.md
├── AGENT_HANDOFF.md
└── DECISIONS.md
```

## Safety Guarantees

- ⚠️ **TEST MODE ONLY** — Razorpay test credentials, no real money moves
- 🔒 **Deterministic Policy Engine** — AI cannot override spending limits
- 👤 **Human Approval** — Required above configurable threshold
- 🔑 **Idempotency** — Duplicate payments prevented at the source
- ⏱️ **Safe Timeout Handling** — Verify before retry, never blind retry
- 📋 **Complete Audit Trail** — Every operation logged with structured events

## Documentation

- [Project Plan](docs/PROJECT_PLAN.md) — Phase status and deliverables
- [Architecture](docs/ARCHITECTURE.md) — System design (source of truth)
- [Agent Handoff](docs/AGENT_HANDOFF.md) — State, decisions, risks
- [Decisions](docs/DECISIONS.md) — Engineering rationale for panel Q&A

## License

MIT
