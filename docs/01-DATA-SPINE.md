# Valuable — The Data Spine

> What we ingest, from where, under what licence, and what will break.
> Every endpoint below was fetched and confirmed returning a real payload on
> **2026-08-14** unless marked otherwise.

**Legend:** ✅ verified live · ⚠️ exists but a specific claim unverified · ❌ confirmed dead

---

## 0. The architectural consequence, stated first

Three facts determine the entire architecture:

1. **SEC EDGAR is US-Government public domain** — the only tier-1 financial dataset with
   *zero* licensing risk. It is the spine for public companies.
2. **Every retail market-data API forbids redistribution.** Tiingo, EODHD and Alpha
   Vantage all carry explicit "internal use" / "personal use" clauses. Market data is a
   **compute-time dependency, called live per request — never a table we copy.**
3. **Metro GDP outside the US and Europe does not exist for free.** Anyone selling
   "global metro GDP" is reselling Oxford Economics. We ship *modelled estimates* and
   label them as such (INVARIANT 14).

---

## 1. Phase 1 stack — ten sources, all verified, all buildable

| # | Source | Gives us | Years | Licence | Redistribute? |
|---|---|---|---|---|---|
| 1 | **SEC EDGAR** | Every US-listed company's full financials | 2009–2026 | US Gov | 🟢 **Yes** |
| 2 | **World Bank API** | GDP, capital formation, population + **national wealth** + governance, 217 economies | 1960–2024; wealth 1995–2020 | CC BY 4.0 | 🟢 **Yes** |
| 3 | **IMF SDMX 3.0** | WEO, Fiscal Monitor, **capital stock**, **public sector balance sheet**, Global Debt DB | 1980–2031 | Attribution | 🟡 Confirm terms |
| 4 | **Damodaran** | WACC, betas, ERP, country premiums, industry multiples | **1999–2025** | Explicitly free | 🟢 **Yes** |
| 5 | **Eurostat `nama_10r_3gdp`** | **NUTS3 GDP — the European metro backbone** | 2000–2024 | CC BY 4.0 | 🟢 **Yes** |
| 6 | **BEA `CAGDP2` + BLS QCEW** | US county/MSA GDP, employment, wages | 2001– / 1990– | US Gov | 🟢 **Yes** |
| 7 | **SEC Form D** | ~13,600 US private rounds/yr, amounts + industry | **2008Q1–2026Q2** | US Gov | 🟢 **Yes** |
| 8 | **GHS-UCDB R2024A** | >10,000 global urban centres: boundaries, population, built-up | 1975–2030 | EU reuse | 🟢 **Yes** |
| 9 | **DOSE v2.14** | **Reported subnational GDP, ~80 countries** — the only free non-OECD metro GDP | 1960– | CC BY 4.0 | 🟢 **Yes** |
| 10 | **Companies House + SH01** | UK financials **and private-round valuations** | 10+ yr | OGL | 🟢 **Yes** |

Supporting: **Penn World Table 11.0** ✅ (185 countries, 1950–2023, CC BY 4.0),
**UN WPP 2024** ✅ (1950–2100, CC BY 3.0 IGO), **Kontur Population** ✅ (CC BY).

---

## 2. Three landmines that will silently break ingestion

These were found by measurement, not by reading docs. Each is encoded as an ingestion
guard.

### 2.1 The World Bank WGI indicator codes changed — old ones return empty

The legacy codes `GE.EST`, `CC.EST`, `RL.EST` **still appear in the indicator registry**
but return *"The indicator was not found. It may have been deleted or archived."*

Live pattern requires the `GOV_WGI_` prefix **and** `source=3`:

```
https://api.worldbank.org/v2/country/USA/indicator/GOV_WGI_GE.EST?format=json&source=3
```

Full pattern: `GOV_WGI_{CC|GE|PV|RL|RQ|VA}.{EST|SC|SE|SR|SC_LB|SC_UB}`.

### 2.2 The IMF's old API is dead at the DNS level — and the new one fails *silently*

`dataservices.imf.org` and `datahelp.imf.org` **no longer resolve in DNS**. Not a 404 —
the hosts are gone. Every tutorial and client library pinned to them is broken.

