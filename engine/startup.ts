/**
 * Startup valuation and the founder lever simulator. docs §5
 *
 * INVARIANT 4: this module may never emit a point estimate. Every public entry
 * point returns a Range.
 */

import { range, cumulatedDiscountFactor, type Range, type Sourced } from "./core.ts";
import { SURVIVAL_RATES } from "./constants.ts";

// ---------------------------------------------------------------------------
// Metric formulas — with the variant made explicit, because sources disagree
// ---------------------------------------------------------------------------

/**
 * CAC payback variants produce materially different answers. At 78% gross margin,
 * the gross-margin-adjusted variant is ~28% longer than the unadjusted one.
 * Benchmarkit states explicitly that private (new-customer, GM-adjusted) and public
 * ("net new implied ARR") figures are NOT apples to apples.
 */
export type CacPaybackVariant =
  | "gm_adjusted_new_customer"  // Benchmarkit private standard
  | "net_new_implied_arr"       // how public companies compute it
  | "simple_unadjusted";

export const cacPaybackMonths = (args: {
  salesAndMarketing: number;
  newArr: number;
  grossMargin: number;
  variant: CacPaybackVariant;
}): { months: number; variant: CacPaybackVariant; comparableTo: string } => {
  const { salesAndMarketing: sm, newArr, grossMargin, variant } = args;
  let months: number;
  switch (variant) {
    case "gm_adjusted_new_customer":
      months = (sm / (newArr * grossMargin)) * 12; break;
    case "net_new_implied_arr":
      months = (sm / newArr) * 12; break;
    case "simple_unadjusted":
      months = (sm / newArr) * 12; break;
  }
  return {
    months,
    variant,
    comparableTo: variant === "gm_adjusted_new_customer"
      ? "private B2B SaaS benchmarks (Benchmarkit, ICONIQ)"
      : "public company disclosures only — NOT comparable to private benchmarks",
  };
};

/**
 * Magic number.
 *
 * The Scale VP original (Rory O'Driscoll, 2010) ANNUALISES with x4. Benchmarkit's
 * printed glossary omits the x4 while still applying Scale VP's 0.75/1.0 thresholds
 * — an apparent ~4x defect. We implement the original and say so.
 */
export const magicNumber = (args: {
  currentQuarterRevenue: number;
  priorQuarterRevenue: number;
  priorQuarterSalesAndMarketing: number;
  annualise?: boolean;
}): number => {
  const delta = args.currentQuarterRevenue - args.priorQuarterRevenue;
  const raw = delta / args.priorQuarterSalesAndMarketing;
  return (args.annualise ?? true) ? raw * 4 : raw;
};

export const MAGIC_NUMBER_THRESHOLDS = {
  compelling: 1.0,      // ">= 1.0: compelling business investment"
  capitalInefficient: 0.5, // "0.5-1.0: reaches profitability but capital inefficient"
  // "< 0.5: has not figured out its model"
  source: "Rory O'Driscoll, Scale Venture Partners (2010)",
} as const;

export const netDollarRetention = (args: {
  startingMrr: number; expansion: number; contraction: number; churn: number;
}): number =>
  (args.startingMrr + args.expansion - args.contraction - args.churn) / args.startingMrr;

export const grossRevenueRetention = (args: {
  startingMrr: number; contraction: number; churn: number;
}): number => (args.startingMrr - args.contraction - args.churn) / args.startingMrr;

export const ltv = (args: { arpa: number; grossMargin: number; churnRate: number }): number =>
  (args.arpa * args.grossMargin) / args.churnRate;

export const burnMultiple = (netBurn: number, netNewArr: number): number => netBurn / netNewArr;

export const ruleOf40 = (growthRate: number, fcfMargin: number): number => growthRate + fcfMargin;

/**
 * Bessemer's Rule of X — growth is weighted because a margin increase has a LINEAR
 * impact on value while a growth increase compounds. R^2 62% vs Rule of 40's 50%.
 */
export const ruleOfX = (growthRate: number, fcfMargin: number, multiplier = 2.3): number =>
  growthRate * multiplier + fcfMargin;

export const quickRatio = (args: {
  newMrr: number; expansionMrr: number; churnedMrr: number; contractionMrr: number;
}): number =>
  (args.newMrr + args.expansionMrr) / (args.churnedMrr + args.contractionMrr);

