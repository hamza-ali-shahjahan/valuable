# The Event Corpus — claiming causality without overclaiming

> This is the moat. It is also the easiest part of the product to get dishonestly wrong.

**Status:** v0.1 — schema settled, UK 2016–2026 loaded. 105 tests passing.

---

## 1. The problem

Nobody sells a decade-long, country-by-country timeline tying leadership changes,
elections, budgets and policy shocks to movements in a valuation series. That absence is
the opportunity (§1.3 of the first principles: policy hits through the discount rate,
instantly, and $\partial V/\partial r$ scales as $V/(r-g)$).

But the reason nobody sells it is not that nobody thought of it. **It is that doing it
honestly is hard, and doing it dishonestly is worthless.**

Across the 13 policy episodes we researched, identification quality varies enormously:

| Episode | Identification | Can we state an effect size? |
|---|---|---|
| Brexit | Synthetic control + placebo inference; DiD on HMRC microdata; firm panels | ✅ Yes |
| EU accession (Poland/Baltics) | Synthetic counterfactuals, anticipation-dated treatment; RD at the Objective 1 threshold | ✅ Yes |
| China reform | Staggered-rollout DiD; scheduled-tariff DiD; shift-share IV | ✅ Yes |
| Estonia's distributed-profits tax | DiD vs Latvian/Lithuanian firms + PSM | ✅ Yes |
| Greece austerity | Ex-ante consolidation plans vs ex-post growth errors | ✅ Yes |
| Venezuela under Chávez | Synthetic control | ✅ Yes |
| **Singapore** | **None — N=1, no counterfactual** | ❌ **No** |
| **Saudi Vision 2030** | **None** | ❌ **No** |
| **Rwanda post-1994** | **None, and the outcome data is disputed** | ❌ **No** |
| **Ireland's 12.5% rate** | **None for the rate specifically** | ❌ **No** |

A product that renders all ten rows as "policy X moved value by Y%" is lying with a
straight face. Half of the most-cited development success stories in the world have no
counterfactual behind them.

---

## 2. The design decision

**The evidence tier is structural, not a label.**

A `NarrativeClaim` has no `estimate` field. Not an optional one — none. It is impossible
to construct a narrative claim carrying a number, so it is impossible to forget to
downgrade one.

```
MeasuredEffect   → has estimate, requires strategy + identification + citation
NarrativeClaim   → has direction and mechanism, requires whyNotIdentified
                   ↳ NO estimate field exists
```

`effectSize(claim)` is the single accessor at every render boundary. Given a narrative
claim it **throws** (`INVARIANT 19`), naming the mechanism and the reason it isn't
identified. `effectSizeOrNull()` is the display-safe variant.

Two further guards:

- **`official_assumption` is registered as having no counterfactual.** The OBR's 15%
  trade-intensity and 4% productivity figures are authoritative, load-bearing for UK
  fiscal policy — and *assumptions*, adopted as judgement. They are stored as narrative.
  Authority is not identification.
- **`assertIdentificationStated()`** rejects a measured claim whose identification string
  is too thin to audit. "synthetic control" is not an identification; naming the donor
  pool, the fit window and the inference test is.

---

## 3. What a corpus entry contains

Every event carries: ISO date (to the day — markets reprice in hours), category, the
**leader and party in office**, and one or more claims. Measured claims carry strategy,
identification, estimate, range across specifications, inference, and citation.

Market responses are stored **separately from causal claims**, because an observed price
move is not a causal estimate. The mini-budget is the clean case: sterling's move is
recorded precisely, and the claim about it is narrative, because no published design
separates it from the concurrent global rate cycle.

---

## 4. Refuted figures are first-class data

Eight widely-circulated numbers did not survive verification. They are stored in
`REFUTED_FIGURES` **because** they are plausible, repeated and wrong — which makes them
likely to be re-introduced by a future contributor or a model:

| Circulating claim | Correction |
|---|---|
| Brexit cut inward FDI 37% | 16–20% (Serwicka & Tamberi). The −37% has no traceable source. |
| US FDI in Ireland > $1tn | $466.8bn (BEA historical cost). Conflates measurement bases. |
| Estonia's e-government saves >2% of GDP | Absent from every current primary page — the state agency itself now frames savings only in working time |
| Ireland's 2015 growth was 25.2%/26.3% | 24.6% on the current Eurostat vintage |
| Poland's 2004–24 growth was 130–160% | +107.5% on chain-linked volumes |
| Turkey's hike to 24% was 24 Sep 2018 | Decided 13 Sep, effective 14 Sep |
| Argentina's poverty was 38.1% in H1 2025 | That is H2 2024; H1 2025 was 31.6% |
| Estonia's 2022–24 recession was −0.5/−3.0/−0.3 | −1.2/−2.7/−0.1 on the current vintage |

**The pattern across all eight is vintage and basis error** — not fabrication. A figure
that was correct on publication becomes wrong when the series is revised, and it keeps
circulating. This is precisely why INVARIANT 6 requires source *and vintage* on every
number.

---

## 5. Contestation is stored, not resolved

Narrative episodes carry a `contestation` array. Rwanda is the instructive case: the
growth story is real in the official data, and the FT's 2019 investigation found that
recalculating EICV3→EICV4 with a consistently constructed price deflator **reverses the
sign** on poverty. Sam Desiere shows the deflator choice drives the result. EICV7 changed
methodology, so spliced trend lines are invalid. And Doing Business — on which much of
the reform narrative rests — was discontinued by the World Bank in September 2021 after
data irregularities.

We do not adjudicate this. We store it, and the page shows it.

---

## 6. What the corpus is used for

1. **Explaining $\Delta$ in the valuation series** — the fastest-moving and
   largest-magnitude term in the change decomposition (§1.3).
2. **The comparison the product is actually for** — "who else did this, and what
   happened?" answered with the identification quality attached.
3. **Training the founder simulator's intuitions** about which levers have evidence
   behind them and which are folklore.

---

## 7. Open

- Extend beyond the UK. Priority order by identification quality: Poland/Baltics
  accession, China's WTO entry, Estonia's corporate tax, Greece.
- Two literature strands to encode as priors rather than events: Acemoglu-Johnson-Robinson
  (institutions explain ~three-quarters of income differences among former colonies;
  2SLS 0.94, s.e. 0.16) and Hausmann-Pritchett-Rodrik growth accelerations (83 episodes,
  ~2.7%/yr unconditional probability — and *"the vast majority of growth accelerations
  are unrelated to standard determinants such as political change and economic reform"*).
  That last finding is a caution against the whole genre, and belongs in the product.
- Sourcing at scale: V-Dem, ParlGov and the Manifesto Project are the candidate machine-
  readable leadership/party datasets. **V-Dem's licence is genuinely unverified** — its
  terms page 404s. Read it before shipping.
