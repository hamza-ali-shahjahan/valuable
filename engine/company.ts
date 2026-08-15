/**
 * Company valuation. docs/00-FIRST-PRINCIPLES.md §4
 */

import { cumulatedDiscountFactor, perpetuity } from "./core.ts";
import { RISK_FREE, IMPLIED_ERP, COST_OF_DEBT_PRETAX } from "./constants.ts";

// ---------------------------------------------------------------------------
// Cost of capital
// ---------------------------------------------------------------------------

export const unleverBeta = (leveredBeta: number, taxRate: number, debtToEquity: number): number =>
  leveredBeta / (1 + (1 - taxRate) * debtToEquity);

export const releverBeta = (unleveredBeta: number, taxRate: number, debtToEquity: number): number =>
  unleveredBeta * (1 + (1 - taxRate) * debtToEquity);

export const costOfEquity = (
  beta: number, riskFree = RISK_FREE.aug2026.value, erp = IMPLIED_ERP.aug2026.value,
): number => riskFree + beta * erp;

export const wacc = (args: {
  costOfEquity: number; costOfDebtPreTax?: number; taxRate: number;
  equityWeight: number; debtWeight: number;
}): number => {
  const kd = args.costOfDebtPreTax ?? COST_OF_DEBT_PRETAX.value;
  return args.costOfEquity * args.equityWeight + kd * (1 - args.taxRate) * args.debtWeight;
};

// ---------------------------------------------------------------------------
// FCFF DCF with the mandatory consistency check
// ---------------------------------------------------------------------------

export interface FcffInputs {
  readonly revenue: readonly number[];
  readonly operatingMargin: readonly number[];
  readonly taxRate: number;
  /** Sector revenue-to-book-capital. Drives reinvestment. */
  readonly salesToCapital: number;
  readonly investedCapital0: number;
  /** Cost of capital per period — may migrate (INVARIANT 3). */
  readonly wacc: readonly number[];
  readonly terminalGrowth: number;
  readonly terminalRoic: number;
  readonly terminalWacc: number;
  /** Net operating loss carryforward available at t=0. */
  readonly nolCarryforward?: number;
}

export interface FcffYear {
  readonly year: number;
  readonly revenue: number;
  readonly ebit: number;
  readonly taxPaid: number;
  readonly nopat: number;
  readonly reinvestment: number;
  readonly fcff: number;
  readonly investedCapital: number;
  /** INVARIANT 2 — always reported, never hidden. */
  readonly imputedRoic: number | null;
}

export interface FcffResult {
  readonly years: readonly FcffYear[];
  readonly terminalValue: number;
  readonly pvExplicit: number;
  readonly pvTerminal: number;
  readonly operatingValue: number;
  /** Share of value in the terminal year. Above ~0.8 the model is a TV assumption. */
  readonly terminalValueShare: number;
  readonly consistencyWarnings: readonly string[];
}

