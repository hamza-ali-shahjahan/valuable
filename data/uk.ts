/**
 * United Kingdom — verified reference data for the slice-1 vertical.
 *
 * Every figure carries its source. Figures NOT verified against a primary source
 * during research are marked `needsVerification: true` and must not be published
 * without a second pass. That flag is checked by a test.
 *
 * Units: GBP, absolute (so 13.31e12 = £13.31 trillion).
 */

export interface Datum {
  readonly value: number;
  readonly unit: string;
  readonly asOf: string;
  readonly source: string;
  readonly sourceUrl?: string;
  readonly needsVerification?: boolean;
  readonly note?: string;
}

const T = 1e12;
const BN = 1e9;

const ONS_NBS = "ONS National Balance Sheet & capital stocks, preliminary estimates 2026";
const ONS_NBS_URL = "https://www.ons.gov.uk/economy/nationalaccounts/uksectoraccounts/bulletins/thenationalbalancesheetandcapitalstockspreliminaryestimatesuk/2026";
const ONS_HC = "ONS Human capital stocks estimates in the UK, 2004 to 2022";
const ONS_HC_URL = "https://www.ons.gov.uk/peoplepopulationandcommunity/wellbeing/bulletins/humancapitalstocksestimatesintheuk/2004to2022";
const OBR = "OBR Economic and fiscal outlook, March 2026";
const OBR_URL = "https://obr.uk/efo/economic-and-fiscal-outlook-march-2026/";

// ---------------------------------------------------------------------------
// National balance sheet — the number journalists reached for on 12 Aug 2026
// ---------------------------------------------------------------------------

export const UK_NET_WORTH: Record<string, Datum> = {
  "2023": { value: 12.4 * T, unit: "GBP", asOf: "2023-12-31", source: ONS_NBS, sourceUrl: ONS_NBS_URL },
  "2024": { value: 13.1 * T, unit: "GBP", asOf: "2024-12-31", source: ONS_NBS, sourceUrl: ONS_NBS_URL },
  "2025": { value: 13.31 * T, unit: "GBP", asOf: "2025-12-31", source: ONS_NBS, sourceUrl: ONS_NBS_URL,
            note: "Preliminary estimate published June 2026. +£215.6bn on 2024." },
};

export const UK_BALANCE_SHEET_2025 = {
  producedAssets: { value: 6.6 * T, unit: "GBP", asOf: "2025-12-31", source: ONS_NBS, sourceUrl: ONS_NBS_URL },
  nonProducedAssets: { value: 6.9 * T, unit: "GBP", asOf: "2025-12-31", source: ONS_NBS, sourceUrl: ONS_NBS_URL,
                       note: "Predominantly land. 52% of net worth — the headline is largely a house-price index." },
  netFinancialWorth: { value: -199.8 * BN, unit: "GBP", asOf: "2025-12-31", source: ONS_NBS, sourceUrl: ONS_NBS_URL },
} satisfies Record<string, Datum>;

/** Sector split as reported in coverage of the 12 Aug 2026 Musk exchange. */
export const UK_SECTOR_SPLIT_2025 = {
  households: { value: 11.16 * T, unit: "GBP", asOf: "2025-12-31", source: ONS_NBS, sourceUrl: ONS_NBS_URL },
  corporations: { value: 2.92 * T, unit: "GBP", asOf: "2025-12-31", source: ONS_NBS, sourceUrl: ONS_NBS_URL },
  government: { value: -761 * BN, unit: "GBP", asOf: "2025-12-31", source: ONS_NBS, sourceUrl: ONS_NBS_URL },
} satisfies Record<string, Datum>;

// ---------------------------------------------------------------------------
// Human capital — ONS convention (r=3.5% WITH 2% productivity growth, ages 16-65)
// ---------------------------------------------------------------------------

export const UK_HUMAN_CAPITAL: Datum = {
  value: 25.5 * T, unit: "GBP", asOf: "2022-12-31", source: ONS_HC, sourceUrl: ONS_HC_URL,
  note: "ONS convention: r=3.5% WITH 2% labour productivity growth, ages 16-65, employed and unemployed. " +
        "£606,000 per person. NEVER blend with CWON human capital (INVARIANT 10).",
};

// ---------------------------------------------------------------------------
// Fiscal — OBR March 2026
// ---------------------------------------------------------------------------

export const UK_FISCAL = {
  nominalGdp: { value: 3034 * BN, unit: "GBP", asOf: "2025-12-31", source: OBR, sourceUrl: OBR_URL },
  receipts: { value: 1232 * BN, unit: "GBP", asOf: "2026-03-31", source: OBR, sourceUrl: OBR_URL,
              note: "40.6% of GDP, fiscal year 2025-26." },
  debtToGdp: { value: 0.945, unit: "ratio", asOf: "2026-03-31", source: OBR, sourceUrl: OBR_URL,
               note: "PSND 2025-26. Peaks at 96.5% in 2028-29." },
  debtInterest: { value: 106 * BN, unit: "GBP", asOf: "2025-03-31", source: OBR, sourceUrl: OBR_URL,
                  note: "3.6% of GDP, up from £39bn / 1.7% in 2019-20." },
  effectiveRate: { value: 0.038, unit: "ratio", asOf: "2026-03-31", source: `${OBR} (derived: 3.6/94.5)`,
                   sourceUrl: OBR_URL },
  nominalGdpGrowth: { value: 0.035, unit: "ratio", asOf: "2026-03-31", source: OBR, sourceUrl: OBR_URL },
  potentialOutputGrowth: { value: 0.013, unit: "ratio", asOf: "2026-03-31", source: OBR, sourceUrl: OBR_URL },
  underlyingProductivityGrowth: { value: 0.010, unit: "ratio", asOf: "2026-03-31", source: OBR, sourceUrl: OBR_URL },
} satisfies Record<string, Datum>;

