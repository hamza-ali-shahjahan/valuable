# Valuable — Claude Code Instructions

## Hamzaish-managed product (the factory contract — keep this section)

This repo is a **Hamzaish factory product** (slug: `valuable`). Factory home:
`~/Claude/Hamzaish/products/valuable/` — pinned goal, live status, slices, learnings,
decisions, validation ledger. On ANY change request in this repo, do this without being
asked (a follow-up is a new slice, not an exit from the factory):

1. **Re-enter the factory flow** (`/work-on valuable` or `/hamzaish`); read the factory
   `status.md` first.
2. **Pin the request as a slice** (one measurable "done" line) in `status.md` BEFORE building.
3. **Build with tests** — the suite stays green; new features ship with new tests; never strip tests.
4. **Verify end to end** against the really-running app before reporting done.
5. **Feed the loop**: mark the slice shipped in `status.md`, add transferable lessons to
   `learnings.md`.
6. **Make it visible (enablement protocol)** — plain day-1 language, value never
   mechanism, no factory jargon. Open each task response with the 4-line plan (~80 words):
   `🏭 Hamzaish plan` · **Goal** · **Steps** · **Commands** (each with what it does here) ·
   **Proof before "done"**. Close with the 3-line receipt (max ~50 words):
   `🏭 Hamzaish receipt` · **What you got** · **Checked** · **Try next** (ONE command).

## Session-quality defaults

- **Only share links that work.** Verify a real dev server answers HTTP 200 before
  sharing a localhost link. End build responses with the relevant links — as bare URLs
  in prose (clickable) AND in a copyable code block.
- **Anything the user must copy/paste goes in its own fenced code block** — one command
  per block, prose outside the block.
- **Secrets files are user-touched only.** Claude creates/edits only `*.example`
  templates; the user copies and pastes real keys themselves. Verify with non-printing
  checks (`grep -c`, `test -s`) — never print, cat, or open a real-secrets file.

## What this product is

Real-time valuation intelligence — what a country, a city, a company or your startup is
actually worth, and which decisions moved the number.

**Origin:** Musk's *"How much is it?"* about the UK (12 Aug 2026). Journalists produced
£13.31tn the same day from a free ONS bulletin — so the headline number is a commodity.
**The moat is the event-annotation layer**: leadership, parties and policy decisions tied
to movements in the valuation series.

## 🚨 The rules that make this product credible

**`docs/00-FIRST-PRINCIPLES.md` is the constitution.** If a number appears in the app and
its lineage cannot be traced to a formula there, that is a bug.

**The 18 invariants in §7 are executable tests** (`engine/invariants.test.ts`), not prose.
Each was earned by a specific documented error mode. Never weaken one to make a test
pass — if a test fails, either the engine is wrong or the test is wrong; work out which
and say so plainly.

The ones most likely to be violated by well-meaning code:

- **Never blend ONS and CWON human capital** — different discount rate, growth assumption
  and age range.
- **Never add listed market cap to national net worth** — it is already inside.
- **Never sum agglomeration value and land value** — same quantity measured twice.
- **Never derive EV/Sales from EV/EBITDA** — different company universes.
- **Startups and countries never emit point estimates** — the `Range` type enforces it.
- **The nightlights-GDP elasticity is 0.28, not 1.**

**Honesty rules specific to this product:**

- Every displayed number carries its source and vintage.
- Figures we could not verify are marked `needsVerification: true` and must not be
  published without a second pass.
- Where our maths disagrees with a published figure, **flag the discrepancy — never fit
  to it.** See the breakeven-revenue case in the test suite.

## Tech stack

- **Build layer:** DuckDB — heavy historical transforms over Parquet/CSV
- **Serve layer:** Supabase Postgres (+ RLS, auth) — live app and saved founder models
- **App:** Next.js
- **Market data:** called live, **never stored** (redistribution is contractually barred —
  see `docs/01-DATA-SPINE.md` §7)

## Commands

```bash
bun test
```

```bash
bunx tsc --noEmit
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
