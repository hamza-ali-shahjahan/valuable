/**
 * UK event corpus, 2016–2026 — the first slice of the moat.
 *
 * Every claim carries its identification strategy and citation. Where no counterfactual
 * exists, the claim is `narrative` and structurally cannot carry a point estimate.
 */

import type { PolicyEvent, Leader } from "../engine/events.ts";

export const UK_LEADERS: readonly Leader[] = [
  { iso3: "GBR", name: "David Cameron", party: "Conservative", from: "2010-05-11", to: "2016-07-13" },
  { iso3: "GBR", name: "Theresa May", party: "Conservative", from: "2016-07-13", to: "2019-07-24" },
  { iso3: "GBR", name: "Boris Johnson", party: "Conservative", from: "2019-07-24", to: "2022-09-06" },
  { iso3: "GBR", name: "Liz Truss", party: "Conservative", from: "2022-09-06", to: "2022-10-25",
    note: "49 days — the shortest premiership in British history." },
  { iso3: "GBR", name: "Rishi Sunak", party: "Conservative", from: "2022-10-25", to: "2024-07-05" },
  { iso3: "GBR", name: "Keir Starmer", party: "Labour", from: "2024-07-05", to: null },
];

export const UK_EVENTS: readonly PolicyEvent[] = [
  {
    id: "gbr-2016-06-23-eu-referendum",
    iso3: "GBR",
    date: "2016-06-23",
    category: "referendum",
    title: "EU membership referendum",
    description:
      "Leave 17,410,742 (51.89%) vs Remain 16,141,241 (48.11%), turnout 72.21%. " +
      "Article 50 notified 29 Mar 2017; exit 31 Jan 2020; transition ended 31 Dec 2020.",
    leader: "David Cameron",
    party: "Conservative",
    claims: [
      {
        kind: "measured",
        strategy: "synthetic_control",
        identification:
          "Doppelgänger UK built from a 23-country OECD donor pool on quarterly data " +
          "1995Q1–2016Q2; Germany, New Zealand and the US carry ~70% of the weight. " +
          "Inference via Andrews (2003) end-of-sample instability test per Hahn-Shi, " +
          "plus time- and country-placebo tests. Effect starts 2017Q1, near-zero in H2 2016.",
        metric: "Real GDP vs synthetic counterfactual, end-2018",
        estimate: -0.024,
        low: -0.025,
        high: -0.017,
        unit: "fraction_of_gdp",
        inference: "p = 0.05 on the Andrews end-of-sample test; passes time and country placebos.",
        citation: "Born, Müller, Schularick & Sedláček, Economic Journal 129(623):2722–2744",
        url: "https://www.benjaminborn.de/files/BMSS_Brexit_2019.pdf",
        asOf: "2018-12-31",
        source: "Economic Journal",
      },
      {
        kind: "measured",
        strategy: "synthetic_control",
        identification:
          "Doppelgänger UK from a 22 advanced-economy donor pool, fit window 2009Q1–2016Q2. " +
          "Re-estimated periodically; the December 2022 vintage is reported here.",
        metric: "Real GDP vs synthetic counterfactual",
        estimate: -0.055,
        unit: "fraction_of_gdp",
        inference: "Larger than Born et al. because the window extends through the TCA period.",
        citation: "Springford, Centre for European Reform",
        url: "https://www.cer.eu/insights/cost-brexit-june-2022",
        asOf: "2022-12-21",
        source: "CER",
      },
      {
        kind: "measured",
        strategy: "difference_in_differences",
        identification:
          "Event study on HMRC Overseas Trade Statistics, Jan 2013–Dec 2021, at CN8 " +
          "product × quarter. UK–EU vs UK–rest-of-world, with product×time and bloc×product " +
          "fixed effects; 2016Q2 normalised to zero. No significant anticipation effect " +
          "2016–2020 — the break is at the TCA, not the vote.",
        metric: "Relative UK imports from the EU, post-TCA",
        estimate: -0.25,
        unit: "fraction",
        inference:
          "Exports fell only briefly, but the extensive margin fell ~30% — product-country " +
          "export varieties exited. The damage is in variety, not volume.",
        citation: "Freeman, Manova, Prayer & Sampson, CEP DP1847",
        url: "https://cep.lse.ac.uk/pubs/download/dp1847.pdf",
        asOf: "2021-12-31",
        source: "LSE Centre for Economic Performance",
      },
      {
        kind: "measured",
        strategy: "difference_in_differences",
        identification:
          "Cross-product-group DiD on import exposure: product groups with higher import " +
          "shares should see larger price rises after a common depreciation. Yields a " +
          "dose-response of +0.71pp inflation per 10pp higher import share.",
        metric: "Consumer price inflation in the year after the vote",
        estimate: 0.017,
        unit: "pp",
        inference: "Equivalent to £404 per household per year by June 2017.",
        citation: "Breinlich, Leromain, Novy & Sampson, International Economic Review",
        url: "https://personal.lse.ac.uk/sampsont/VoteInflation.pdf",
        asOf: "2017-06-30",
        source: "CEP Brexit Analysis 11",
      },
      {
        kind: "measured",
        strategy: "event_study",
        identification:
          "Firm-level Decision Maker Panel survey linking each firm's own Brexit " +
          "uncertainty to its investment and productivity, over three years post-vote.",
        metric: "Business investment",
        estimate: -0.11,
        unit: "fraction",
        inference:
          "Also −2 to −5% on UK productivity, partly from management time diverted to " +
          "Brexit planning rather than running the business.",
        citation: "Bloom, Bunn, Chen, Mizen, Smietanka & Thwaites, NBER WP 26218",
        url: "https://www.nber.org/papers/w26218",
        asOf: "2019-09-01",
        source: "NBER",
      },
      {
        kind: "measured",
        strategy: "synthetic_control",
        identification:
          "Synthetic UK for inward FDI projects, Jan 2003–Jul 2018; synthetic weights " +
          "US 0.473, Ireland 0.185, Netherlands 0.176, France 0.145. Pre-treatment fit 0.94.",
        metric: "Inward FDI projects",
        estimate: -0.18,
        low: -0.20,
        high: -0.16,
        unit: "fraction",
        inference:
          "Services FDI ~−25%. NOTE: the widely-circulated '−37%' is not a UKTPO figure " +
          "and should not be used.",
        citation: "Serwicka & Tamberi, UK Trade Policy Observatory BP 23",
        asOf: "2018-10-01",
        source: "UKTPO",
      },
      {
        kind: "narrative",
        direction: "decrease",
        mechanism:
          "The OBR assumes a 15% long-run reduction in trade intensity (adopted Nov 2016 " +
          "EFO) and a 4% long-run reduction in potential productivity (adopted March 2020 " +
          "EFO Box 2.1), phased over 15 years.",
        whyNotIdentified:
          "These are an official forecasting assumption, not an estimate — the OBR adopted " +
          "them as a judgement and has retained them. There is no counterfactual behind the " +
          "number, so it must not be rendered as a measured effect even though it comes " +
          "from an authoritative body.",
        contestation: [
          "March 2024 EFO Box 2.4 reports UK trade intensity −1.7% vs 2019 against G7 +1.7%, " +
          "and judges the assumptions 'broadly on track' — but that is a consistency check, " +
          "not an identification.",
        ],
        citation: "OBR, Economic and fiscal outlook",
        url: "https://obr.uk/box/the-effect-on-productivity-of-leaving-the-eu/",
        asOf: "2025-03-01",
        source: "Office for Budget Responsibility",
      },
    ],
    marketResponses: [
      {
        instrument: "GBP/USD", before: 1.4800, after: 1.3639,
        window: "23 Jun close → 24 Jun 2016 close", unit: "rate",
        asOf: "2016-06-24", source: "Market close",
      },
      {
        instrument: "BIS real broad effective exchange rate", before: 109.13, after: 94.14,
        window: "May 2016 → Oct 2016", unit: "index",
        asOf: "2016-10-31", source: "BIS",
      },
      {
        instrument: "10y gilt yield", before: 0.0154, after: 0.0074,
        window: "May 2016 monthly avg → Aug 2016 trough", unit: "rate",
        asOf: "2016-08-31", source: "Bank of England",
      },
      {
        instrument: "FTSE 250", before: 1.0, after: 0.86,
        window: "23 Jun → 27 Jun 2016 (domestically exposed; FTSE 100 recovered by 1 Jul)",
        unit: "index_ratio", asOf: "2016-06-27", source: "Market close",
      },
    ],
  },

  {
    id: "gbr-2016-06-27-sp-downgrade",
    iso3: "GBR",
    date: "2016-06-27",
    category: "rating_action",
    title: "S&P strips the UK of its AAA rating",
    description:
      "S&P cut AAA → AA, a two-notch move, four days after the referendum. Fitch cut " +
      "AA+ → AA the same day. Moody's moved its outlook to negative on 24 Jun and cut " +
      "Aa1 → Aa2 on 22 Sep 2017.",
    leader: "David Cameron",
    party: "Conservative",
    claims: [
      {
        kind: "narrative",
        direction: "decrease",
        mechanism:
          "A sovereign downgrade raises the risk premium component of the discount rate " +
          "applied to all future national cash flows.",
        whyNotIdentified:
          "The rating action is simultaneous with the referendum shock it responds to, so " +
          "its independent effect cannot be separated from the event that caused it.",
        citation: "S&P Global Ratings; Fitch Ratings; Moody's",
        asOf: "2016-06-27",
        source: "Rating agency announcements",
      },
    ],
  },

  {
    id: "gbr-2022-09-23-mini-budget",
    iso3: "GBR",
    date: "2022-09-23",
    category: "budget",
    title: "The mini-budget",
    description:
      "Unfunded tax cuts announced without an accompanying OBR forecast. Gilt yields and " +
      "sterling moved violently; the Bank of England intervened in the long-gilt market to " +
      "halt a liability-driven-investment doom loop in pension funds. Truss left office on " +
      "25 Oct 2022 after 49 days.",
    leader: "Liz Truss",
    party: "Conservative",
    claims: [
      {
        kind: "narrative",
        direction: "decrease",
        mechanism:
          "A pure discount-rate shock. UK productive capacity was unchanged overnight; what " +
          "changed was the rate the market applied to it. This is the clearest available " +
          "illustration of the product's core thesis — that policy shocks hit valuation " +
          "through r, not through cash flows, and hit it in hours.",
        whyNotIdentified:
          "No published synthetic-control or DiD estimate isolates the mini-budget from the " +
          "concurrent global rate cycle. The market response is observed and dated; the " +
          "counterfactual is not identified.",
        citation: "Bank of England market operations; market data",
        asOf: "2022-10-25",
        source: "Contemporary market record",
      },
    ],
    marketResponses: [
      {
        instrument: "GBP/USD", before: 1.1265, after: 1.0703,
        window: "23 Sep → 26 Sep 2022 low", unit: "rate",
        asOf: "2022-09-26", source: "Market close",
      },
      {
        instrument: "10y gilt yield", before: 0.0331, after: 0.0411,
        window: "23 Sep 2022 → Oct 2022 monthly avg", unit: "rate",
        asOf: "2022-10-31", source: "Bank of England",
      },
    ],
  },

  {
    id: "gbr-2026-06-ons-balance-sheet",
    iso3: "GBR",
    date: "2026-06-01",
    category: "fiscal_policy",
    title: "ONS publishes UK net worth at £13.31tn",
    description:
      "Preliminary 2025 estimate: net worth £13.31tn, up £215.6bn on 2024. Produced assets " +
      "£6.6tn, non-produced (largely land) £6.9tn, net financial worth −£199.8bn. Households " +
      "£11.16tn, corporations £2.92tn, government −£761bn. This is the figure journalists " +
      "reached for on 12 Aug 2026 in answer to Musk's question.",
    leader: "Keir Starmer",
    party: "Labour",
    claims: [
      {
        kind: "narrative",
        direction: "increase",
        mechanism:
          "The 2024 rise (+5.6%) and 2023 fall (−2.0%) are almost entirely house-price " +
          "driven — land is 52% of the total. The national balance sheet is, in large part, " +
          "a house-price index.",
        whyNotIdentified:
          "A statistical publication is a measurement, not a policy intervention. There is " +
          "nothing to identify.",
        citation: "ONS National Balance Sheet, preliminary estimates 2026",
        url: "https://www.ons.gov.uk/economy/nationalaccounts/uksectoraccounts/bulletins/thenationalbalancesheetandcapitalstockspreliminaryestimatesuk/2026",
        asOf: "2026-06-01",
        source: "Office for National Statistics",
      },
    ],
  },
];

