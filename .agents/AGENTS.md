# Workspace Rules — Agentic Commerce OS

## First Step for Any Agent

**Before doing anything else, read `CONTEXT.md` in the project root.**

It contains:
- Current phase status (what's done, what's next)
- Key architecture rules that must not be violated
- A map to all other documentation files
- Summary of past engineering decisions

Do NOT re-read the entire project if `CONTEXT.md` is current. It is the single resume point.

## Phase Gating Rule

Phases 1–6 are mandatory. Phases 7–9 are stretch.
Never start a stretch phase unless Phases 1–6 are stable and tested.
Never skip a phase.

## Architecture Source of Truth

`docs/ARCHITECTURE.md` is the source of truth for system design.
Do NOT redesign architecture independently — extend what's documented there.

## Documentation Updates

At the end of every phase, update:
1. `CONTEXT.md` — status table, what's next, what's been built
2. `docs/PROJECT_PLAN.md` — phase status
3. `docs/AGENT_HANDOFF.md` — current state
4. `docs/DECISIONS.md` — any new decisions made

## Safety Rules

- Razorpay: TEST MODE only, secrets in `.env`, never in code
- LLM output: always validate against JSON schema before acting
- Payment: polling over webhooks, verify before retry, idempotency keys
