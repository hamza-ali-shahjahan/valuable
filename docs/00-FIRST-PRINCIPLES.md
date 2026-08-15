# Valuable — First Principles

> The equations. Everything in this product is derived from this document.
> If a number appears in the app and its lineage cannot be traced to a formula here,
> that is a bug.

**Status:** v0.1 — foundations. Constants verified against live sources 2026-08-14.

---

## 0. The problem statement

Four questions that look different and are the same question:

1. *How much is the UK worth?* (Musk, 12 Aug 2026)
2. *How much is London worth?*
3. *How much is Shell worth?*
4. *How much is my seed-stage startup worth, and what do I move next?*

Existing tools answer these in four disconnected places with four disconnected methods.
The World Bank values countries (4-year lag, PDF). Dealroom values city ecosystems
(£10k/yr, sold to governments). companiesmarketcap values public companies (free, ads).
Equidam values startups (free number, paid report).

**Nobody has written down the identity that makes all four the same calculation.**
That identity is section 1. It is the reason this product can exist as one engine
rather than four.

---

## 1. The Universal Value Identity

Every valuable entity — a nation, a metropolis, a listed corporation, a two-person
startup — is a **capital stock that earns a return**. Its value is what it owns, plus
the present value of the excess return it earns on what it owns.

### 1.1 The identity

$$
V_0 \;=\; \underbrace{IC_0}_{\text{invested capital}} \;+\; \underbrace{\sum_{t=1}^{\infty} \frac{\left(ROIC_t - WACC_t\right)\cdot IC_{t-1}}{\prod_{s=1}^{t}\left(1+WACC_s\right)}}_{\text{present value of economic profit}}
$$

Where:

| Term | Meaning | Country | City | Company | Startup |
|---|---|---|---|---|---|
| $IC$ | Invested capital | Produced + natural + human capital | Metro capital stock | Invested capital (book) | ≈ 0 |
| $ROIC$ | Return on that capital | GDP / capital stock | GMP / metro capital | NOPAT / IC | Projected, negative today |
| $WACC$ | Risk-adjusted required return | Sovereign real rate + risk premium | Sovereign + metro spread | CAPM build-up | Total-beta build-up |
| $g$ | Growth of the base | Real GDP growth | Metro GDP growth | Revenue growth | Revenue growth |

This is the residual-income (EVA) formulation. It is algebraically identical to
discounted cash flow — no information is added or lost — but it is the *right* form
for this product for three reasons:

1. **It separates what you have from what you do with it.** $IC$ is measurable and
   slow. The spread $(ROIC - WACC)$ is where policy, leadership and execution live.
2. **It makes the intangible explicit.** Rearranged:

   $$\text{Institutional / intangible capital} \;=\; V_0 - IC_0$$

   For the UK this is the gap between the NPV of the economy and the ONS balance
   sheet. For a company it is goodwill and moat. For a startup it is *the entire
   valuation*, which is precisely why startup valuation feels unfalsifiable — there
   is no $IC$ term to anchor it.
3. **It degrades gracefully.** When $IC \to 0$ (startup), the identity collapses to
   pure DCF. When the spread $\to 0$ (a mature commodity economy), it collapses to
   the balance sheet. Both are correct limits, not special cases.

### 1.2 The three lenses, and why we always show all three

Any entity gets valued three ways, and **the disagreement between them is the signal**:

$$
V^{\text{stock}} = \sum \text{assets at market} - \sum \text{liabilities}
$$
$$
V^{\text{flow}} = \sum_{t} \frac{CF_t}{(1+r)^t} \cdot P(\text{survival}_t)
$$
$$
V^{\text{comp}} = m \times X \quad\text{where } X \in \{\text{revenue, ARR, EBITDA, GDP}\},\; m = \text{peer multiple}
$$

We publish all three plus the spread between them. A country whose $V^{flow}$ far
exceeds $V^{stock}$ has strong institutions relative to its physical endowment
(Singapore). The reverse signals underused endowment (resource-rich, institution-poor).
**This spread is a product feature no competitor ships.**

### 1.3 The decomposition of change — the heart of the tracker

The user's actual question is not "what is it worth" but "what moved it, and who
moved it." Totally differentiate the identity:

$$
\frac{dV}{V} \;=\; \underbrace{\frac{\partial V}{\partial IC}\frac{dIC}{V}}_{\text{investment}} \;+\; \underbrace{\frac{\partial V}{\partial ROIC}\frac{dROIC}{V}}_{\text{productivity}} \;+\; \underbrace{\frac{\partial V}{\partial g}\frac{dg}{V}}_{\text{growth}} \;+\; \underbrace{\frac{\partial V}{\partial WACC}\frac{dWACC}{V}}_{\text{risk repricing}}
$$

For a perpetuity $V = CF/(r-g)$ the sensitivities are:

$$
\frac{\partial V}{\partial g} = \frac{CF}{(r-g)^2} = \frac{V}{r-g}
\qquad
\frac{\partial V}{\partial r} = -\frac{CF}{(r-g)^2} = -\frac{V}{r-g}
$$

**Both are magnified by $1/(r-g)$.** With $r-g = 3\%$, a 100bp move in either
direction changes value by ~33%. This is the single most important number in the
entire product and it explains the central empirical fact:

> **Leadership and policy shocks hit valuation through $WACC$, not through cash flows —
> and they hit it instantly.**

GDP revises quarterly with a lag. Sovereign yields, CDS spreads and FX reprice in
seconds. Truss's mini-budget did not change UK productivity; it changed the discount
rate applied to it. Brexit's measured GDP effect took years; the risk repricing took
hours.

**Therefore:** the event-annotation layer is not decoration on the time series. It is
the causal explanation of the $\Delta WACC$ term, which is the fastest-moving and
largest-magnitude term in the decomposition. This is the moat.

---

## 2. Countries

### 2.0 The question is ill-posed until you name the claim

> **"How much is the UK worth?" has four different right answers spanning an order of
> magnitude.** This is the single most important architectural decision in the product.

