/**
 * The universal value identity and the primitives every entity type shares.
 * docs/00-FIRST-PRINCIPLES.md §1
 */

import { RISK_FREE } from "./constants.ts";

// ---------------------------------------------------------------------------
// Provenance — INVARIANT 6: every number carries its source and vintage.
// ---------------------------------------------------------------------------

export interface Sourced {
  /** ISO date of the underlying observation, not of computation. */
  readonly asOf: string;
  readonly source: string;
  /** Set when the figure is modelled rather than observed (INVARIANT 14). */
  readonly method?: string;
}

/**
 * A value that is explicitly a range.
 *
 * INVARIANT 4 & 9: startups and countries may never emit a point estimate. Using
 * this type rather than `number` makes that a compile-time property, not a
 * convention someone can forget.
 */
export interface Range extends Sourced {
  readonly low: number;
  readonly central: number;
  readonly high: number;
}

export const range = (
  low: number, central: number, high: number, meta: Sourced,
): Range => {
  if (!(low <= central && central <= high)) {
    throw new Error(`Malformed range: ${low} <= ${central} <= ${high} is false`);
  }
  return { low, central, high, ...meta };
};

/** Width of a range as a fraction of its central value — the honesty metric. */
export const rangeWidth = (r: Range): number =>
  r.central === 0 ? Infinity : (r.high - r.low) / Math.abs(r.central);

// ---------------------------------------------------------------------------
// Discounting
// ---------------------------------------------------------------------------

/**
 * Cumulated discount factor for a path of period rates.
 *
 * INVARIANT 3: when the cost of capital migrates across periods (as it must for a
 * startup moving from founder-only to post-IPO diversification), the discount factor
 * is the PRODUCT of period factors, never a single averaged rate.
 *
 * Damodaran's worked example: (1.19)^2 x (1.16)^2 x (1.12) = 2.13416 for year 5.
 */
export const cumulatedDiscountFactor = (rates: readonly number[]): number =>
  rates.reduce((acc, r) => acc * (1 + r), 1);

/** Present value of a cash-flow path under a (possibly migrating) rate path. */
export const presentValue = (
  cashFlows: readonly number[],
  rates: readonly number[],
): number => {
  if (cashFlows.length !== rates.length) {
    throw new Error(`Cash flows (${cashFlows.length}) and rates (${rates.length}) must align`);
  }
  let pv = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    pv += cashFlows[t]! / cumulatedDiscountFactor(rates.slice(0, t + 1));
  }
  return pv;
};

/**
 * Gordon growth perpetuity.
 *
 * INVARIANT 1: g <= riskFree. A firm growing faster than the economy forever
 * eventually becomes the economy. Enforced, not documented.
 */
export const perpetuity = (
  cashFlow: number, r: number, g: number, riskFree = RISK_FREE.aug2026.value,
): number => {
  if (g > riskFree) {
    throw new Error(
      `INVARIANT 1 violated: terminal growth ${(g * 100).toFixed(2)}% exceeds the ` +
      `risk-free rate ${(riskFree * 100).toFixed(2)}%. Nothing grows faster than the ` +
      `economy in perpetuity.`,
    );
  }
  if (r <= g) {
    throw new Error(`Discount rate ${r} must exceed growth ${g}`);
  }
  return cashFlow / (r - g);
};

// ---------------------------------------------------------------------------
// The universal identity — docs §1.1
// ---------------------------------------------------------------------------

export interface IdentityInputs {
  /** Invested capital at t=0. Approximately zero for a startup. */
  readonly investedCapital: number;
  /** Return on invested capital, per period. */
  readonly roic: readonly number[];
  /** Weighted average cost of capital, per period. */
  readonly wacc: readonly number[];
  /** Growth rate of the capital base, per period. */
  readonly capitalGrowth: readonly number[];
}

export interface IdentityResult {
  readonly investedCapital: number;
  /** PV of economic profit — the (ROIC - WACC) spread capitalised. */
  readonly economicProfitPV: number;
  readonly value: number;
  /**
   * value - investedCapital. For a country this is institutional capital; for a
   * company, goodwill and moat; for a startup, the entire valuation.
   */
  readonly intangibleCapital: number;
}

/**
 * V = IC + sum_t [ (ROIC_t - WACC_t) * IC_{t-1} ] / prod(1 + WACC_s)
 *
 * The residual-income (EVA) form. Algebraically identical to DCF, but it separates
 * what an entity HAS from what it DOES with it — which is where policy, leadership
 * and execution live.
 */
export const universalValue = (inputs: IdentityInputs): IdentityResult => {
  const { investedCapital, roic, wacc, capitalGrowth } = inputs;
  const n = roic.length;
  if (wacc.length !== n || capitalGrowth.length !== n) {
    throw new Error("roic, wacc and capitalGrowth must be the same length");
  }

  let ic = investedCapital;
  let economicProfitPV = 0;

  for (let t = 0; t < n; t++) {
    const spread = roic[t]! - wacc[t]!;
    const economicProfit = spread * ic;
    economicProfitPV += economicProfit / cumulatedDiscountFactor(wacc.slice(0, t + 1));
    ic = ic * (1 + capitalGrowth[t]!);
  }

  const value = investedCapital + economicProfitPV;
  return {
    investedCapital,
    economicProfitPV,
    value,
    intangibleCapital: value - investedCapital,
  };
};

// ---------------------------------------------------------------------------
// Change decomposition — docs §1.3, the heart of the tracker
// ---------------------------------------------------------------------------

export interface Sensitivities {
  /** dV/dg = V / (r - g) */
  readonly toGrowth: number;
  /** dV/dr = -V / (r - g) */
  readonly toDiscountRate: number;
  /** The 1/(r-g) magnification factor itself. */
  readonly magnification: number;
}

/**
 * Both sensitivities are magnified by 1/(r-g). At r-g = 3%, a 100bp move in either
 * direction changes value by ~33%.
 *
 * This is why leadership and policy shocks hit valuation through the DISCOUNT RATE,
 * not through cash flows — and why they hit instantly while GDP revisions lag.
 * It is the entire justification for the event-annotation layer.
 */
export const sensitivities = (value: number, r: number, g: number): Sensitivities => {
  if (r <= g) throw new Error(`Discount rate ${r} must exceed growth ${g}`);
  const magnification = 1 / (r - g);
  return {
    toGrowth: value * magnification,
    toDiscountRate: -value * magnification,
    magnification,
  };
};

/**
 * Build a range from verified parameter sensitivities rather than a symmetric
 * percentage guess.
 *
 * INVARIANT 9: bands come from the actual sensitivity of the model to its most
 * uncertain input. Never a placeholder +/-10%.
 */
export const bandFromRateShock = (
  central: number, r: number, g: number, shockBp: number, meta: Sourced,
): Range => {
  const shock = shockBp / 10_000;
  // V ∝ 1/(r-g); shocking r up shrinks value, down expands it.
  const high = central * (r - g) / (r - shock - g);
  const low = central * (r - g) / (r + shock - g);
  return range(low, central, high, meta);
};
