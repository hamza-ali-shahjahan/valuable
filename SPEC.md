# Valuable — Specification

**Version:** 0.1 · **Date:** 2026-08-14 · **Status:** approved for build

---

## 1. Objective

Build the first working version of Valuable: a valuation platform where **every published
number carries its complete working, and anyone can recompute it and prove we didn't cheat.**

### The positioning this creates

Damodaran publishes spreadsheets. The World Bank publishes methodology PDFs. Nobody
publishes a **per-number, executable, challengeable audit trail.**

That gap is the product. A valuation you can argue with — at the level of a specific step,
not the headline — is a different category of thing from a valuation you must trust. It
turns the two weaknesses we already identified into strengths:

- The headline UK figure is a commodity (journalists reproduced £13.31tn in hours). **The
  trail is not.**
- Every serious country valuation has uncertainty larger than its year-on-year change.
  **Showing the working converts that from an embarrassment into the reason to use us.**

### Target users

| User | What they need | What they do with the trail |
|---|---|---|
| **Founder** raising a round | A valuation and stage-readiness read that survives diligence | Hands the trail to an investor as evidence |
| **Analyst / economist** | A defensible country or metro number | Challenges a step; forks the method |
| **Journalist** | A citable figure with provenance | Links the trail instead of a bare number |
| **Curious reader** | "How much is X worth?" | Sees the per-capita figure and one chart |

### Non-goals for this version

Not building: multi-country ingestion beyond the UK, the metro model outside OECD
coverage, user accounts, payments, or the in-app comment system.

---

## 2. The verifiability architecture

This is the spine. Everything else hangs off it.

### 2.1 Every result carries its derivation

The engine returns values bundled with their working — the same pattern already used for
`Range`. **A bare number cannot reach a page, because it will not type-check.**

```ts
interface Traced<T> {
  readonly value: T;
  readonly trace: Trace;
}

interface Trace {
  readonly hash: string;          // sha256 over the canonical form
  readonly formula: string;       // "NW = P + NP + NFW"
  readonly ref: string;           // "docs/00-FIRST-PRINCIPLES.md §2.1"
  readonly question: string;      // which claim this answers (§2.0)
  readonly inputs: readonly TraceNode[];
  readonly steps: readonly Step[];
  readonly engineVersion: string;
  readonly warnings: readonly string[];   // invariants that fired during computation
}
```

### 2.2 Three kinds of input, and the distinction is the honesty

```ts
type TraceNode =
  | { kind: "observed";   label; value; unit; asOf; source; url?; needsVerification? }
  | { kind: "derived";    label; value; trace: Trace }        // recursion → full DAG
  | { kind: "assumption"; label; value; rationale; ref }      // a judgement we made
```

**`derived` recursing into another `Trace` is what produces the full dependency graph** —
follow any number down to primary sources.

**`assumption` is the important one.** Discount rates, capital shares, terminal growth —
these are judgements, not observations, and they are where a valuation is actually
contestable. They render visually distinct and are the default target of a challenge. A
platform that blurs assumptions into observations is not verifiable, whatever else it does.

### 2.3 The hash, and what makes it meaningful

```
hash = sha256( canonical({ formula, ref, inputs, steps, engineVersion }) )
```

Canonical form requires:

- **Sorted keys** in all objects
- **Fixed-precision number serialisation** — floats do not hash reliably in their native
  representation. Serialise every number to a fixed decimal form before hashing.
- **`engineVersion` pinned** in every hash, so a method change produces a different hash
  rather than silently rewriting history
- **No wall-clock time anywhere in the engine.** `Date.now()` and `new Date()` are banned
  in `engine/`; every `asOf` comes from the data. This is what makes re-runs deterministic.

**The guarantee:** re-run the same inputs on the same engine version, get the same hash. If
a stored number and its trail ever drift apart, the hash catches it. That is the difference
between *transparent* and *verifiable*.

### 2.4 Peer review

Methods, data and the event corpus are **public on GitHub**. A challenge is an issue
against a specific step; an improvement is a pull request.

Every trace node renders a **Challenge this step** control linking to a pre-filled issue:

```
/issues/new?template=challenge.yml
  &title=§2.1 step 4 — discount rate
  &trace=a3f9c2…
  &engine=v0.1.0
```

Two issue templates: `challenge.yml` (dispute a step) and `source.yml` (propose a better
source or a corrected vintage). Both require the trace hash, so every challenge is anchored
to an exact computation rather than a vibe.

**This is also the distribution engine.** Free, forkable and downloadable is precisely why
Damodaran's data spread and why Meritech's comps table mattered until it went behind a login.

---

## 3. Commands

```bash
bun test
```

```bash
bunx tsc --noEmit
```

```bash
bun run verify
```

`verify` walks every published number, recomputes it from its recorded inputs, and asserts
the hash matches. It runs in CI and fails the build on drift.

```bash
bun run dev
```

```bash
bun run ingest:uk
```

---

## 4. Project structure

```
engine/
  core.ts          Range, discounting, the universal identity   [exists]
  trace.ts         Traced<T>, hashing, canonical form           NEW — build first
  constants.ts     verified market constants                    [exists]
  country.ts       four claims, debt dynamics                   [migrate to Traced]
  company.ts       FCFF, cross-sector bridge                    [migrate to Traced]
  startup.ts       VC method, lever simulator                   [migrate to Traced]
  metro.ts         metro identity, EV/GMP diagnostic            NEW
  events.ts        the corpus, evidence tiers                   [exists]
  invariants.test.ts · events.test.ts · trace.test.ts

data/
  uk.ts · uk-events.ts                                          [exists]
  sources/         raw pulls, content-addressed by fetch date   NEW

ingest/
  worldbank.ts · ons.ts · eurostat.ts · sec.ts                  NEW

app/                Next.js
  page.tsx                      index
  country/[iso3]/page.tsx       the four claims, r−g, per-capita, timeline
  metro/[id]/page.tsx           metro value + EV/GMP diagnostic
  simulate/page.tsx             founder lever simulator
  trace/[hash]/page.tsx         ★ the audit trail viewer
  components/TraceTree.tsx      recursive DAG renderer
  components/ChallengeButton.tsx

docs/               00-FIRST-PRINCIPLES · 01-DATA-SPINE · 02-EVENT-CORPUS
.github/ISSUE_TEMPLATE/  challenge.yml · source.yml
```