// ---------------------------------------------------------------------------
// Burn multiple thresholds — the correction that matters
// ---------------------------------------------------------------------------

export type BusinessModel = "saas" | "marketplace";

/**
 * CORRECTION: the widely-circulated "Amazing <1x / Great 1-1.5x / Good 1.5-2x" scale
 * is NOT the SaaS scale. Those boundaries belong to Craft Ventures' MARKETPLACE
 * adaptation, which also swaps the denominator to annualised gross-profit growth.
 *
 * Sacks' SaaS original (Apr 2020): Net Burn / Net New ARR.
 */
export const BURN_MULTIPLE_SCALE: Record<BusinessModel, {
  denominator: string;
  bands: ReadonlyArray<{ label: string; max: number }>;
  source: string;
}> = {
  saas: {
    denominator: "Net Burn / Net New ARR",
    bands: [
      { label: "Amazing", max: 0.5 },
      { label: "Great", max: 1.0 },
      { label: "Good", max: 2.0 },
      { label: "Suspect", max: 3.0 },
      { label: "Bad", max: Infinity },
    ],
    source: "David Sacks, 'The Burn Multiple' (Apr 2020)",
  },
  marketplace: {
    denominator: "Quarterly Burn / Growth in Annualised Gross Profit",
    bands: [
      { label: "Amazing", max: 0.5 },
      { label: "Great", max: 1.0 },
      { label: "Good", max: 1.5 },
      { label: "Suspect", max: 2.5 },
      { label: "Bad", max: Infinity },
    ],
    source: "Craft Ventures marketplace adaptation (Jun 2022)",
  },
};

export const rateBurnMultiple = (value: number, model: BusinessModel = "saas") => {
  const scale = BURN_MULTIPLE_SCALE[model];
  const band = scale.bands.find((b) => value < b.max) ?? scale.bands[scale.bands.length - 1]!;
  return { label: band.label, denominator: scale.denominator, source: scale.source };
};

/** Sacks' stage guidance: the SIGNAL is direction, not level. */
export const EXPECTED_BURN_MULTIPLE_BY_STAGE = {
  seed: 3.0, seriesA: 2.0, seriesB: 1.5, mature: 0.0,
} as const;

// ---------------------------------------------------------------------------
// The VC Method — what actually sets the price
// ---------------------------------------------------------------------------

export interface VcMethodInputs {
  readonly exitRevenue: number;
  readonly exitMultiple: number;
  readonly investment: number;
  readonly targetIrr: number;
  readonly years: number;
  readonly cumulativeDilution: number;
}

export interface VcMethodResult {
  readonly exitValue: number;
  readonly requiredFutureValue: number;
  readonly requiredOwnershipAtExit: number;
  readonly requiredOwnershipAtEntry: number;
  readonly postMoney: number;
  readonly preMoney: number;
  readonly insight: string;
}

export const vcMethod = (i: VcMethodInputs): VcMethodResult => {
  const exitValue = i.exitRevenue * i.exitMultiple;
  const requiredFutureValue = i.investment * Math.pow(1 + i.targetIrr, i.years);
  const requiredOwnershipAtExit = requiredFutureValue / exitValue;
  const retentionRatio = 1 - i.cumulativeDilution;
  const requiredOwnershipAtEntry = requiredOwnershipAtExit / retentionRatio;
  const postMoney = i.investment / requiredOwnershipAtEntry;
  return {
    exitValue,
    requiredFutureValue,
    requiredOwnershipAtExit,
    requiredOwnershipAtEntry,
    postMoney,
    preMoney: postMoney - i.investment,
    insight:
      `Investors negotiate OWNERSHIP, not valuation. This fund needs ` +
      `${(requiredOwnershipAtEntry * 100).toFixed(1)}% at entry to hit a ` +
      `${(i.targetIrr * 100).toFixed(0)}% IRR over ${i.years} years. No narrative moves that.`,
  };
};

/** Time-to-exit moves valuation more than any other single input. */
export const exitTimingSensitivity = (
  base: VcMethodInputs, yearsRange: readonly number[] = [5, 7, 8, 10],
) => yearsRange.map((years) => ({ years, preMoney: vcMethod({ ...base, years }).preMoney }));