export const fcffValuation = (i: FcffInputs): FcffResult => {
  const n = i.revenue.length;
  if (i.operatingMargin.length !== n || i.wacc.length !== n) {
    throw new Error("revenue, operatingMargin and wacc must be the same length");
  }

  const years: FcffYear[] = [];
  let investedCapital = i.investedCapital0;
  let nol = i.nolCarryforward ?? 0;

  for (let t = 0; t < n; t++) {
    const revenue = i.revenue[t]!;
    const ebit = revenue * i.operatingMargin[t]!;

    // NOL carryforward shelters early profits (Damodaran step 3).
    let taxable = ebit;
    if (ebit < 0) { nol += -ebit; taxable = 0; }
    else if (nol > 0) { const used = Math.min(nol, ebit); nol -= used; taxable = ebit - used; }
    const taxPaid = Math.max(0, taxable) * i.taxRate;
    const nopat = ebit - taxPaid;

    // Reinvestment lags revenue growth by one year.
    const nextRevenue = i.revenue[t + 1] ?? revenue * (1 + i.terminalGrowth);
    const reinvestment = (nextRevenue - revenue) / i.salesToCapital;

    const openingCapital = investedCapital;
    const imputedRoic = t === 0 ? null : nopat / openingCapital;

    years.push({
      year: t + 1, revenue, ebit, taxPaid, nopat, reinvestment,
      fcff: nopat - reinvestment, investedCapital: openingCapital, imputedRoic,
    });

    investedCapital += reinvestment;
  }

  // Terminal value with the stable-growth constraint. perpetuity() enforces g <= Rf.
  const lastRevenue = i.revenue[n - 1]!;
  const terminalRevenue = lastRevenue * (1 + i.terminalGrowth);
  const terminalMargin = i.operatingMargin[n - 1]!;
  const terminalNopat = terminalRevenue * terminalMargin * (1 - i.taxRate);
  const terminalReinvestmentRate = i.terminalGrowth / i.terminalRoic;
  const terminalFcff = terminalNopat * (1 - terminalReinvestmentRate);
  const terminalValue = perpetuity(terminalFcff, i.terminalWacc, i.terminalGrowth);

  // INVARIANT 3: cumulated factors, not a single averaged rate.
  let pvExplicit = 0;
  for (let t = 0; t < n; t++) {
    pvExplicit += years[t]!.fcff / cumulatedDiscountFactor(i.wacc.slice(0, t + 1));
  }
  const pvTerminal = terminalValue / cumulatedDiscountFactor(i.wacc);
  const operatingValue = pvExplicit + pvTerminal;

  // INVARIANT 2: surface consistency problems rather than burying them.
  const warnings: string[] = [];
  const finalRoic = years[n - 1]?.imputedRoic;
  if (finalRoic !== null && finalRoic !== undefined) {
    if (finalRoic > i.terminalRoic * 2) {
      warnings.push(
        `Imputed ROIC in the final year (${(finalRoic * 100).toFixed(1)}%) is more than ` +
        `double the assumed stable ROIC (${(i.terminalRoic * 100).toFixed(1)}%) — the model ` +
        `is under-reinvesting and the valuation is optimistic.`,
      );
    }
    if (finalRoic < i.terminalWacc) {
      warnings.push(
        `Imputed ROIC (${(finalRoic * 100).toFixed(1)}%) is below the cost of capital ` +
        `(${(i.terminalWacc * 100).toFixed(1)}%) — the model is over-reinvesting; growth is ` +
        `destroying value.`,
      );
    }
  }
  const tvShare = pvTerminal / operatingValue;
  if (tvShare > 0.8) {
    warnings.push(
      `${(tvShare * 100).toFixed(0)}% of value sits in the terminal value — this is a ` +
      `terminal-assumption model, not a cash-flow model.`,
    );
  }

  return {
    years, terminalValue, pvExplicit, pvTerminal, operatingValue,
    terminalValueShare: tvShare, consistencyWarnings: warnings,
  };
};

// ---------------------------------------------------------------------------
// Breakeven revenue — inverting the market (§4.3)
// ---------------------------------------------------------------------------

export interface BreakevenResult {
  readonly requiredNetIncome: number;
  readonly breakevenRevenue: number;
  readonly currentRevenue: number;
  readonly revenueGap: number;
  /** CAGR required to close the gap over `years`. */
  readonly requiredGrowthRate: number;
}

export const breakevenRevenue = (args: {
  equityValue: number; costOfEquity: number; terminalGrowth: number;
  netMargin: number; currentRevenue: number; years: number;
}): BreakevenResult => {
  const { equityValue: v, costOfEquity: ke, terminalGrowth: g, netMargin, currentRevenue, years } = args;
  if (ke <= g) throw new Error(`Cost of equity ${ke} must exceed growth ${g}`);
  const requiredNetIncome = (v * (ke - g)) / (1 + g);
  const be = requiredNetIncome / netMargin;
  return {
    requiredNetIncome,
    breakevenRevenue: be,
    currentRevenue,
    revenueGap: be - currentRevenue,
    requiredGrowthRate: Math.pow(be / currentRevenue, 1 / years) - 1,
  };
};

/**
 * Big Market Delusion detector: sum the breakeven revenues of a cohort and compare
 * to a plausible total market. When the sum exceeds the market, the cohort cannot
 * collectively justify its marks even if each individually looks defensible.
 */
export const bigMarketDelusion = (
  cohort: ReadonlyArray<{ name: string; breakevenRevenue: number; currentRevenue: number }>,
  plausibleTam: number,
) => {
  const required = cohort.reduce((s, c) => s + c.breakevenRevenue, 0);
  const current = cohort.reduce((s, c) => s + c.currentRevenue, 0);
  return {
    requiredAggregateRevenue: required,
    currentAggregateRevenue: current,
    plausibleTam,
    impliedShareOfTam: required / plausibleTam,
    delusional: required > plausibleTam,
  };
};

// ---------------------------------------------------------------------------
// The cross-sector bridge (§4.4) — how to compare unlike businesses
// ---------------------------------------------------------------------------