```
https://api.imf.org/external/sdmx/3.0/data/dataflow/IMF.RES/WEO/9.0.0/*.NGDPD.*?startPeriod=2000&endPeriod=2031
```

> 🚨 **The agency is not `IMF`.** It is `IMF.STA`, `IMF.RES`, `IMF.FAD`, `IMF.MCM`.
> Requesting `/dataflow/IMF/…` returns **HTTP 204 No Content** — a silent empty
> success, not an error. Enumerate with `/dataflow/all/all/latest` (✅ 222 dataflows).

**"IFS" and "DOTS" no longer exist** — grepping the live 222-dataflow list returns zero
matches. IFS is decomposed into `IMF.STA` components; DOTS is superseded by `IMTS`.

⚠️ **The WEO bulk file is broken:** `WEOApr2026all.ashx` → 302 to a `.pdf` path returning
Azure `BlobNotFound`. **Do not build ingestion on it.** Use the DataMapper API instead —
✅ 200 JSON, no key, **132 indicators, 241 countries, 1980 through the forecast horizon**:

```
https://www.imf.org/external/datamapper/api/v1/NGDPD
```

`*_YYYY_MON_VINTAGE` flows give **point-in-time vintages** — how we backtest without
look-ahead bias.

### 2.4 Two more silent-failure modes

**`dataverse.nl` serves an HTML app shell, not the file.** Penn World Table and Maddison
downloads return a 4,464-byte JavaScript SPA to non-browser clients — with HTTP 200.
Automated ingestion will store a web page as a spreadsheet. Same class of bug as §2.3.

**ONS's legacy timeseries API was retired 25 Nov 2024** (`api.ons.gov.uk` → 404 with
that message). Live endpoint is `https://api.beta.ons.gov.uk/v1/` ✅.

> **The generalised guard, covering §2.3 and both of these: validate `Content-Type` and
> assert a non-empty parsed payload per source. Never trust a status code.**

### 2.3 A BEA file returns HTTP 200 with an HTML 404 body

`MAGDP2.zip` (metro GDP) **does not exist** — it returns `text/html`, 26,371 bytes, with
status **200**. Any ingest checking status codes alone will store a 404 page as data.

> **Guard: check `Content-Type`, never the status code alone.**

We build MSAs by aggregating `CAGDP2.zip` ✅ (15.3 MB) counties on the current OMB CBSA
delineation.

---

## 3. Countries — solved

### 3.1 Comprehensive Wealth is inside the API (no bulk file needed)

The single most useful discovery. CWON is `source=59` ("Wealth Accounts"), **146
indicators**, 1995–2020:

```
https://api.worldbank.org/v2/country/all/indicator/NW.TOW.TO?format=json&source=59&date=1995:2020&per_page=20000
```

| Code | Component |
|---|---|
| `NW.TOW.TO` | Total comprehensive wealth |
| `NW.HCA.TO` | Human capital |
| `NW.PCA.TO` | Produced capital |
| `NW.NCA.*` | Natural capital (`AGRI`, `FISH`, `CROP`, …) |
| `NW.DOW.TO` | Domestic comprehensive wealth |

Suffixes: `.CD` = current US$, none = real chained 2019 US$, `.PC` = per capita.

### 3.2 Core indicator codes (verified present)

`NY.GDP.MKTP.CD` GDP current US$ · `NY.GDP.MKTP.KD` constant · `NY.GDP.MKTP.PP.CD` PPP ·
`NY.GNP.MKTP.CD` GNI · `SP.POP.TOTL` population · `NE.GDI.FTOT.CD` gross fixed capital
formation · `FP.CPI.TOTL.ZG` inflation · `GC.DOD.TOTL.GD.ZS` central govt debt %GDP ·
`BN.CAB.XOKA.GD.ZS` current account %GDP · `SP.DYN.LE00.IN` life expectancy.

Bulk: `https://databank.worldbank.org/data/download/WDI_CSV.zip` ✅ **161.6 MB**,
~1,500 indicators × 217 economies × 1960→.

### 3.3 IMF dataflows that matter for sovereign valuation