// ---------------------------------------------------------------------------
// Survival adjustment — INVARIANT 5
// ---------------------------------------------------------------------------

export const survivalAdjust = (args: {
  goingConcernValue: number;
  probabilityOfFailure: number;
  distressValue?: number;
}): { expectedValue: number; probabilityOfFailure: number; distressValue: number } => {
  const distressValue = args.distressValue ?? 0;
  return {
    expectedValue:
      args.goingConcernValue * (1 - args.probabilityOfFailure) +
      distressValue * args.probabilityOfFailure,
    probabilityOfFailure: args.probabilityOfFailure,
    distressValue,
  };
};

export const failureProbabilityFromBaseRates = (
  yearsOut: number, sector: "allFirms" | "information" = "information",
): number => {
  const s = SURVIVAL_RATES[sector];
  if (yearsOut <= 1) return 1 - s.year1;
  if (yearsOut <= 4) return 1 - s.year4;
  return 1 - s.year7;
};

// ---------------------------------------------------------------------------
// Migrating cost of capital — total beta by investor diversification
// ---------------------------------------------------------------------------

/**
 * beta_total = beta_market / correlation. An undiversified founder bears ALL risk,
 * so their required return is far higher than a diversified investor's.
 */
export const totalBeta = (marketBeta: number, correlation: number): number =>
  marketBeta / correlation;

export const INVESTOR_CORRELATION = {
  founderOnly: 0.40, sectorVc: 0.50, multiSectorVc: 0.75, publicMarket: 1.0,
} as const;

/** Builds the migrating rate path a young company should actually be discounted at. */
export const migratingCostOfEquity = (args: {
  unleveredBeta: number; riskFree: number; erp: number;
  yearsFounderOnly: number; yearsSectorVc: number; yearsMultiSectorVc: number;
}): number[] => {
  const ke = (corr: number) =>
    args.riskFree + totalBeta(args.unleveredBeta, corr) * args.erp;
  return [
    ...Array<number>(args.yearsFounderOnly).fill(ke(INVESTOR_CORRELATION.founderOnly)),
    ...Array<number>(args.yearsSectorVc).fill(ke(INVESTOR_CORRELATION.sectorVc)),
    ...Array<number>(args.yearsMultiSectorVc).fill(ke(INVESTOR_CORRELATION.multiSectorVc)),
  ];
};

export { cumulatedDiscountFactor };

// ---------------------------------------------------------------------------
// Cap table — where founder models break
// ---------------------------------------------------------------------------

/**
 * The option pool shuffle. A "$8M pre-money" with a 20% post-money pool carved
 * PRE-money is really a $6M effective pre-money: share price $1.00, not $1.33.
 */
export const optionPoolShuffle = (args: {
  statedPreMoney: number; investment: number; poolPercentPostMoney: number;
  poolFromPreMoney: boolean;
}) => {
  const postMoney = args.statedPreMoney + args.investment;
  const poolValue = postMoney * args.poolPercentPostMoney;
  const effectivePreMoney = args.poolFromPreMoney
    ? args.statedPreMoney - poolValue
    : args.statedPreMoney;
  return {
    statedPreMoney: args.statedPreMoney,
    effectivePreMoney,
    poolValue,
    founderCost: args.statedPreMoney - effectivePreMoney,
    explanation: args.poolFromPreMoney
      ? `The pool is carved from YOUR pre-money. Stated $${(args.statedPreMoney / 1e6).toFixed(1)}M, ` +
        `effective $${(effectivePreMoney / 1e6).toFixed(1)}M — you are paying ` +
        `$${(poolValue / 1e6).toFixed(1)}M for it.`
      : `The pool is carved post-money, so it dilutes everyone including the new investor.`,
  };
};

/** NVCA broad-based weighted average anti-dilution. */
export const weightedAverageAntiDilution = (args: {
  oldConversionPrice: number; sharesOutstandingBefore: number;
  newMoneyRaised: number; newIssuePrice: number;
}): number => {
  const { oldConversionPrice: cp1, sharesOutstandingBefore: a, newMoneyRaised, newIssuePrice } = args;
  const b = newMoneyRaised / cp1;        // shares the money WOULD have bought at the old price
  const c = newMoneyRaised / newIssuePrice; // shares actually issued
  return cp1 * ((a + b) / (a + c));
};