/**
 * EV/Revenue = EV/GrossProfit x GrossMargin.
 * EV/GrossProfit is the sector-neutral comparator; EV/Revenue is not.
 */
export const evToRevenue = (evToGrossProfit: number, grossMargin: number): number =>
  evToGrossProfit * grossMargin;

export const evToGrossProfit = (evToRevenue: number, grossMargin: number): number =>
  evToRevenue / grossMargin;

/**
 * EV/GMV = EV/NetRevenue x take rate.
 * At a constant 5x EV/net-revenue, a 30%-take-rate marketplace is worth 1.50x GMV and
 * a 5%-take-rate marketplace 0.25x GMV. GMV multiples standalone are near-meaningless.
 */
export const evToGmv = (evToNetRevenue: number, takeRate: number): number =>
  evToNetRevenue * takeRate;

export const takeRate = (netRevenue: number, gmv: number): number => netRevenue / gmv;

/**
 * Lenders get bank multiples for a structural reason: P/TBV = (ROTCE - g)/(COE - g).
 * No plausible ROTCE produces a 10x revenue multiple.
 */
export const priceToTangibleBook = (rotce: number, costOfEquity: number, g: number): number => {
  if (costOfEquity <= g) throw new Error(`Cost of equity ${costOfEquity} must exceed growth ${g}`);
  return (rotce - g) / (costOfEquity - g);
};

/**
 * Risk-adjusted NPV for biotech. Clinical risk goes in the PROBABILITY, not the
 * discount rate — using a 25-30% WACC *and* a PoS double-counts (INVARIANT 5).
 */
export const rnpv = (args: {
  cashFlows: readonly number[];
  cumulativeProbabilities: readonly number[];
  discountRate: number;
}): number => {
  const { cashFlows, cumulativeProbabilities, discountRate } = args;
  if (cashFlows.length !== cumulativeProbabilities.length) {
    throw new Error("cashFlows and cumulativeProbabilities must align");
  }
  if (discountRate > 0.20) {
    throw new Error(
      `INVARIANT 5: discount rate ${(discountRate * 100).toFixed(0)}% together with an ` +
      `explicit probability of success double-counts clinical risk. Use a commercial ` +
      `rate (7-15%) and let PoS carry the clinical risk.`,
    );
  }
  return cashFlows.reduce(
    (pv, cf, t) => pv + (cf * cumulativeProbabilities[t]!) / Math.pow(1 + discountRate, t),
    0,
  );
};

// ---------------------------------------------------------------------------
// Sector routing — which denominator applies
// ---------------------------------------------------------------------------

export type Sector =
  | "saas" | "marketplace" | "payments" | "lending" | "biotech" | "hardware" | "consumer_app";

export const PRIMARY_METRIC: Record<Sector, string> = {
  saas: "EV/ARR and EV/gross profit",
  marketplace: "EV/net revenue (never GMV alone)",
  payments: "EV/net revenue; take rate in bps",
  lending: "P/TBV and P/E — never revenue multiples",
  biotech: "rNPV",
  hardware: "EV/gross profit, with cash conversion cycle",
  consumer_app: "EV/revenue, $/DAU, LTV from the retention curve",
};

export class WrongDenominatorError extends Error {}

/** Refuse to apply a revenue multiple to a lender. */
export const assertValidDenominator = (sector: Sector, denominator: "revenue" | "book" | "rnpv"): void => {
  if (sector === "lending" && denominator === "revenue") {
    throw new WrongDenominatorError(
      "Lenders cannot be valued on revenue multiples. CECL front-loads lifetime losses " +
      "so growth destroys near-term earnings, and leverage means a 2pp charge-off surprise " +
      "wipes out years of ROE. Use P/TBV = (ROTCE - g)/(COE - g). See docs §4.4.",
    );
  }
  if (sector === "biotech" && denominator !== "rnpv") {
    throw new WrongDenominatorError(
      "Clinical-stage biotech requires rNPV — binary phase outcomes are not captured by " +
      "a multiple. See docs §4.4.",
    );
  }
};

/**
 * Consumer retention is a power law, not an exponential. Fitting an exponential
 * systematically understates long-tail LTV.
 */
export const retentionPowerLaw = (a: number, b: number) => (t: number): number =>
  t <= 0 ? 1 : a * Math.pow(t, -b);

export const ltvFromRetentionCurve = (
  retention: (t: number) => number, arpdau: number, horizonDays: number,
): number => {
  let ltv = 0;
  for (let t = 1; t <= horizonDays; t++) ltv += retention(t) * arpdau;
  return ltv;
};