**`/trace/[hash]` is the signature page.** Every number on every other page links to it.
Design it first, not last.

---

## 5. Code style

Carried from what exists, plus the trace rules:

- **Domain rules are types, not conventions.** `Range` prevents point estimates;
  `NarrativeClaim` has no `estimate` field; `Traced<T>` prevents untraced numbers. If a new
  rule can be expressed in the type system, it must be.
- **Every number carries source and vintage** (INVARIANT 6).
- **Unverified figures are flagged** `needsVerification: true` and are not published.
- **Where our maths disagrees with a published figure, flag it — never fit to it.** The
  Damodaran breakeven discrepancy stays asserted in the tests.
- **No wall-clock time in `engine/`.** Enforced by a lint rule.
- British English in prose; standard financial notation in formulas.
- Comments explain *why*, especially which error mode a guard exists to prevent.

---

## 6. Testing strategy

Current: **105 passing, 0 failing**, typecheck clean. That suite is the safety net for the
`Traced<T>` migration — **all 105 must still pass afterwards.** If a migration step needs a
test weakened, the migration is wrong.

New test classes:

| Class | Asserts |
|---|---|
| **Determinism** | Same inputs + same engine version → identical hash, across 1,000 runs |
| **Drift detection** | Mutating any input changes the hash; mutating `engineVersion` changes the hash |
| **Coverage** | Every value rendered on a page is `Traced`; no bare numbers reach the view layer |
| **DAG integrity** | Every `derived` node resolves; no cycles; every leaf is `observed` or `assumption` |
| **Canonical form** | Key order and float precision produce byte-identical serialisation |
| **Reproduction** | `bun run verify` recomputes every published number and matches |

**Acceptance criteria for this version:**

1. `bun run verify` passes on every published number.
2. The UK page reconciles to **£13.31tn** and its trail resolves to ONS primary sources.
3. Every assumption on the UK page is visually distinct from every observation.
4. A challenge link opens a pre-filled issue carrying the trace hash.
5. All 105 existing invariant tests still pass.
6. No number renders without a trail — enforced by test, not review.

---

## 7. Boundaries

### Always

- Publish the trail with the number. The trail is not a debug view; it is the product.
- Mark assumptions as assumptions.
- Carry source and vintage on every figure.
- Run `/security-check` and a secrets scan **before** the repo goes public.
- Keep the engine deterministic.

### Ask first

- Changing a published method (it changes hashes and therefore history).
- Adding a data source not cleared in `docs/01-DATA-SPINE.md`.
- Anything that would make the repo or the corpus non-public.
- Adding accounts, payments, or storing anything about a user.

### Never

- Publish a number without a trail.
- Store or redistribute market data from a retail API — **contractually barred**
  (Tiingo, EODHD, Alpha Vantage all carry "internal use" clauses). Live calls only.
- Ship Forbes Global 2000 or Fortune 500 as data — compilation copyright. We build our own
  ranking from SEC filings.
- Use BIS data behind a paid tier — their terms require no additional charge to users.
- Use Transparency International CPI in a derived score — likely CC BY-ND, which forbids
  derivative works. Use World Bank WGI Control of Corruption instead.
- Ship anything built on V-Dem until its licence is actually read — its terms page 404s.
- Blend ONS and CWON human capital; add listed market cap to net worth; sum agglomeration
  and land value. (INVARIANTS 10, 12, 11.)
- Publish a country point estimate.
- Weaken an invariant test to make a build pass.

---

## 8. Build order

| # | Deliverable | Why first |
|---|---|---|
| 1 | `engine/trace.ts` + determinism tests | Everything else depends on the shape |
| 2 | Migrate `country.ts` to `Traced<T>` | Proves the pattern on the hardest case; 105 tests are the net |
| 3 | `/trace/[hash]` viewer + `TraceTree` | The signature page — design it before the pages that link to it |
| 4 | `/country/uk` | The reconciliation target |
| 5 | `bun run verify` + CI gate | Makes the guarantee mechanical |
| 6 | Issue templates + challenge links | Opens peer review |
| 7 | `ingest/ons.ts`, `ingest/worldbank.ts` | Replaces hardcoded constants with a real feed |
| 8 | Migrate `company.ts`, `startup.ts`; `/simulate` | The founder side |
| 9 | `metro.ts` + `/metro/london` | Completes the vertical |

**Steps 1–6 are the version.** 7–9 follow immediately but the verifiability claim is
provable at step 6.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| **Float non-determinism breaks hashing** | Fixed-precision canonical serialisation; 1,000-run determinism test in CI |
| **The migration weakens existing guarantees** | All 105 tests must pass unchanged; no test may be edited during migration |
| **Trail is technically correct but unreadable** | The viewer is built at step 3, before the pages — if a reader can't follow the UK trail, the design is wrong |
| **Nobody challenges anything** | Seed it: publish the Damodaran breakeven discrepancy and the eight refuted figures as open issues on day one |
| **Method changes orphan old hashes** | `engineVersion` in every hash; keep old versions resolvable rather than rewriting |