| Claim being valued | UK value | Basis |
|---|---|---|
| National net worth (SNA balance sheet) | **£13.3tn** | ONS 2025, verified |
| + human capital (Jorgenson–Fraumeni) | **≈ £38.8tn** | ONS NBS + ONS HC |
| Government's net fiscal claim (sovereign DCF) | **≈ zero / negative** | Jiang et al. method |
| Listed equity (FTSE All-Share) | **£2.74tn** | Mar 2026, verified |

Averaging these is a **category error** — they answer three different questions about
three different claims. We therefore publish them side by side, each labelled with the
question it answers, and we never blend them into one headline.

**The uncomfortable structural fact about the headline number:** land is £6.9tn of the
UK's £13.3tn — **52%**. The 2023 fall (−2.0%) and the 2024 rise (+5.6%) are almost
entirely house-price driven. *The ONS national balance sheet is a house-price index in
disguise.* That is a feature if you want a market-consistent number and a fatal flaw
if you want to measure productive capacity. We say so on the page.

### 2.1 Method C1 — National Balance Sheet (the stock lens)

$$
V^{\text{NBS}} = K_{\text{produced}} + K_{\text{natural}} + K_{\text{financial}}^{\text{net}} + NFA - L
$$

**Verified anchor (UK, ONS, published June 2026):** net worth **£13.31 trillion** for
2025, up £215.6bn from £13.1tn in 2024. Sector split: households **£11.16tn**,
corporations **£2.92tn**, government **−£761bn**.

This is the number journalists reached for within hours of Musk's question. It is
free, official, and reproducible — which is exactly why it cannot be the product.
It is our *reconciliation target*, not our output.

Note what it excludes: **human capital**. The ONS balance sheet counts buildings and
bonds, not people. That omission is most of why $V^{flow} \gg V^{NBS}$ for advanced
economies.

### 2.2 Method C2 — Comprehensive Wealth (World Bank CWON)

$$
V^{\text{CWON}} = K_{\text{produced}} + K_{\text{natural}} + K_{\text{human}} + NFA
$$

Human capital via the Jorgenson–Fraumeni lifetime-income approach:

$$
K_{\text{human}} = \sum_{a=a_0}^{R}\sum_{t} \frac{w_{a,t}\cdot L_{a,t}\cdot S_{a,t}}{(1+\rho)^{t}}
$$

where $w$ = age-specific earnings, $L$ = employment rate, $S$ = survival probability,
$\rho$ = social discount rate (CWON uses 4%).

CWON 5th edition covers **151 countries, 1995–2020**, published 2024.
**Licence: CC-BY 4.0 — commercial use permitted with attribution.** This is the single
most product-viable dataset in the field. **The four-year lag is our opening** — we
nowcast the same construct to the current quarter, and say plainly that we are
extrapolating past the frontier of the underlying research.

Global composition (2020, verified): human capital **60%**, produced **32%**,
renewable natural **6%**, nonrenewable natural **2%**.