// ---------------------------------------------------------------------------
// Listed equity — SIGNAL ONLY. Never added to net worth (INVARIANT 12).
// ---------------------------------------------------------------------------

export const UK_LISTED_EQUITY: Datum = {
  value: 2.744 * T, unit: "GBP", asOf: "2026-03-31", source: "FTSE All-Share market capitalisation",
  note: "SIGNAL ONLY. Already inside national net worth as corporate net assets and " +
        "household financial assets. Adding it double-counts (INVARIANT 12). Also heavily " +
        "distorted: the All-Share is dominated by miners, banks, energy and pharma with " +
        "overwhelmingly foreign revenue.",
};

// ---------------------------------------------------------------------------
// Population — needed for the mandatory per-capita denominator
// ---------------------------------------------------------------------------

export const UK_POPULATION: Datum = {
  value: 69.3e6, unit: "people", asOf: "2024-06-30", source: "ONS mid-year population estimate",
  needsVerification: true,
  note: "Approximate. Must be replaced with the exact ONS mid-year series before any " +
        "per-capita figure is published.",
};

// ---------------------------------------------------------------------------
// London — the metro half of the slice
// ---------------------------------------------------------------------------

export const LONDON = {
  population: { value: 9_089_736, unit: "people", asOf: "2024-12-31", source: "ONS / GLA" },
  gdp: { value: 617.9 * BN, unit: "GBP", asOf: "2023-12-31", source: "ONS regional GDP" },
  gva: { value: 577.1 * BN, unit: "GBP", asOf: "2023-12-31", source: "ONS regional GVA",
         note: "= US$790.6bn. Approximately 22% of UK output." },
  gvaPerCapita: { value: 64_519, unit: "GBP", asOf: "2023-12-31", source: "ONS regional GVA" },
  labourForce: { value: 4_726_000, unit: "people", asOf: "2024-03-31", source: "ONS labour market" },
  meanAnnualPay: { value: 46_940, unit: "GBP", asOf: "2024-12-31", source: "ONS ASHE",
                   note: "Derived from mean gross weekly pay £902.70." },
  hostedEnterpriseValue: { value: 712 * BN, unit: "USD", asOf: "2025-12-31", source: "Dealroom",
                           sourceUrl: "https://dealroom.co/cities/",
                           note: "Combined EV of tech companies founded in the ecosystem. " +
                                 "161 unicorns, 10 decacorns, 8,953 funded startups, $21.1bn VC. " +
                                 "NEVER mix with Startup Genome ecosystem value (INVARIANT 13)." },
} satisfies Record<string, Datum>;

/**
 * The diagnostic ratio (§3.6). London 0.90x vs Bay Area ~16x.
 * Below ~1 = rentier metro capturing value locally through wages, rents and taxes.
 */
export const METRO_EV_TO_GMP_BENCHMARKS = [
  { metro: "Bay Area", evUsd: 20.0 * T, gmpUsd: 1.26 * T, source: "Dealroom / BEA" },
  { metro: "Austin", evUsd: 2.0 * T, gmpUsd: 0.25 * T, source: "Dealroom / BEA", needsVerification: true },
  { metro: "Seattle", evUsd: 2.9 * T, gmpUsd: 0.50 * T, source: "Dealroom / BEA", needsVerification: true },
  { metro: "London", evUsd: 712 * BN, gmpUsd: 790.6 * BN, source: "Dealroom / ONS" },
  { metro: "New York MSA", evUsd: 1.3 * T, gmpUsd: 2.443 * T, source: "Dealroom / BEA" },
] as const;

// ---------------------------------------------------------------------------
// The trigger event — what started this
// ---------------------------------------------------------------------------

export const MUSK_UK_EVENT = {
  date: "2026-08-12",
  description:
    "The Babylon Bee published a satirical piece, 'Elon Musk Buys The United Kingdom To " +
    "Establish Free Speech There.' Musk replied publicly: 'How much is it?' — echoing his " +
    "2017 reply about buying Twitter, which he ultimately bought for $44bn in October 2022. " +
    "Journalists priced the UK at £13.31tn (~$17.98tn) from the free ONS bulletin the same day.",
  derivedFigure: 13.31 * T,
  lesson:
    "The headline number is not defensible IP — it was reproduced within hours from a free " +
    "government bulletin. The product cannot be 'here is the number'. The moat is the " +
    "event-annotation layer explaining what moved it.",
} as const;
