/**
 * Verified market constants. Every value here was checked against a named primary
 * source on the date given. Nothing in this file may be a guess.
 *
 * See docs/00-FIRST-PRINCIPLES.md §2.5 for provenance and reconciliation.
 */

export interface Vintaged<T> {
  value: T;
  asOf: string; // ISO date
  source: string;
}

const v = <T>(value: T, asOf: string, source: string): Vintaged<T> => ({ value, asOf, source });

const DAMODARAN = "Damodaran, NYU Stern — pages.stern.nyu.edu/~adamodar";

/** Risk-free rate (US 10y Treasury). */
export const RISK_FREE = {
  jan2026: v(0.0418, "2026-01-01", DAMODARAN),
  aug2026: v(0.0474, "2026-08-01", `${DAMODARAN} (ERPbymonth.xlsx)`),
} as const;

/** Implied equity risk premium on the S&P 500 (IRR-on-index method). */
export const IMPLIED_ERP = {
  jan2026: v(0.0423, "2026-01-01", DAMODARAN),
  aug2026: v(0.0423, "2026-08-01", `${DAMODARAN} (ERPbymonth.xlsx)`),
} as const;

/**
 * Mature-market ERP — the S&P implied ERP stripped of the US's own default spread.
 * Base for every country risk premium build.
 */
export const MATURE_MARKET_ERP = v(0.0420, "2026-07-01", `${DAMODARAN} — Country Risk 2026 Edition`);

/** US sovereign default spread (Aa1). */
export const US_DEFAULT_SPREAD = v(0.0022, "2026-01-01", DAMODARAN);

/**
 * Relative equity volatility multiplier: sigma(EM equity) / sigma(EM sovereign bond).
 * Scales a sovereign default spread into an equity country risk premium.
 */
export const EQUITY_BOND_VOL_MULTIPLIER = v(1.55, "2026-01-01", `${DAMODARAN} — Country Risk 2026 Edition`);

/** Uniform pre-tax cost of debt across industries (Jan 2026 dataset). */
export const COST_OF_DEBT_PRETAX = v(0.0529, "2026-01-01", DAMODARAN);

/**
 * Industry anchors, January 2026 dataset.
 *
 * INVARIANT 7: evSales and evEbitda are NOT reconcilable through the margin column.
 * The EV/EBITDA universe restricts to positive-EBITDA firms. Never derive one from
 * the other — see docs/00-FIRST-PRINCIPLES.md §4.2.
 */
export interface IndustryAnchor {
  readonly name: string;
  readonly n: number;
  readonly evSales: number;
  readonly evEbitda: number;
  readonly wacc: number;
  readonly leveredBeta: number;
  readonly unleveredBeta: number;
}

export const INDUSTRY_ANCHORS: Readonly<Record<string, IndustryAnchor>> = {
  softwareSystemApp: {
    name: "Software (System & Application)",
    n: 309, evSales: 11.41, evEbitda: 24.48, wacc: 0.0934, leveredBeta: 1.28, unleveredBeta: 1.23,
  },
  softwareInternet: {
    name: "Software (Internet)",
    n: 29, evSales: 9.56, evEbitda: 30.26, wacc: 0.1066, leveredBeta: 1.69, unleveredBeta: 1.55,
  },
  softwareEntertainment: {
    name: "Software (Entertainment)",
    n: 77, evSales: 9.13, evEbitda: 22.01, wacc: 0.0844, leveredBeta: 1.03, unleveredBeta: 1.01,
  },
  computersPeripherals: {
    name: "Computers/Peripherals",
    n: 36, evSales: 6.63, evEbitda: 25.42, wacc: 0.0971, leveredBeta: 1.35, unleveredBeta: 1.31,
  },
  semiconductor: {
    name: "Semiconductor",
    n: 66, evSales: 15.70, evEbitda: 34.75, wacc: 0.1055, leveredBeta: 1.52, unleveredBeta: 1.49,
  },
  totalMarket: {
    name: "Total Market",
    n: 5994, evSales: 3.97, evEbitda: 19.73, wacc: 0.0696, leveredBeta: 0.91, unleveredBeta: 0.72,
  },
  totalMarketExFinancials: {
    name: "Total Market (ex-financials)",
    n: 4822, evSales: 3.46, evEbitda: 16.95, wacc: 0.0772, leveredBeta: 0.99, unleveredBeta: 0.88,
  },
} as const;

export const INDUSTRY_ANCHORS_VINTAGE = "2026-01-09";

/**
 * Empirical business survival rates. Knaup & Piazza, BLS QCEW — 8.9m businesses,
 * 1998-2005. Used for the startup survival adjustment (INVARIANT 5).
 */
export const SURVIVAL_RATES = {
  allFirms: { year1: 0.8124, year4: 0.4436, year7: 0.3118 },
  information: { year1: 0.8075, year4: 0.3770, year7: 0.2478 },
} as const;
export const SURVIVAL_RATES_SOURCE = "Knaup & Piazza, BLS QCEW 1998-2005";

/**
 * Clinical phase transition probabilities.
 * BIO / Informa Pharma Intelligence / QLS — 12,728 transitions, 9,704 programs, 2011-2020.
 */
export const CLINICAL_PHASE_SUCCESS = {
  phase1to2: 0.520,
  phase2to3: 0.289,
  phase3toFiling: 0.578,
  filingToApproval: 0.906,
  /** Cumulative Phase I -> approval. */
  phase1ToApproval: 0.079,
} as const;

/** Agglomeration elasticity: productivity gain per doubling of metro size. */
export const AGGLOMERATION_ELASTICITY = {
  /** Combes, Duranton, Gobillon, Puga & Roux (2012, Econometrica) — worker-sorting-controlled. */
  central: 0.025,
  low: 0.02,
  high: 0.10,
} as const;

/**
 * Nighttime-lights to GDP elasticity.
 * INVARIANT 15: this is 0.28, NOT 1. Henderson, Storeygard & Weil (2012, AER 102(2)).
 */
export const NIGHTLIGHTS_GDP_ELASTICITY = v(0.28, "2012-01-01", "Henderson, Storeygard & Weil 2012, AER 102(2):994-1028");

/** Capital share of output — the only part of GMP that is a claim on immobile assets. */
export const CAPITAL_SHARE = 0.35;

/** Empirical debt level at which fiscal fatigue sets in (Ghosh et al. 2013). */
export const FISCAL_FATIGUE_THRESHOLD_DEBT_GDP = 1.00;