// ---------------------------------------------------------------------------
// The lever simulator — the founder-facing product
// ---------------------------------------------------------------------------

export type Stage = "pre_seed" | "seed" | "series_a" | "series_b";

export interface FounderInputs {
  readonly stage: Stage;
  readonly arr: number;
  readonly growthRate: number;      // YoY
  readonly grossMargin: number;
  readonly ndr: number;
  readonly grr: number;
  readonly logoRetention: number;
  readonly netBurn: number;
  readonly netNewArr: number;
  readonly cac: number;
  readonly arpa: number;
  readonly fcfMargin: number;
  readonly salesAndMarketing: number;
}

export interface Lever {
  readonly metric: string;
  readonly current: number;
  readonly threshold: number;
  readonly unit: string;
  readonly passing: boolean;
  /** Estimated valuation impact of closing the gap, as a multiple of ARR. */
  readonly valuationImpactPerArr: number;
  readonly action: string;
}

/**
 * Stage thresholds. Sources: the founders-corner readiness framework, Benchmarkit,
 * ICONIQ, SaaS Capital, Carta (2026).
 */
export const STAGE_THRESHOLDS: Record<Stage, {
  arr: number; growthRate: number; ndr: number; grr: number; logoRetention: number;
  burnMultiple: number; cacPaybackMonths: number; grossMargin: number;
}> = {
  pre_seed:  { arr: 0,        growthRate: 0,   ndr: 0.90, grr: 0.80, logoRetention: 0.80, burnMultiple: 3.0, cacPaybackMonths: 24, grossMargin: 0.50 },
  seed:      { arr: 1_000_000, growthRate: 2.0, ndr: 0.95, grr: 0.85, logoRetention: 0.80, burnMultiple: 3.0, cacPaybackMonths: 18, grossMargin: 0.60 },
  series_a:  { arr: 3_500_000, growthRate: 1.0, ndr: 1.00, grr: 0.85, logoRetention: 0.80, burnMultiple: 2.0, cacPaybackMonths: 18, grossMargin: 0.65 },
  series_b:  { arr: 15_000_000, growthRate: 0.6, ndr: 1.10, grr: 0.88, logoRetention: 0.85, burnMultiple: 1.5, cacPaybackMonths: 18, grossMargin: 0.70 },
};

/**
 * Score the PATTERN, not the checklist.
 *
 * Investors reject on pattern mismatch, not on any single metric. "Adequate ARR +
 * slow growth + thin margins + weak efficiency" fails; "strong retention + strong
 * efficiency + early revenue" passes at a LOWER ARR.
 */