| Agency | Flow | Why it matters |
|---|---|---|
| `IMF.RES` | `WEO` | Forecasts to 2031 |
| `IMF.FAD` | **`ICSD`** | **Investment & Capital Stock — a direct $IC$ input** |
| `IMF.FAD` | **`PSBS`** | **Public Sector Balance Sheet — the closest thing to a sovereign balance sheet** |
| `IMF.FAD` | `GDD`, `HPD` | Global Debt Database, Historical Public Debt |
| `IMF.FAD` | `FM` | Fiscal Monitor |

### 3.4 Sovereign ratings — the honest answer

S&P, Moody's and Fitch ratings are **licensed IP; we cannot redistribute them.** CDS
spreads are ICE/Markit — paid, no free tier.

**What is free and usable:** Damodaran's `ctryprem.xlsx` ✅ (380 KB) publishes the
*derived* default spread and country risk premium as his own work product. We build the
sovereign-risk factor from that plus IMF debt data plus WGI. **We ship no ratings
column.**

---

## 4. Public companies — solved

Every endpoint below returned HTTP 200 with real payload ✅:

| Endpoint | Note |
|---|---|
| `data.sec.gov/api/xbrl/companyfacts/CIK##########.json` | Apple = 3.79 MB |
| `data.sec.gov/api/xbrl/frames/us-gaap/{Tag}/USD/CY2023.json` | **Every filer, one metric, one period, one call** — 409 KB |
| `sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip` | **1.40 GB** full bulk |
| `sec.gov/files/company_tickers.json` | ticker ↔ CIK map |
| Financial Statement Data Sets | **Jan 2009 – Mar 2026** |

⚠️ **A declared `User-Agent` with contact info is mandatory.** Proven: a Chrome UA got
**403**; the same URL with `User-Agent: Valuable/1.0 (contact@…)` returned **200**.
Rate limit 10 req/sec. No CORS on `data.sec.gov`.

```bash
curl -A "Valuable/1.0 (contact@example.com)" -O https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip
```

### 4.1 ⚠️ Forbes Global 2000 — we cannot ship it

There is **no machine-readable feed and no licence to redistribute**. The *ranking and
compilation* is Forbes' copyright (individual facts are not).

> **Decision: construct our own top-2000 by market cap from SEC + a live price feed.**
> Defensible, reproducible, survivorship-bias-free, zero compilation-copyright risk, and
> we name it our own thing. Same analysis applies to Fortune 500.

### 4.2 Damodaran's own limitation, in his words

> *"While I would love to share the company-level data (like I used to), I am afraid
> that I am no longer allowed to do that by the data services."*

Industry aggregates only. Company-level must come from EDGAR. Archives run
**1999–2025** at `pages.stern.nyu.edu/~adamodar/pc/archives/{name}{YY}.xls`.

⚠️ **Archive naming gotcha:** the year suffix lags the update by one. The January
**2025** update is archived as `betas24.xls`. `betas25.xls` returns 404.

---

## 5. Private rounds — amounts solved, valuations only in the UK

### 5.1 SEC Form D — measured, not estimated

`https://www.sec.gov/files/structureddata/data/form-d-data-sets/{YYYY}q{N}_d.zip`
✅ **2008Q1 → 2026Q2 = 52 quarterly files, 18.5 years.** Prepackaged TSVs — no XML
parsing needed.

What one quarter (2025Q4) actually yields, measured:

| Metric | Value |
|---|---|
| Total filings | 14,637 |
| Pooled investment funds (excluded) | 9,527 |
| **Operating companies** | **5,110** |
| **With a disclosed dollar amount** | **3,408** |
| **Total capital disclosed** | **$88.7bn** |
| **Median round** | **$2,265,000** |
| Rounds ≥$1M / ≥$10M / ≥$100M | 2,190 / 825 / 137 |

⇒ **~13,600 disclosed US private rounds per year × 18.5 years.**

🚨 **Hard limits:** Form D gives **amount raised, never valuation**. No pre/post-money,
no share price, no cap table. Reg D only. `TOTALOFFERINGAMOUNT` is frequently the
literal string `"Indefinite"` — **the parser must handle a non-numeric value in a
numeric column.**

### 5.2 The UK trick — the only free route to real private valuations

Companies House **SH01 (Return of Allotment of Shares)** discloses **shares allotted and
amount paid per share**. Price/share × shares outstanding = **post-money valuation** —
exactly what Form D cannot give.