/**
 * Episodes deliberately stored as narrative-only, to make the tier distinction visible
 * in the product rather than hidden in a methodology note.
 */
export const NARRATIVE_ONLY_EXAMPLES = [
  {
    iso3: "RWA",
    episode: "Post-1994 reconstruction under Kagame",
    whyNotIdentified:
      "No synthetic control, no discontinuity, no plausibly exogenous variation at " +
      "national level.",
    contestation: [
      "FT investigation (Aug 2019): recalculating EICV3→EICV4 with a consistently " +
      "constructed price deflator suggests poverty ROSE rather than fell.",
      "Sam Desiere (KU Leuven) shows the deflator choice drives the sign of the result.",
      "EICV7 (2023/24) used a revised consumption aggregate and poverty line and is not " +
      "comparable with EICV1–5 — any spliced 1994→2024 trend line is invalid.",
      "Doing Business, on which the reform narrative heavily rests, was discontinued by " +
      "the World Bank on 16 Sep 2021 after data irregularities were found.",
    ],
  },
  {
    iso3: "SGP",
    episode: "The Singapore development model",
    whyNotIdentified:
      "No credible synthetic-control study of Singapore's aggregate growth exists. N=1 " +
      "with no clean counterfactual.",
    contestation: [
      "Young (1992, 1995) growth accounting attributes nearly all output growth to factor " +
      "accumulation, leaving TFP growth near zero — Krugman's 'perspiration, not " +
      "inspiration'.",
      "Hsieh (2002, AER) finds materially positive TFP by the dual approach. The two have " +
      "not been reconciled.",
    ],
  },
] as const;