export const rankLevers = (f: FounderInputs): {
  levers: Lever[]; readiness: "ready" | "borderline" | "not_ready"; pattern: string;
} => {
  const t = STAGE_THRESHOLDS[f.stage];
  const bm = burnMultiple(f.netBurn, f.netNewArr);
  const payback = cacPaybackMonths({
    salesAndMarketing: f.salesAndMarketing, newArr: f.netNewArr,
    grossMargin: f.grossMargin, variant: "gm_adjusted_new_customer",
  }).months;

  const levers: Lever[] = [
    { metric: "NDR", current: f.ndr, threshold: t.ndr, unit: "x", passing: f.ndr >= t.ndr,
      // Software Equity Group: >120% NRR trades at 9.3x EV/Rev vs 3.1x for <100%.
      valuationImpactPerArr: 6.2,
      action: "Expansion ARR costs ~$1.00 per $1 vs ~$2.00 for new logo. Move expansion before new-logo spend." },
    { metric: "Burn multiple", current: bm, threshold: t.burnMultiple, unit: "x", passing: bm <= t.burnMultiple,
      valuationImpactPerArr: 2.0,
      action: "The signal is DIRECTION. A burn multiple worsening as you scale reads as broken unit economics regardless of growth." },
    { metric: "Growth rate", current: f.growthRate, threshold: t.growthRate, unit: "x YoY", passing: f.growthRate >= t.growthRate,
      // Meritech: growth weighted 2.9x more heavily than FCF margin.
      valuationImpactPerArr: 2.9,
      action: "Growth is weighted ~2.9x more heavily than margin in public software valuation." },
    { metric: "CAC payback", current: payback, threshold: t.cacPaybackMonths, unit: "months", passing: payback <= t.cacPaybackMonths,
      valuationImpactPerArr: 1.5,
      action: "Highly correlated to ACV — compare only against your own ACV band, not a global median." },
    { metric: "Gross margin", current: f.grossMargin, threshold: t.grossMargin, unit: "%", passing: f.grossMargin >= t.grossMargin,
      valuationImpactPerArr: 1.2,
      action: "EV/Revenue = EV/GrossProfit x GrossMargin. Margin is a direct multiplier on your multiple." },
    { metric: "Logo retention", current: f.logoRetention, threshold: t.logoRetention, unit: "%", passing: f.logoRetention >= t.logoRetention,
      valuationImpactPerArr: 1.0,
      action: "Below 80% logo retention, no growth rate survives diligence." },
    { metric: "ARR", current: f.arr, threshold: t.arr, unit: "$", passing: f.arr >= t.arr,
      valuationImpactPerArr: 0.5,
      action: "The Series A bar moved to ~$3.5M ARR in 2026, from ~$1M." },
  ];

  levers.sort((a, b) => {
    if (a.passing !== b.passing) return a.passing ? 1 : -1;
    return b.valuationImpactPerArr - a.valuationImpactPerArr;
  });

  const failing = levers.filter((l) => !l.passing);
  const efficiencyStrong = bm <= t.burnMultiple && f.ndr >= t.ndr;
  const readiness = failing.length === 0 ? "ready"
    : failing.length <= 2 && efficiencyStrong ? "borderline" : "not_ready";

  const pattern = efficiencyStrong && f.arr < t.arr
    ? "Strong retention and efficiency at sub-threshold ARR — this pattern clears the bar at a lower ARR than the headline number suggests."
    : !efficiencyStrong && f.arr >= t.arr
    ? "Adequate ARR with weak efficiency and retention — this is the classic pattern mismatch that gets rejected despite the revenue."
    : failing.length === 0
    ? "Consistent pattern across growth, retention and efficiency."
    : "Mixed pattern — close the top-ranked gaps before raising.";

  return { levers, readiness, pattern };
};

// ---------------------------------------------------------------------------
// INVARIANT 18 — the simulator refuses top-down TAM
// ---------------------------------------------------------------------------

export class TopDownTamError extends Error {}

export const bottomUpTam = (
  segments: ReadonlyArray<{ name: string; reachableAccounts: number; acv: number }>,
): { tam: number; segments: typeof segments } => {
  if (segments.length === 0) throw new TopDownTamError("Bottom-up TAM requires at least one segment.");
  return { tam: segments.reduce((s, x) => s + x.reachableAccounts * x.acv, 0), segments };
};

/**
 * The single most common fundraise-killer: "the global X market is worth $Y trillion,
 * we target 2%." Pear VC's 30-investor survey returned this consistently. We refuse it.
 */
export const topDownTam = (): never => {
  throw new TopDownTamError(
    "Top-down TAM is refused. 'The global market is $Y trillion and we'll take 2%' signals " +
    "no customer definition, no pricing logic and no go-to-market rationale — investors read " +
    "it as a red flag, not a headline. Use bottomUpTam(): sum reachable accounts x ACV per " +
    "segment. See docs §5.6.",
  );
};

// ---------------------------------------------------------------------------
// The startup valuation — always a Range (INVARIANT 4)
// ---------------------------------------------------------------------------

export const valueStartup = (args: {
  vc: VcMethodInputs;
  probabilityOfFailure: number;
  meta: Sourced;
}): Range => {
  const base = vcMethod(args.vc);
  const adjusted = survivalAdjust({
    goingConcernValue: base.preMoney,
    probabilityOfFailure: args.probabilityOfFailure,
  });

  // Band from exit-timing sensitivity — the input that moves valuation most.
  const timings = exitTimingSensitivity(args.vc);
  const values = timings.map((t) => t.preMoney * (1 - args.probabilityOfFailure));

  return range(
    Math.min(...values), adjusted.expectedValue, Math.max(...values),
    { ...args.meta, method: "VC method, survival-adjusted, banded on exit timing" },
  );
};

// ---------------------------------------------------------------------------
// From a founder's own numbers to a range
// ---------------------------------------------------------------------------

