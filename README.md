# Valuable

**Real-time valuation intelligence — what a country, a city, a company or your startup is
actually worth, and which decisions moved the number.**

---

## Why this exists

On 12 August 2026, in reply to a satirical piece about buying the United Kingdom, Elon
Musk asked: *"How much is it?"*

Journalists answered within hours — **£13.31 trillion** — by reading a free
[ONS bulletin](https://www.ons.gov.uk/economy/nationalaccounts/uksectoraccounts/bulletins/thenationalbalancesheetandcapitalstockspreliminaryestimatesuk/2026).

That is the whole problem. **The headline number is not defensible intellectual
property.** Anyone can publish it, and the news cycle lasts two days.

What nobody sells is the layer underneath: *which leaders, which parties, which specific
decisions moved the line, and by how much.* That is what this is.

And the same engine that answers it for a country answers it for a founder asking
"what is my startup worth, and which lever do I move next?" — because, as
[the first-principles document](docs/00-FIRST-PRINCIPLES.md) argues, those are the same
calculation.

---

## The idea in one equation

Every valuable entity — a nation, a metropolis, a listed corporation, a two-person
startup — is a capital stock that earns a return:

```
V₀  =  IC₀  +  Σ  (ROIC_t − WACC_t) · IC_{t−1}  /  Π (1 + WACC_s)
       ↑        └──────────── present value of economic profit ─────────┘
   what you have         what you do with it
```

| | Country | City | Company | Startup |
|---|---|---|---|---|
| **IC** | Produced + natural + human capital | Metro capital stock | Invested capital | ≈ 0 |
| **ROIC** | GDP / capital stock | GMP / metro capital | NOPAT / IC | Projected |
| **WACC** | Sovereign rate + risk premium | Sovereign + metro spread | CAPM build-up | Total-beta build-up |

When `IC → 0` (a startup), it collapses to pure DCF — which is exactly why startup
valuation feels unfalsifiable: there is no balance sheet to anchor it.

**And the rate of change is the product.** Both sensitivities are magnified by
`1/(r−g)`, so at a 3% spread a 100bp move changes value by ~33%. That is why leadership
and policy shocks hit through the *discount rate*, not through cash flows — and why they
hit in seconds while GDP data lags by quarters.

---

## Status

**149 countries, every number checkable.** 201 tests passing, typecheck clean, all 303
published calculations verified.

```bash
bun test
```

| | |
|---|---|
| [`docs/00-FIRST-PRINCIPLES.md`](docs/00-FIRST-PRINCIPLES.md) | The constitution — every formula, sourced. If a number can't be traced here, it's a bug. |
| [`DATA-LICENCES.md`](DATA-LICENCES.md) | What we use, and the obvious sources we deliberately refuse |
| [`docs/01-DATA-SPINE.md`](docs/01-DATA-SPINE.md) | 10 verified free sources, licences, landmines, do-not-ship list |
| `engine/` | Core identity, country, company, startup |
| `engine/invariants.test.ts` | The 18 invariants, as executable tests |
| `data/uk.ts` | Verified UK + London reference data |

**Proof it works:** our UK balance sheet reconciles to the official figure —
`£6.6tn + £6.9tn − £0.1998tn = £13.30tn` against a published **£13.31tn**. Every one of
the 149 country valuations recomputes to its recorded fingerprint.

```bash
bun run verify
```

**Not built yet:** cities, companies and the founder simulator (the engines exist,
unpublished); a researched event history for anywhere except the UK; and anything after
2020, which is the most recent year the World Bank publishes wealth accounts for.

---

## Three things this product refuses to do

Most valuation tools quietly do all three.

**1. Publish one number for a country.** *"How much is the UK worth"* has four
defensible answers spanning an order of magnitude:

| Claim | UK |
|---|---|
| Listed equity (FTSE All-Share) | £2.74tn |
| National net worth (ONS balance sheet) | **£13.31tn** |
| + human capital (comprehensive wealth) | ≈ £38.8tn |
| Sovereign fiscal capacity | ≈ zero / negative |

Averaging those is a category error. We publish them side by side, each labelled with
the question it answers.

**2. Emit a point estimate where the uncertainty is bigger than the signal.** Human
capital moves ~1:1 with the discount rate. Natural capital *doubles* when the rate goes
4% → 2%. Every one of those swings is larger than the year-on-year change a tracker
reports. Startup and country valuations return a `Range` — enforced by the type system,
not by discipline.

**3. Accept a top-down TAM.** *"The global market is $Y trillion and we'll take 2%"* is
the single most common fundraise-killer. The simulator throws.

---

## Honesty rules

- Every displayed number carries its **source and vintage**.
- Figures we could not verify are flagged `needsVerification` and are not published.
- **Where our maths disagrees with a published figure, we flag it — we never fit to it.**
  One such gap is live right now: Damodaran's published Nvidia breakeven revenue is
  $483.38bn; the plain Gordon inversion of his four stated inputs gives $362.8bn. The
  test suite asserts *that the gap exists* rather than tuning a coefficient until it
  disappears.

---

## Data

Contains information from the World Bank's *World Development Indicators* and *The
Changing Wealth of Nations 2024*, licensed under CC BY 4.0. UK figures contain public
sector information licensed under the Open Government Licence v3.0. Full attribution and
the list of sources we deliberately refuse: [DATA-LICENCES.md](DATA-LICENCES.md).

Code is MIT. **The data is not ours to relicense** — if you take `data/sources/`, you
inherit the World Bank's attribution obligation.

## Contributing

The most useful things anyone can do, roughly in order:

1. **Verify a figure we've held back.** Anything flagged unchecked is withheld from
   publication until someone confirms it against a primary source.
2. **Add an event to a country's timeline.** Only the UK has one. Every other country's
   history of what moved its number is empty.
3. **Challenge a step.** Every number links to its working, and every line of that
   working can be disputed on its own with the fingerprint attached.
4. **Correct a licence**, in either direction.

---

Built with [Hamzaish](https://github.com/hamza-ali-shahjahan/hamzaish).