Free, OGL-licensed, commercially redistributable, available for every UK company.
**This is the highest-value underused source in the entire manual.**

API: `https://api.company-information.service.gov.uk/` ✅, free key, **600 requests /
5 minutes**.

---

## 6. Metros — the real constraint, stated honestly

### 6.1 ⚠️ Eurostat's Urban Audit economy table is effectively empty

Measured observation counts from the live catalogue ✅:

| Dataset | Years | Observations |
|---|---|---|
| `urb_cpop1` (population, cities) | 1989–2025 | **583,675** |
| `urb_lpop1` (population, FUAs) | 1989–2025 | 435,570 |
| **`urb_cecfi` (economy & finance)** | 1991–2024 | **9,260** ← 1.6% of the population table |

Urban Audit is a *demographic* product with an economics stub. **We do not build metro
GDP on it.**

Worse, `met_10r_3gdp` (GDP by metropolitan region) stops at 2022 and was last updated
**28.02.2024**, while `nama_10r_3gdp` was updated **10.02.2026**. The `met_*` family
appears discontinued.

> **`nama_10r_3gdp` (NUTS3) is the load-bearing European source** — ✅ 2000–2024,
> **296,322 observations**. We map NUTS3 → FUA ourselves.

### 6.2 The proxy chain for everywhere else

**DOSE** (reported subnational GDP where it exists, ~80 countries, CC BY 4.0)
→ **GHS-UCDB** (consistent urban-centre boundaries + population + built-up)
→ **nightlights + Kontur** (spatial downscaling within country)
→ **World Bank national GDP** (control total, forces the sum to reconcile).

Every output of this chain is labelled a modelled estimate with its method
(INVARIANT 14), and comparisons run on growth rates and physical proxies, never levels.

---

## 7. 🚨 The do-not-ship list

| Cannot redistribute | Why |
|---|---|
| **Yahoo Finance / yfinance** | ToS violation. Not a grey area. |
| **Tiingo, EODHD, Alpha Vantage free tiers** | Explicit "internal use" / "personal use" clauses |
| **Crunchbase, PitchBook, CB Insights, Dealroom, Tracxn** | Contractual no-redistribution at every tier. Crunchbase has **discontinued its Basic API** entirely. |
| **Forbes Global 2000 / Fortune 500** | Compilation copyright — build our own ranking |
| **S&P / Moody's / Fitch ratings; ICE/Markit CDS** | Licensed IP |
| **OSM / Geofabrik** | 🚨 **ODbL share-alike — can force our derived database open.** Use Kontur (CC BY) + GHS-UCDB instead. |
| **`yc-oss/api`** | ✅ No licence file = **all rights reserved** |
| **OpenCorporates** | Share-alike + paid commercial tier |
| **Numbeo, Mercer, EIU, Oxford Economics, Brookings metro GDP** | Paid/copyrighted. Oxford Economics underlies most "global metro GDP". |
| **FRED bulk** | ⚠️ Mixes public-domain federal series with copyrighted third-party series (Case-Shiller, ICE/BofA, Dow Jones, Haver). **Whitelist by source; never bulk-redistribute.** Prefer BEA/BLS directly — same data, unambiguous terms. |
| **BIS** | 🚨 **Verified blocker.** `bis.org/terms_statistics.htm`: commercial use must *"not result in any additional charge to subscribers or other users… No other use is permissible."* A paid tier violates this on its face. **Substitute IMF `IMF.FAD:GDD` (Global Debt Database) and `HPD`.** |
| **Transparency International CPI** | 🚨 Historically **CC BY-ND** — ND forbids derivative works, which blocks any transformed or blended country-risk score. That is exactly what we build. **Substitute WGI Control of Corruption (`GOV_WGI_CC.EST`, CC BY 4.0).** |
| **Heritage Index of Economic Freedom** | Standard copyright, no open licence — assume no |
| **V-Dem** | ⚠️ Licence genuinely unverified (terms page 404s). Read it before shipping. |
| **World Bank microdata** | Microdata Research License — no redistribution |

### 7.1 ⚠️ The World Bank licence trap — do not let this kill the project

Two different World Bank legal documents exist and they say opposite things:

- **The correct one for data:** `datacatalog.worldbank.org/public-licenses` — **CC BY 4.0
  is the default licence for all datasets produced by the World Bank and distributed as
  open data.** Commercial use and redistribution permitted with attribution. ✅
- **The trap:** the general `worldbank.org` site Terms & Conditions forbid derivative
  works and commercial use *including "charging to redistribute them."* **That governs
  website editorial content, not Data Catalog datasets.**

A reviewer who reads only the second page will conclude the entire spine is unusable. It
isn't.

### 7.2 The one promising unexplored lead

**ESMA European Rating Platform** ✅ (`registers.esma.europa.eu`, 174 KB live). EU-registered
credit rating agencies are *legally required* to publish ratings there, and ESMA publishes
it as a public register. **Regulatorily-mandated public disclosure has a fundamentally
different legal character from a vendor's licensed feed.** The bulk export mechanism is
unverified. Worth a proper look — it is the only credible free route to sovereign ratings.

---

## 8. Build architecture

```
                 DuckDB (build)                    Postgres (serve)
  ┌──────────────────────────────────┐      ┌─────────────────────────┐
  │ WDI_CSV.zip        (161 MB)      │      │ entity                  │
  │ companyfacts.zip   (1.40 GB)     │      │ valuation_series        │
  │ Form D × 52 quarters             │─────▶│ valuation_method        │
  │ nama_10r_3gdp      (296k obs)    │      │ event_annotation ← moat │
  │ CAGDP2.zip         (15.3 MB)     │      │ founder_model (RLS)     │
  │ GHS-UCDB           (1.69 GB)     │      └─────────────────────────┘
  │ DOSE v2.14         (17.5 MB)     │                  │
  │ Damodaran × 27 vintages          │                  ▼
  └──────────────────────────────────┘             Next.js app
                                                        │
                       market data ─── live call ───────┘
                       (never stored — redistribution)
```

Heavy history transforms in DuckDB (reads Parquet/CSV at scale on a laptop, no server).
Modelled results published to Supabase Postgres for the live app, auth, RLS and saved
founder models. Market data is called live and never persisted.

---

## 9. Coverage, honestly stated

| Entity | Coverage | Verdict |
|---|---|---|
| Countries | 25+ years, 217 economies, CC BY | 🟢 **Solved** |
| National wealth | 151 countries, **1995–2020 only** | 🟡 Nowcast required past 2020 |
| US public companies | 17 years XBRL, public domain | 🟢 **Solved** |
| Non-US public companies | UK strong (OGL); EU fragmented until ESAP ~2027; Japan EDINET now needs a key | 🟡 Partial |
| US private rounds — amounts | 18.5 years, ~13,600/yr | 🟢 **Solved** |
| Private valuations | UK SH01 only | 🔴 **Structural gap outside the UK** |
| US + EU metros | BEA counties 2001–, NUTS3 2000–2024 | 🟢 **Solved** |
| Rest-of-world metros | No authoritative free source | 🔴 **Modelled estimates, labelled** |

---

## Verified quickstart

Bulk-load every US public company's financials:

```bash
curl -A "Valuable/1.0 (contact@example.com)" -O https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip
```

Bulk-load all World Development Indicators:

```bash
curl -O https://databank.worldbank.org/data/download/WDI_CSV.zip
```

Pull national comprehensive wealth straight from the API:

```bash
curl "https://api.worldbank.org/v2/country/all/indicator/NW.TOW.TO?format=json&source=59&date=1995:2020&per_page=20000"
```

Harvest all 52 quarters of US private funding rounds:

```bash
for y in $(seq 2008 2026); do for q in 1 2 3 4; do curl -A "Valuable/1.0 (contact@example.com)" -fsO "https://www.sec.gov/files/structureddata/data/form-d-data-sets/${y}q${q}_d.zip"; done; done
```

Get NUTS3 regional GDP — the European metro backbone:

```bash
curl "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/nama_10r_3gdp?format=JSON&lang=EN&unit=MIO_EUR"
```

Query the IMF World Economic Outlook on the new API:

```bash
curl "https://api.imf.org/external/sdmx/3.0/data/dataflow/IMF.RES/WEO/9.0.0/*.NGDPD.*?startPeriod=2000&endPeriod=2031"
```