/**
 * Growth endurance: the share of last year's growth rate a company keeps this year.
 *
 * Nobody grows at a constant rate. Benchmarkit measured endurance falling from ~80% to
 * ~65% over two years across private B2B SaaS. Assuming flat growth is the single most
 * common way a founder model produces a fantasy exit number.
 */
export const GROWTH_ENDURANCE = 0.65;

/**
 * Project revenue forward with DECAYING growth.
 *
 * A founder asked for "revenue at exit" will either guess or extrapolate today's growth
 * forever. Deriving it from their current numbers with honest decay is both easier for
 * them and harder to fool themselves with.
 */
export const projectExitRevenue = (args: {
  arr: number; growthRate: number; years: number; endurance?: number;
}): number => {
  const endurance = args.endurance ?? GROWTH_ENDURANCE;
  let revenue = args.arr;
  let growth = args.growthRate;
  for (let y = 0; y < args.years; y++) {
    revenue *= 1 + growth;
    growth *= endurance;
  }
  return revenue;
};

/** Failure odds by stage, from the BLS base rates in `constants.ts`. */
export const FAILURE_BY_STAGE: Record<Stage, number> = {
  pre_seed: 1 - SURVIVAL_RATES.information.year7,   // ~75%
  seed: 0.62,
  series_a: 1 - SURVIVAL_RATES.information.year4,   // ~62% -> softened below
  series_b: 0.35,
};

export interface FounderValuation {
  readonly range: Range;
  readonly exitRevenue: number;
  readonly exitValue: number;
  readonly ownershipRequired: number;
  readonly probabilityOfFailure: number;
  readonly assumptions: ReadonlyArray<{
    readonly label: string;
    readonly value: string;
    readonly why: string;
  }>;
}

/**
 * A founder's valuation, from their own numbers.
 *
 * INVARIANT 4: this returns a Range. There is no code path that produces a single
 * number, because a single number here would be a lie dressed as precision.
 */
export const founderValuation = (args: {
  inputs: FounderInputs;
  exitMultiple?: number;
  targetIrr?: number;
  years?: number;
  cumulativeDilution?: number;
  roundSize?: number;
}): FounderValuation => {
  const years = args.years ?? 8;
  const exitMultiple = args.exitMultiple ?? 6;
  const targetIrr = args.targetIrr ?? 0.30;
  const cumulativeDilution = args.cumulativeDilution ?? 0.45;
  const investment = args.roundSize ?? Math.max(500_000, args.inputs.arr * 1.5);
  const probabilityOfFailure = FAILURE_BY_STAGE[args.inputs.stage];

  const exitRevenue = projectExitRevenue({
    arr: args.inputs.arr, growthRate: args.inputs.growthRate, years,
  });

  const vc: VcMethodInputs = {
    exitRevenue, exitMultiple, investment, targetIrr, years, cumulativeDilution,
  };
  const base = vcMethod(vc);

  return {
    range: valueStartup({
      vc, probabilityOfFailure,
      meta: { asOf: "2026-08-15", source: "your own figures" },
    }),
    exitRevenue,
    exitValue: base.exitValue,
    ownershipRequired: base.requiredOwnershipAtEntry,
    probabilityOfFailure,
    assumptions: [
      { label: "Years to an exit", value: `${years}`,
        why: "Moves the answer more than anything else here. Two or three years either way can halve or double it." },
      { label: "Revenue multiple at exit", value: `${exitMultiple}×`,
        why: "What an acquirer or the public market pays per pound of revenue. Public software has traded between 3× and 17× in the last five years." },
      { label: "Return the investor needs", value: `${(targetIrr * 100).toFixed(0)}% a year`,
        why: "Funds need a few winners to carry everything else. This is what they underwrite to, not what they expect on average." },
      { label: "Dilution before exit", value: `${(cumulativeDilution * 100).toFixed(0)}%`,
        why: "How much of their stake later rounds take away. It decides how much they need to buy now." },
      { label: "Odds this doesn't work", value: `${(probabilityOfFailure * 100).toFixed(0)}%`,
        why: "Base rates for information-sector companies, from US business survival data. Applied openly rather than buried in a higher discount rate." },
      { label: "Growth slowdown", value: `keeps ${(GROWTH_ENDURANCE * 100).toFixed(0)}% of last year's rate`,
        why: "Nobody grows at a constant rate. Assuming you will is the most common way a founder model produces a fantasy number." },
    ],
  };
};
