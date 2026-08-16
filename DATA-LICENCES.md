# Data licences and attribution

The code in this repository is MIT (see `LICENSE`). **The data is not.** Each source
carries its own terms, and some of them are the reason certain obvious sources are
missing from this project entirely.

---

## What we use, and under what terms

### World Bank Open Data — **CC BY 4.0**

> Contains information from the World Bank's *World Development Indicators* and
> *The Changing Wealth of Nations 2024*, which is made available under the Creative
> Commons Attribution 4.0 International licence (CC BY 4.0).
> https://data.worldbank.org · https://datacatalog.worldbank.org/public-licenses

Commercial use and redistribution are permitted with attribution. This is the backbone
of every country page. Cached in `data/sources/worldbank.json`.

⚠️ **A trap worth naming.** Two different World Bank legal documents exist and they
appear to contradict each other. The general `worldbank.org` site Terms & Conditions
forbid derivative works and commercial use *including "charging to redistribute them"* —
but that governs **website editorial content**, not Data Catalog datasets. The Data
Catalog public-licences page is explicit that **CC BY 4.0 is the default for datasets the
World Bank produces and distributes as open data.** A reviewer reading only the first page
would wrongly conclude this whole project is non-viable.

### SEC EDGAR (United States) — **public domain**

> Financial data from company filings with the US Securities and Exchange Commission,
> retrieved through the EDGAR XBRL frames API.
> https://www.sec.gov/edgar/sec-api-documentation

Works of the US federal government carry no copyright (17 U.S.C. §105). The filings
themselves are prepared by the companies but are public records once filed, and the SEC
publishes them without restriction. The only condition is their **fair access policy**:
identify yourself in the User-Agent and stay under ten requests a second.

⚠️ **Their edge rejects any User-Agent containing a URL**, including the ordinary
`(+https://github.com/…)` bot convention — it returns 403 with no explanation. Set
`SEC_CONTACT` to an email address instead; the ingest reads it from the environment and it
is deliberately not committed.

⚠️ **We build our own ranking.** The Forbes Global 2000 and the Fortune 500 are
copyrightable *compilations*, even though the underlying facts are not. Nothing on the
company pages is derived from either. We rank on value created — a measure nobody
publishes — computed from filings that belong to the public. Cached in
`data/sources/sec-companies.json`.

### Office for National Statistics (UK) — **Open Government Licence v3.0**

> Contains public sector information licensed under the Open Government Licence v3.0.

Covers the UK national balance sheet and human capital figures. OGL explicitly permits
commercial exploitation, including inclusion in your own product.

### Office for Budget Responsibility (UK) — **Open Government Licence v3.0**

Covers the UK fiscal figures behind the debt-versus-growth comparison.

### Aswath Damodaran (NYU Stern) — no formal licence, explicit permission

Used for market constants (risk-free rate, equity risk premium, industry multiples).
He states plainly that he wants the data widely used and has "very few rules". Attribution
is offered anyway.

⚠️ **We use his derived figures only, never the underlying agency ratings**, which are
third-party licensed IP he republishes.

---

## What we deliberately do NOT use, and why

This list is as important as the one above. Each of these is an obvious source that a
project like this would reach for, and each is a licensing trap.

| Source | Why it is absent |
|---|---|
| **BIS statistics** | Their terms require that commercial use "not result in any additional charge to subscribers or other users… No other use is permissible." Any paid tier would breach that on its face. We use the IMF's Global Debt Database instead. |
| **Transparency International CPI** | Historically **CC BY-ND** — the "no derivatives" term forbids building a transformed or blended score, which is exactly what a valuation does. We use World Bank governance indicators instead. |
| **Yahoo Finance / yfinance** | Redistribution breaches Yahoo's terms. Not a grey area. |
| **Tiingo, EODHD, Alpha Vantage (free tiers)** | All carry explicit "internal use" or "personal use" clauses. Market data is therefore a **live call, never a stored table**. |
| **Crunchbase, PitchBook, CB Insights, Dealroom, Tracxn** | Contractual no-redistribution at every tier, at any price we would pay. |
| **Forbes Global 2000, Fortune 500** | The *ranking and compilation* is copyright, even though the underlying facts are not. We build our own ranking from primary filings instead. |
| **S&P / Moody's / Fitch ratings; ICE/Markit CDS** | Licensed IP. No free route exists. |
| **OpenStreetMap / Geofabrik** | **ODbL share-alike** could compel opening a derived database. We would use Kontur (CC BY) and the EU's GHSL instead. |
| **Heritage Index of Economic Freedom** | Standard copyright, no open licence. |
| **V-Dem** | Licence genuinely unverified — their terms page returns 404. Not used until someone reads it. |
| **Oxford Economics, Numbeo, Mercer, EIU** | Paid and copyrighted. Note that Oxford Economics sits underneath most "global metro GDP" figures in circulation. |

---

## If you reuse this

The software is yours under MIT. The data is not ours to relicense — if you take
`data/sources/`, you inherit the World Bank's CC BY 4.0 obligation and must attribute
them, not us.

**Found a licence we've got wrong, in either direction?** That is one of the most useful
corrections anyone can file:
https://github.com/hamza-ali-shahjahan/valuable/issues/new?template=source.yml