> #### ⚠️ Two breaking caveats, both encoded as invariants
>
> **1. CWON 2024 is not comparable to CWON 2021.** The 2024 edition *discontinued the
> wage-growth factor* entirely (on the grounds it was inconsistent with the no-growth
> rent assumption applied to natural capital, and exaggerated human capital's share).
> Any time series spanning editions is broken.
>
> **2. Never blend ONS and CWON human capital.** ONS uses $r=3.5\%$ **with** 2%
> productivity growth (effective net discount ≈1.5%), ages 16–65. CWON uses $r=4\%$
> with **zero** growth, ages 15–65. Mixing them is an apples-to-oranges error — and it
> is the most likely error a product in this space will make.

**The discount rate *is* the uncertainty.** ONS states that a 1pp change in $r$ produces
a near-1:1 magnitude change in the opposite direction in the human capital stock. CWON's
own experiment: moving renewables from 4% to 2% raises their share of global wealth from
**5.7% to 11.8% — more than double**. A single discount-rate choice moves a headline
component by 100%.

### 2.3 Method C3 — Sovereign fiscal capacity (the flow lens)

This values the **government's claim**, not the territory's contents. It is the only
method that answers "what is the *state* worth."

**Debt dynamics — the exact recursion:**

$$
d_{t+1} = d_t\cdot\frac{1+r}{1+g} - pb_{t+1}
$$

**Debt-stabilising primary balance:**

$$
pb^{*} = d_t\cdot\frac{r-g}{1+g}
$$

The term $d_t(r-g)/(1+g)$ is the **snowball**. When $r<g$ it is negative and a
government can run permanent primary deficits with stable debt (Blanchard 2019).

**Fiscal capacity (Jiang, Lustig, Van Nieuwerburgh & Xiaolan, NBER WP 29902).**
Impose transversality on the intertemporal budget constraint:

$$
\frac{B_t}{P_t} = \mathbb{E}_t\left[\sum_{s=1}^{\infty} M_{t,t+s}\,S_{t+s}\right]
$$

The critical move: surpluses are discounted at the expected return on a **claim to
GDP**, embedding a GDP risk premium — *not* at the Treasury curve, because the cash
flows are risky. Empirically the tax claim is riskier than the GDP claim (taxes fall
in recessions) and the spending claim is safer.

**Verified US result** (CBO 2022–2051 projections):

| Quantity | Value |
|---|---|
| PDV of projected deficits 2022–2051 | −$21.6tn |
| Upper bound on fiscal capacity | ≈ $10tn |
| + convenience-yield seigniorage | +$3.66tn |
| **Total fiscal capacity** | **≈ $13.7tn = 60% of GDP** |
| Actual market value of Treasuries | **$23.5tn** |

**US fiscal capacity is below its debt.** Steady-state identity: fiscal capacity =
(P/D on the total wealth portfolio) × steady-state surplus, with **P/D ≈ 65** at
end-2021.

**Duration mismatch — the most underrated sovereign risk metric.** Projected surpluses
are back-loaded, so the surplus claim has duration **>50 years** against a Treasury
portfolio duration of ~5 years. A +100bp yield move requires a permanent surplus
increase of **>2.9% of GDP**.

**Fiscal fatigue (Ghosh et al. 2013).** The primary balance responds positively to debt
at moderate levels, then flattens and fails — producing an endogenous debt limit
$\bar{d}$. Fiscal space $= \bar{d} - d_{\text{projected}}$. Empirically fatigue sets in
around **100% of GDP**.

**Worked UK example (OBR March 2026, verified):** PSND 94.5% of GDP; debt interest
£106bn = 3.6% of GDP ⇒ effective $r \approx 3.8\%$; nominal $g \approx 3.5\%$ ⇒
$r-g \approx +0.3\text{pp}$.

$$pb^{*} = 0.945 \times \frac{0.003}{1.035} = 0.27\%\text{ of GDP}$$

Stress to $r=5.0\%$, $g=3.0\%$ ($r-g = 2\text{pp}$):

$$pb^{*} = 0.945 \times \frac{0.020}{1.03} = 1.83\%\text{ of GDP}$$

A 1.7pp swing (~£50bn/year) from a plausible rate move. **The entire UK fiscal
position is a leveraged bet on $r-g$.**

> ### $r-g$ is the master variable
> It sets the multiple $1/(r-g)$, the snowball sign, and the debt-stabilising primary
> balance **simultaneously**. It goes on the front page of every country. For the UK it
> is currently **+0.3pp**.

### 2.4 Method C4 — Market-based ⚠️ *demoted: signal only, never a level*

$$
V^{\text{mkt}} = MC_{\text{listed}} + \hat{V}_{\text{unlisted}} + V_{\text{state}}
$$

**We do not use this as a valuation level.** Three disqualifying defects:

1. **Double counting.** Listed equity is *already inside* the ONS balance sheet — as
   corporate assets net of liabilities and in household financial assets. Adding market
   cap to national net worth double-counts.
2. **Listing bias.** The FTSE All-Share is dominated by miners, banks, energy and pharma
   with overwhelmingly *foreign* revenue. It measures "companies domiciled in the UK,"
   not "the UK economy." The UK is the worst major market for this distortion.
3. **Method spread.** The Buffett indicator read **218–250% for the same US quarter**
   depending on numerator definition. A 32pp spread on an identical period is
   disqualifying.

Use it as a **momentum/sentiment signal**. Never as a component of a sum-of-the-parts.

### 2.4b Why the "GDP × multiple" headline is circular

There are no country transactions, so no empirical comparable exists. The only
defensible multiple is the Gordon identity:

$$
\frac{V}{GDP} = \frac{1}{r-g}
$$

**Any product publishing a "GDP × multiple" headline is publishing $1/(r-g)$ with extra
steps.** The multiple is not an independent input; it is a restatement of the discount
rate. At $r-g$ = 1%, 1.5%, 2%, 3% the multiple is 100×, 67×, 50×, 33× — a **3× range
from a 2pp assumption**. Its only honest use is as a sensitivity axis, which is how we
ship it.

### 2.5 The country discount rate

$$
r_s = R_f + CRP, \qquad CRP = \text{default spread} \times \frac{\sigma_{\text{equity}}}{\sigma_{\text{bond}}}
$$

**Verified constants (Damodaran, 2026 edition):**

| Constant | Value | As of |
|---|---|---|
| Risk-free rate ($R_f$, US 10y) | **4.18%** | 1 Jan 2026 |
| Implied ERP (S&P 500) | **4.23%** | 1 Jan 2026 |
| Expected return on stocks | 8.41% | 1 Jan 2026 |
| Risk-free rate | **4.74%** | 1 Aug 2026 |
| Implied ERP | 4.23% | 1 Aug 2026 |
| Expected return on stocks | 8.97% | 1 Aug 2026 |
| Mature-market ERP | **4.20%** | 1 Jul 2026 |
| US default spread (Aa1) | 0.22% | 2026 |
| Equity/bond volatility multiplier | **1.55** | 2026 |

Independently reconciled: Software (System & Application) cost of equity
$4.18\% + 0.91 \times 4.23\% = 8.03\%$ vs Damodaran's published 8.02%. The dataset
is internally consistent and our constants are correct.

### 2.5b Method defensibility ranking

| Rank | Method | Verdict | Why |
|---|---|---|---|
| **1** | National balance sheet (ONS / Fed Z.1 / Eurostat) | **Build on this** | Official, audited, SNA-standard, annual. Caveat: 52% land for the UK. |
| **2** | CWON comprehensive wealth | **Yes, with bands** | Only 151-country consistent frame; CC-BY 4.0. Ends 2020; single 4% rate; 2024 HC break. |
| **3** | Sovereign fiscal capacity | **Yes, as a separate number** | Theoretically exact for the *government* claim. Different question. |
| **4** | Human capital NPV | **Yes, as a component** | Well-specified. But it is 60% of global wealth and swings ~1:1 with $r$ — it *is* the uncertainty. |
| **5** | Natural capital | Partly | Fine for subsoil/timber/fisheries; ecosystem services are modelled, not observed. |
| **6** | Market cap sum-of-parts | **No** | Double counting, listing bias, 218–250% method spread. |
| **7** | GDP × multiple | **No, as a headline** | It is $1/(r-g)$ restated. Sensitivity axis only. |

### 2.6 Country composite — three numbers, never one

We publish **three separate numbers with bands**, each labelled with the question it
answers. Blending them is a category error (§2.0):

1. **Balance-sheet value** — "what the country owns today." UK **£13.3tn**. Band ±5%
   (measured, not modelled).
2. **Comprehensive wealth** — "productive capacity including people and nature." UK
   **≈£39tn**. Band **±35%**, dominated by the human-capital discount rate.
3. **Sovereign fiscal capacity** — "what the state's claim is worth." Wide band,
   frequently near zero or negative.

Plus the **spread** $V^{flow}/V^{stock}$ as the institutional-capital ratio, and the
**per-capita denominator** on all three.

**Uncertainty bands are computed from verified sensitivities, never symmetric ±10%
placeholders:**

| Component | Shock | Effect |
|---|---|---|
| Human capital | ±1pp on $r$ | ≈∓25–30% (ONS: near 1:1) |
| Natural capital (renewable) | 4% → 2% | **+107%** (CWON's own experiment) |
| Sovereign capacity | +100bp | >2.9% of GDP permanent adjustment required |
| Balance sheet | ±10% house prices | ≈±5% of UK net worth (land is 52%) |

**Every one of these sensitivities is larger than the year-on-year change we would be
reporting.** A £13.3tn headline that moves ±35% on one assumption is a liability, not a
product. Hence invariant #9.

---

## 3. Cities and metros

### 3.0 A city is not a firm — five non-interchangeable claims

No residual claimant, no share count, and the most valuable asset (people) can walk
out. Five distinct answers:

| Lens | What it values | Who owns it |
|---|---|---|
| Flow (GMP × multiple) | Income produced inside the boundary | Nobody — an accounting flow |
| Land + structures | The immobile physical stock | Property owners |
| Municipal balance sheet | The government's net position | Taxpayers / bondholders |
| Human capital | NPV of residents' lifetime earnings | **The residents themselves** |
| Hosted enterprise value | Market cap of firms HQ'd there | **Global shareholders, not the city** |

### 3.1 ⚠️ The double-counting identity — the trap we must not fall into

Land value is *definitionally* the capitalised residual of agglomeration and amenity
rents:

$$
V_{\text{land}} = NPV\big(\text{agglomeration rent} + \text{amenity rent} + \text{public-goods rent}\big) - NPV(\text{construction cost})
$$

**Agglomeration analysis (§3.2) and aggregate land value are the same quantity measured
twice** — once from the cause side, once from the effect side. Summing them
double-counts. In long-run spatial equilibrium $V_{\text{agglom}} \approx K_{\text{land}}$.

The defensible aggregate is therefore:

$$
W^{\text{metro}} = H_{\text{human}} + K_{\text{structures}} + K_{\text{land}} + K_{\text{infra}} + K_{\text{firm intangible}}
$$

with the explicit rule that **$K_{\text{land}}$ already contains all agglomeration and
amenity value**, and $H_{\text{human}}$ is the residents' claim, not the city's.

**Scale anchor:** Savills puts global real estate at **$393.3tn** end-2024 (residential
$286.9tn, commercial $58.5tn, agricultural $47.9tn) ≈ **4× global GDP**. So for a mature
metro, real estate ≈ **3.5–4.5× GMP**, and deviation from that ratio is itself the
diagnostic.

### 3.2 The flow multiple — and why the naive version is wrong

$$
V = GMP_0\cdot\frac{1+g}{r-g}
$$

At $g=3\%$, $r=7.5\%$ this gives **22.9×**. **This is wrong as a value** — GVA is not
free cash flow to any owner, because the labour share is a claim held by *mobile
people*. Only the capital share is a claim on immobile assets:

$$
V^{\text{capital}} = \alpha\cdot GMP\cdot\frac{1+g}{r-g}, \qquad \alpha \approx 0.35
$$

⇒ **8.0 × GMP**, and cross-checked against Savills the defensible band for
non-human-capital metro wealth is **4–8× GMP**, with 8× a *ceiling*, not a central case.

### 3.3 Agglomeration — the verified elasticity

$$
\ln y_c = \alpha + \gamma\ln N_c + \delta X_c + \varepsilon_c, \qquad \text{premium per doubling} = 2^{\gamma}-1
$$

| Study | Data | $\gamma$ | Premium |
|---|---|---|---|
| Combes, Duranton, Gobillon, Puga & Roux (2012, *Econometrica*) | 341 French employment areas, 1994–2002 | **0.025** (R²=0.33) | **+1.7%** |
| Same, literature survey | across methods | 0.02–0.10 | +1.4% to +7.2% |
| Combes et al. (2008) OLS → worker fixed effects | French workers | 0.051 → **0.027** | **sorting explains ~half** |
| Melo, Graham & Noland (2009) meta-analysis, 729 estimates | mixed | ≈0.058 | +4.1% |

**Headline: a doubling of metro size raises productivity ~2–5%, with 3% modal after
controlling for worker sorting.** The raw cross-sectional gap is 2–3× larger; ~half is
sorting. **Naive metro GDP-per-capita comparisons overstate the causal city effect by
roughly 2×** — we correct for this.

CDGPR (2012) further show firm *selection* cannot explain spatial productivity
differences, so the agglomeration premium is real value creation, not survivorship —
and therefore legitimately capitalisable into land.

**Industry concentration is a risk metric, not a value metric.** Glaeser, Kallal,
Scheinkman & Shleifer (1992) found diversity and local competition promote growth while
within-industry specialisation retards it. High HHI therefore raises $r$; it does not
lower $g$.

### 3.4 Housing supply elasticity — the parameter that decides everything

Saiz (2010), 269 US metros, terrain within 50km, land undevelopable if underwater or
>15% grade:

$$
\Delta\ln P = \frac{D}{1+\varepsilon}, \qquad \Delta\ln Q = \frac{D\varepsilon}{1+\varepsilon}
$$

An identical demand shock puts **60% into prices** in San Francisco ($\varepsilon\approx0.66$)
and **28%** in Atlanta ($\varepsilon\approx2.55$).

> **Inelastic metros convert growth into land value; elastic metros convert it into
> population.** Two entirely different value trajectories from the same shock. This
> single parameter explains most of the Sunbelt/coastal divergence — and why Austin's
> boom produced falling rents.

### 3.5 Rosen–Roback — recovering amenity value

Household indifference and firm zero-profit must both hold across cities:

$$
V(w_c, r_c, A_c) = \bar{V}, \qquad C(w_c, r_c, A_c) = 1
$$

Totally differentiating and applying Roy's identity / Shephard's lemma:

$$
QOL_c = s_h\,d\ln r_c - s_w\,d\ln w_c
\qquad
TFP_c = \theta_L\,d\ln w_c + \theta_R\,d\ln r_c
$$

with $s_h\approx0.24$–$0.33$, $s_w\approx0.75$–$0.80$, $\theta_L\approx0.65$–$0.80$,
$\theta_R\approx0.025$–$0.05$.

**The identification trick: because $\theta_R$ is small, rents load almost entirely onto
amenities and wages almost entirely onto productivity.**

| | High rents | Low rents |
|---|---|---|
| **High wages** | Highly *productive* (SF, NY) | Unpleasant but productive (oil-boom towns) |
| **Low wages** | High *amenity* (San Diego, Honolulu) | Low productivity, low amenity (declining metros) |

### 3.6 The diagnostic ratio — hosted enterprise value ÷ GMP

| Metro | Combined EV (Dealroom) | Metro GDP | **EV/GMP** |
|---|---|---|---|
| Bay Area | $20.0tn | ~$1.26tn | **≈16×** |
| Austin | $2.0tn | ~$0.25tn | ≈8× |
| Seattle | $2.9tn | ~$0.50tn | ≈5.8× |
| London | $712bn | $790.6bn | **0.90×** |
| New York MSA | $1.3tn | $2.443tn | **0.53×** |

> **This is the single most diagnostic number in metro valuation.** Above ~5 the metro
> is an **exporter** of globally-traded enterprise value — and that value accrues to
> non-resident shareholders, only weakly attached to the tax base or land. Below ~1 it
> is a **rentier** metro capturing value locally through wages, rents and taxes.
>
> It explains the 2020–2024 divergence better than any migration statistic: Bay Area
> enterprise value hit all-time highs while San Francisco's municipal and real-estate
> value fell — **because the two were never the same asset.**

⚠️ Never mix Dealroom and Startup Genome ecosystem values. Dealroom's Bay Area is
**$20tn** (all tech companies founded there, including those since listed); Startup
Genome's Silicon Valley is **$3tn** (exits >$50m plus unicorn valuations, rolling
window). Same geography, ~6–7× apart, different definitions.

### 3.7 Metro human capital

$$
H \approx L\cdot\bar{w}\cdot\frac{1+g}{r-g}\left[1-\left(\frac{1+g}{1+r}\right)^{T}\right]
$$

Worked (London): 4.50m employed, £46,940 mean, $g=1.5\%$, $r=4.0\%$, $T=25$ ⇒
**£3.87tn ≈ 6.7× GVA**. With London's true right-skewed earnings distribution and a
35-year horizon, **9–12× GVA**.

**For rich metros $H$ lands at 8–15× GMP — the largest term in $W^{\text{metro}}$ by a
wide margin, 2–4× the entire real estate stock.** This is the correct rebuttal to "the
city is worth its property."

### 3.8 Which cities count — the spine

**GHS-UCDB R2024A** as the universal spine (11,422 urban centres, 473 indicators, free,
EU open licence), with **OECD Functional Urban Areas** as the economic overlay where it
exists (~1,300 FUAs, 37 countries). UCDB is the only source applying **one algorithm
identically to every country on Earth**; UN WUP mixes national definitions and is
structurally unsound for cross-country comparison.

FUA definition (UN Statistical Commission-endorsed, March 2020): grid cells ≥1,500
inhab/km², contiguous, cluster ≥50,000 = urban centre; commuting zone = LAUs with ≥15%
commuting in; two centres with >15% two-way flow merge.

**Selection rule for "every country and its core metropolitans":**

$$
\text{CORE} = \{UC: \text{pop} \ge 1\text{m}\} \cup \{\text{capitals}\} \cup \{\arg\max \text{pop per country}\} \cup \{\text{top-3 for countries} > 20\text{m}\}
$$

⇒ **~750–900 entities covering all ~195 UN member states.**

### 3.9 ⚠️ The honest coverage gap

**Exactly four metro-level variables have genuine global 10+ year coverage: population,
built-up area, nighttime lights, and air quality. Everything economic is OECD-plus-China
or modelled.** India, most of Africa, most of SE Asia and LatAm have **no official metro
GDP at all**.

Nighttime-lights imputation, with the verified elasticity (Henderson, Storeygard & Weil
2012, *AER*):

$$
\ln GMP_{c,t} = \beta_0 + \beta_1\ln\left(\textstyle\sum DN_{c,t}\right) + \beta_2\ln \text{pop}_{c,t} + \mu_{\text{country}} + \tau_t + \varepsilon
$$

**A 1pp change in luminosity corresponds to a 0.28pp change in GDP — the elasticity is
≈0.3, not 1.** Country fixed effects are mandatory (electrification, gas flaring,
lighting technology differ enormously).

Failure modes we encode: DMSP-OLS **saturates at DN=63**, censoring dense CBDs exactly
where value is highest (use VIIRS post-2012); blooming inflates small cities;
**post-2015 LED conversion reduces measured radiance with no economic decline** — never
read European radiance declines after 2015 as economic decline.

**The rule for emerging-market metros:** report GMP as a **range with an explicit method
label**, and drive all comparative analysis off **growth rates and physical proxies,
never levels**. Published Bengaluru GDP figures range from ~$110bn to $590bn — a **5.4×
spread** on the single most important input.

---

## 4. Companies

### 4.1 Intrinsic — FCFF DCF

$$
FCFF_t = EBIT_t(1-\tau) - \text{Reinvestment}_t
$$
$$
\text{Reinvestment}_t = \frac{Rev_{t+1} - Rev_t}{\text{Sales-to-capital}}
$$
$$
V_{\text{op}} = \sum_{t=1}^{n}\frac{FCFF_t}{\prod(1+WACC_s)} + \frac{TV_n}{\prod_{s=1}^{n}(1+WACC_s)}
$$

**Terminal value with the stable-growth constraint:**

$$
TV_n = \frac{EBIT_{n+1}(1-\tau)\left(1 - \dfrac{g}{ROIC_{\text{stable}}}\right)}{WACC_{\text{stable}} - g}, \qquad \boxed{g \le R_f}
$$

The constraint $g \le R_f$ is not a convention — a firm growing faster than the
economy forever eventually *becomes* the economy. Violating it is the most common
error in founder-built models.

**Internal consistency check (mandatory, enforced in code):**

$$
ROIC_t^{\text{imputed}} = \frac{EBIT_t(1-\tau)}{IC_0 + \sum_{n<t}\text{Reinvestment}_n}
$$

If imputed ROIC drifts far above the industry average, the model is under-reinvesting
and the valuation is fiction. If below WACC, it is over-reinvesting. **We surface this
check rather than hiding it.**

### 4.2 Cost of capital

$$
\beta_U = \frac{\beta_L}{1+(1-\tau)\,D/E}
\qquad
\beta_L = \beta_U\left(1+(1-\tau)\tfrac{D}{E}\right)
$$
$$
k_e = R_f + \beta_L \cdot ERP, \qquad WACC = k_e\tfrac{E}{D+E} + k_d(1-\tau)\tfrac{D}{D+E}
$$

**Verified industry anchors (Damodaran, January 2026):**

| Industry | n | EV/Sales | EV/EBITDA | WACC | Levered β | Unlevered β |
|---|---|---|---|---|---|---|
| Software (System & Application) | 309 | 11.41 | 24.48 | 9.34% | 1.28 | 1.23 |
| Software (Internet) | 29 | 9.56 | 30.26 | 10.66% | 1.69 | 1.55 |
| Software (Entertainment) | 77 | 9.13 | 22.01 | 8.44% | 1.03 | 1.01 |
| Computers/Peripherals | 36 | 6.63 | 25.42 | 9.71% | 1.35 | 1.31 |
| Semiconductor | 66 | 15.70 | 34.75 | 10.55% | 1.52 | 1.49 |
| **Total Market** | 5,994 | **3.97** | **19.73** | **6.96%** | 0.91 | 0.72 |
| Total Market ex-financials | 4,822 | 3.46 | 16.95 | 7.72% | 0.99 | 0.88 |

Uniform cost of debt 5.29% pre-tax, 3.97% after-tax.

⚠️ **Reconciliation caveat, encoded as a test:** EV/Sales and EV/EBITDA are *not*
arithmetically reconcilable through the margin column, because the EV/EBITDA table
restricts to positive-EBITDA firms. Any code that tries to derive one from the other
will produce wrong answers.

### 4.3 Breakeven revenue — inverting the market

The sharpest tool for "is this priced sanely," and the basis of our AI-cohort view:

$$
V_E = \frac{NI(1+g)}{k_e - g} \;\Rightarrow\; NI^{\text{req}} = \frac{V_E(k_e-g)}{1+g} \;\Rightarrow\; Rev^{\text{breakeven}} = \frac{NI^{\text{req}}}{\text{net margin}}
$$

Worked (verified): Nvidia at $5T, $k_e$ 8%, $g$ 4%, net margin 53.01% ⇒ **$483.38B**
immediate breakeven revenue, **$677.97B by 2030** (≈26%/yr required growth).

Then the **3P test**: *Possible* (does the TAM allow it), *Plausible* (can margins hold
at that scale), *Probable* (will competition and execution permit it).

Aggregating breakeven revenue across a cohort detects the **Big Market Delusion** —
when the sum of required revenues exceeds the plausible market. Current LLM cohort:
OpenAI $500B on $13B revenue (38.5×), Anthropic $350B on $7B (50×), xAI $230B on
$3.2B (71.9×) — >$1.5T of value against <$100B of collective revenue.

### 4.4 The cross-sector bridge — how to compare unlike businesses

Raw EV/Revenue is not comparable across sectors. Two identities make it so:

$$
\boxed{\;\frac{EV}{\text{Revenue}} = \frac{EV}{\text{Gross Profit}} \times \text{Gross Margin}\;}
$$

A 40% gross-margin hardware company at the *same* 12× EV/gross-profit as an 80%
gross-margin software company gets **4.8× revenue vs 9.6×** — half the multiple,
identical quality. **EV/Gross Profit is the sector-neutral comparator; EV/Revenue is
not.** Worked: Airbnb 7.56× EV/Rev at 82.9% GM ≈ **9.1× gross profit**; Uber 2.89× at
40.8% GM ≈ **7.1×**. The apparent 2.6× gap is really 1.3×.

For marketplaces, the second identity:

$$
\frac{EV}{GMV} = \frac{EV}{\text{Net Revenue}} \times \text{take rate}
$$

At a constant 5× EV/net-revenue, a 30%-take-rate marketplace is worth **1.50× GMV** and
a 5%-take-rate marketplace **0.25× GMV** — a 6× spread from accounting alone. GMV
multiples standalone are near-meaningless.

**This matters most for the AI cohort.** ICONIQ 2026 puts AI product gross margins at
**52% average, 45% pure application layer**, against 75–90% for classic mature SaaS
(inference is ~23% of total spend). At 52% vs 82% GM, an AI company needs a **1.58×
higher revenue multiple to be equally priced on gross profit**. Sierra at 79× revenue
and ~55% GM is **~144× gross profit**. That is the number to argue about, not the
headline.

**Sector-specific denominators the engine must switch on:**

| Sector | Primary metric | Why |
|---|---|---|
| SaaS | EV/ARR, EV/gross profit | Recurring, high GM |
| Marketplace | EV/net revenue (never GMV alone) | Take-rate distortion |
| Payments | EV/net revenue; take rate in bps | Volume-linked, no balance sheet |
| **Lending** | **P/TBV**, P/E — *never* revenue multiples | Balance-sheet risk |
| Biotech | rNPV | Binary clinical outcomes |
| Hardware | EV/gross profit; CCC | Working-capital drag |
| Consumer app | EV/revenue, $/DAU, LTV from retention curve | Engagement → monetisation |

**Lenders get bank multiples for a structural reason:**

$$
P/TBV = \frac{ROTCE - g}{COE - g}
$$

At ROTCE 15%, COE 11%, $g$ 3% ⇒ **1.5×**. CECL forces day-one lifetime loss
recognition, so growth *destroys* near-term earnings; leverage means a 2pp charge-off
surprise wipes out years of ROE. No plausible ROTCE produces a 10× revenue multiple.

**Biotech uses rNPV, and clinical risk goes in the probability, not the rate:**

$$
rNPV = \sum_t \frac{CF_t\cdot PoS_{\text{cum}}(t)}{(1+r)^t}, \qquad PoS_{\text{cum}}(t)=\prod_i p_i
$$

Verified phase transitions (BIO/Informa/QLS, 12,728 transitions, 9,704 programs,
2011–2020): Phase I→II **52.0%**, II→III **28.9%**, III→filing **57.8%**, filing→approval
**90.6%**, **Phase I→approval 7.9%**.

**Consumer retention is a power law, not an exponential:**

$$
r(t) = a\cdot t^{-b}, \qquad LTV = \sum_t r(t)\cdot ARPDAU(t)
$$

Fitting an exponential systematically understates long-tail LTV. Business model
multiplies the category baseline at D30: subscription **×2.50** vs ad-supported ×1.00 —
which is why subscription apps earn 2–4× the revenue multiple.

---

## 5. Startups

### 5.1 Why startups need a different treatment

In the identity, $IC_0 \approx 0$. Value is *entirely* the present value of future
excess returns, multiplied by a survival probability that is far from 1. Both terms
are unobservable. This is why startup valuation is negotiated rather than computed —
and why the honest product is a **range with explicit assumptions**, never a point.

### 5.2 The VC Method (what actually sets the price)

$$
V^{\text{exit}} = Rev^{\text{exit}} \times m
$$
$$
FV^{\text{req}} = I \times (1+IRR)^{n}
$$
$$
\text{Ownership}^{\text{req}} = \frac{FV^{\text{req}}}{V^{\text{exit}}}
$$
$$
V^{\text{post}} = \frac{I}{\text{Ownership}^{\text{req}}}, \qquad V^{\text{pre}} = V^{\text{post}} - I
$$
$$
\text{Ownership}^{\text{entry}} = \frac{\text{Ownership}^{\text{req}}}{\text{retention ratio}} = \frac{\text{Ownership}^{\text{req}}}{1 - \text{cumulative dilution}}
$$

Typical parameters: IRR target **25–40%**, holding period **7–10 years**, cumulative
dilution **30–50%**.

**The insight to surface prominently:** investors negotiate *ownership*, not
valuation. If a fund needs 20% to return its fund, no narrative gets it to 10%. And
time-to-exit moves valuation more than any other single input — shifting the exit 2–3
years can halve or double the number.

### 5.3 Damodaran's young-company build (the defensible intrinsic path)

The sequence, verified from `younggrowth.pdf`:

1. **Top-down revenue:** $Rev_t = \text{market size}_t \times \text{share}_t$. Define
   the market broadly (Amazon-as-bookseller implied <$10B in 1998).
2. **Target margin from mature comparables**, with an explicit path from today's
   negative margin to it.
3. **Taxes with NOL carryforward** — zero tax until losses are absorbed.
4. **Reinvestment** via sales-to-capital: $(Rev_{t+1}-Rev_t)/\text{S2C}$.
5. **Imputed ROIC consistency check** (§4.1).
6. **FCFF.** Note earnings turn positive years before cash flow does.
7. **Cost of capital that migrates**, driven by investor diversification:

   $$\beta_{\text{total}} = \frac{\beta_{\text{market}}}{\text{correlation}}$$

   Worked example: unlevered β 1.20, avg R² 0.16 ⇒ correlation 0.40 ⇒ founder-only
   total β = **3.00** ⇒ $k_e$ **19%**. Sector VC (corr 0.50) ⇒ 2.40 ⇒ **16%**. Multi-sector
   VC (corr 0.75) ⇒ 1.60 ⇒ **12%**. Post-IPO (corr 1.00) ⇒ 1.20 ⇒ **10%**.

   **Discounting uses a cumulated factor, not a constant rate:**
   $(1.19)^2(1.16)^2(1.12) = 2.13416$ for year 5. Getting this wrong is a common and
   material error.

8. **Survival adjustment:**

   $$V^{\text{expected}} = V^{\text{going concern}}(1 - p_{\text{fail}}) + V^{\text{distress}}\cdot p_{\text{fail}}$$

   Empirical base rates (BLS QCEW, 8.9M businesses, 1998–2005):

   | Sector | Survive yr 1 | Survive yr 4 | Survive yr 7 |
   |---|---|---|---|
   | All firms | 81.24% | 44.36% | 31.18% |
   | Information | 80.75% | 37.70% | **24.78%** |

   Worked: $177.56M \times 0.60 + 0 \times 0.40 = **$106.54M**$.

9. **Equity value and per-share claims**, with only the *debt component* of
   convertibles subtracted.

### 5.4 Cap table mechanics (where founder models break)

**Post-money vs pre-money valuation:** $V^{pre} = V^{post} - I$.

**The option pool shuffle** — the most expensive misunderstanding in seed rounds. A
"$8M pre-money" with a 20% post-money pool carved *pre-money* is an effective
**$6M** pre-money. Share price $1.00, not $1.33. We compute and display both.

**Broad-based weighted-average anti-dilution (NVCA standard):**

$$
CP_2 = CP_1 \times \frac{A+B}{A+C}, \qquad B = \frac{\text{aggregate consideration}}{CP_1}
$$

**SAFEs:** pre-money and post-money SAFEs use different capitalization denominators
and dilute founders differently. Cap-vs-discount is **"better of," never stacked**.

**409A vs preferred (Carta 2024 data):** common at ~77% discount to preferred at
seed, narrowing to ~61% by Series D. 2026 practitioner ranges: common 10–30% of
preferred at seed, 20–40% Series A, 35–55% Series B, 50–65% Series C+.

### 5.5 The operating metrics that set the multiple

Formulas (exact, as enforced in code):

$$
\text{NDR} = \frac{MRR_{\text{start}} + \text{expansion} - \text{contraction} - \text{churn}}{MRR_{\text{start}}}
$$
$$
\text{CAC payback (months)} = \frac{CAC}{ARPA \times \text{gross margin}}
$$
$$
\text{LTV} = \frac{ARPA \times \text{gross margin}}{\text{churn rate}}
$$
$$
\text{Burn multiple} = \frac{\text{net burn}}{\text{net new ARR}}
$$
$$
\text{Rule of 40} = \text{growth \%} + \text{FCF margin \%}
$$
$$
\text{Magic number} = \frac{(\text{ARR}_{q} - \text{ARR}_{q-1})}{\text{S\&M spend}_{q-1}}
$$

**Verified stage thresholds** (from the founders-corner readiness framework):

| Metric | Threshold |
|---|---|
| Logo retention | > 80% |
| NRR | 90–100%+ |
| Burn multiple | < 3× (ideally < 2×) |
| CAC payback | < 18 months |

**The critical framing, and the product's founder-side thesis:** investors reject on
**pattern mismatch**, not on any single metric. "Adequate ARR + slow growth + thin
margins + weak efficiency" fails; "strong retention + strong efficiency + early
revenue" passes at a lower ARR. The simulator must therefore score the *pattern*,
not a checklist.

### 5.6 The TAM trap (encoded as a hard warning)

The single most common fundraise-killer:

> *"The global X market is worth $Y trillion. We target 2%, which is $Z M."*

Top-down sizing signals the founder has no customer definition, pricing logic or GTM
rationale. Pear VC's 30-investor survey returned this consistently. **The simulator
will refuse to accept a top-down TAM** and force bottom-up:

$$
TAM = \sum_{\text{segments}} (\text{\# reachable accounts}) \times (\text{ACV})
$$

---

## 6. What we compute, per entity, every time

| Output | Country | Metro | Company | Startup |
|---|---|---|---|---|
| Headline value | ✅ | ✅ | ✅ | range only |
| Range across methods | ✅ | ✅ | ✅ | ✅ |
| Per-capita denominator | ✅ | ✅ | — | — |
| $V^{flow}/V^{stock}$ spread | ✅ | ✅ | ✅ | n/a |
| 10y history | ✅ | ✅ | ✅ | n/a |
| Change decomposition (§1.3) | ✅ | ✅ | ✅ | ✅ |
| Event annotations | ✅ | ✅ | ✅ | — |
| Sensitivity band (±100bp r) | ✅ | ✅ | ✅ | ✅ |
| Lever ranking | — | — | — | ✅ |

**The per-capita denominator is mandatory on every place page.** Every national
balance-sheet story that has ever travelled used it ("£125,000 each, £302,000 per
household"). It is the cheapest legibility device available and we build it in by
default rather than bolting it on.

---

## 7. Invariants (enforced as tests, not conventions)

Each of these was earned by a specific, documented error mode. They are executable
tests in `engine/invariants`, not prose.

1. **$g \le R_f$** in every terminal value. No exceptions. A firm growing faster than
   the economy forever eventually *becomes* the economy.
2. **Imputed ROIC** is reported alongside every intrinsic valuation (§4.1).
3. **Multi-stage discounting uses cumulated factors**, never a single averaged rate.
4. **Startup values are ranges.** The engine must be structurally incapable of emitting
   a startup point estimate.
5. **Survival probability is explicit and shown**, never buried in the discount rate.
   Using a 25–30% WACC *and* a probability of success is double-counting.
6. **Every displayed number carries its source and vintage.** A 2020 CWON figure and a
   2026 ONS figure never appear side by side unlabelled.
7. **EV/Sales and EV/EBITDA are never derived from each other** — the EV/EBITDA
   universe restricts to positive-EBITDA firms (§4.2).
8. **Sovereign DCF must satisfy the debt-dynamics constraint** or be flagged distressed.
9. **No country point estimates.** Every sensitivity in §2.6 is larger than the
   year-on-year change being reported. Bands are computed from the verified
   sensitivities, never symmetric ±10% placeholders.
10. **Never blend ONS and CWON human capital** — different $r$, different growth
    assumption, different age range (§2.2).
11. **Never sum agglomeration value and land value** — they are the same quantity
    measured twice (§3.1).
12. **Never add listed market cap to national net worth** — listed equity is already
    inside the balance sheet (§2.4).
13. **Never mix Dealroom and Startup Genome ecosystem values** — ~6–7× apart on
    identical geography (§3.6).
14. **Metro GDP outside OECD+China is a modelled range with a method label**, and
    comparisons run on growth rates and physical proxies, never levels (§3.9).
15. **The nighttime-lights elasticity is 0.28, not 1**, and requires country fixed
    effects (§3.9).
16. **CWON 2024 and CWON 2021 human capital are not comparable** — the wage-growth
    factor was discontinued (§2.2).
17. **$r-g$ appears on the front page of every country** — it sets the multiple, the
    snowball and $pb^{*}$ simultaneously.
18. **The simulator refuses top-down TAM** (§5.6).

---

## 8. Open questions carried into the data spine

- Nowcasting CWON's human-capital term to the current quarter: which observable
  proxies (employment, earnings, demographics) carry it, and with what error?
- Metro capital stock outside the OECD: what the honest coverage gap is, and whether
  nighttime-lights radiance is accurate enough to fill it.
- The event corpus: sourcing, structure, and how causality is claimed without
  overclaiming.

---

## Sources

Constants and formulas verified 2026-08-14 against:

- Damodaran, *Valuing Young, Start-up and Growth Companies* — https://pages.stern.nyu.edu/~adamodar/pdfiles/papers/younggrowth.pdf
- Damodaran current data (Jan 2026) — https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datacurrent.html
- Damodaran country risk premiums — https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/ctryprem.html
- Damodaran monthly ERP — https://pages.stern.nyu.edu/~adamodar/pc/implprem/ERPbymonth.xlsx
- ONS National Balance Sheet 2026 — https://www.ons.gov.uk/economy/nationalaccounts/uksectoraccounts/bulletins/thenationalbalancesheetandcapitalstockspreliminaryestimatesuk/2026
- World Bank Changing Wealth of Nations 2024 — https://www.worldbank.org/en/publication/the-changing-wealth-of-nations
- Knaup & Piazza, BLS QCEW business survival rates
- The Founders Corner — VC method, due diligence, stage readiness, TAM
