/**
 * How far does the answer move when a judgement call moves?
 *
 * This exists so the site can DEMONSTRATE its central honesty claim rather than merely
 * assert it. The sentence "shift the discount rate by one percentage point and human
 * capital moves 25-30%" is abstract; a dial you can drag is not.
 *
 * ⚠️ THIS IS AN APPROXIMATION, and the UI says so.
 *
 * The real ONS calculation is a per-cohort backward recursion over age, sex, education
 * and survival probability. We model the same shape with a level annuity over a working
 * lifetime, which captures the mechanism — value falls as the discount rate rises,
 * steeply, because the stream is long — without pretending to reproduce their model.
 *
 * The baseline is pinned: at the published rate this returns the published figure
 * exactly, so the dial starts from a real number and moves from there.
 */

import type { Trace } from "./trace.ts";

/**
 * Present value of £1 a year for `years` years, discounted at `netRate`.
 *
 * netRate is the discount rate MINUS assumed wage growth — future earnings grow, so what
 * matters is the gap. ONS discount at 3.5% and assume 2% growth, giving a net 1.5%; the
 * World Bank discount at 4% and assume none, giving 4%. That difference is most of why
 * their two figures for the same country are so far apart.
 */
export const annuityFactor = (netRate: number, years: number): number => {
  if (years <= 0) return 0;
  // A zero net rate is a plain sum, not a division by zero.
  if (Math.abs(netRate) < 1e-12) return years;
  return (1 - Math.pow(1 + netRate, -years)) / netRate;
};

export interface HumanCapitalModel {
  /** The published figure, reproduced exactly at `baselineRate`. */
  readonly baseline: number;
  readonly baselineRate: number;
  /** Assumed annual growth in earnings. ONS 2%, World Bank 0%. */
  readonly wageGrowth: number;
  /** Working lifetime in years. */
  readonly years: number;
}

/**
 * Rescale a published human-capital figure to a different discount rate.
 *
 * Ratio of annuity factors, so the baseline is exact by construction and the shape of
 * the sensitivity is right even though the level is a simplification.
 */
export const humanCapitalAtRate = (m: HumanCapitalModel, rate: number): number => {
  const base = annuityFactor(m.baselineRate - m.wageGrowth, m.years);
  if (base === 0) return m.baseline;
  return m.baseline * (annuityFactor(rate - m.wageGrowth, m.years) / base);
};

export interface SensitivityPoint {
  readonly rate: number;
  readonly humanCapital: number;
  readonly total: number;
  /** Change in the total versus the published baseline, as a fraction. */
  readonly changeFromBaseline: number;
}

/** One point on the dial: what the whole answer becomes at this rate. */
export const totalAtRate = (
  m: HumanCapitalModel, otherComponents: number, rate: number,
): SensitivityPoint => {
  const humanCapital = humanCapitalAtRate(m, rate);
  const total = humanCapital + otherComponents;
  const baselineTotal = m.baseline + otherComponents;
  return {
    rate,
    humanCapital,
    total,
    changeFromBaseline: baselineTotal === 0 ? 0 : (total - baselineTotal) / baselineTotal,
  };
};

/**
 * Sensitivity per percentage point, measured around the baseline.
 *
 * Reported so the page can state the real number rather than repeating "25-30%" from a
 * document. Uses a symmetric difference because the relationship is convex.
 */
export const sensitivityPerPercentagePoint = (m: HumanCapitalModel): number => {
  const up = humanCapitalAtRate(m, m.baselineRate + 0.01);
  const down = humanCapitalAtRate(m, m.baselineRate - 0.01);
  return (down - up) / (2 * m.baseline);
};

/** The two conventions in play, so a reader can drag between them. */
export const CONVENTION_MARKS = [
  {
    rate: 0.035, label: "UK statistics office",
    note: "3.5%, with wages assumed to rise 2% a year",
  },
  {
    rate: 0.04, label: "World Bank",
    note: "4%, with no allowance for wages rising",
  },
] as const;

// ---------------------------------------------------------------------------
// Deriving the model from a published trace
// ---------------------------------------------------------------------------


/**
 * Build a sensitivity model from any trace that has a human-capital component and a
 * discount-rate judgement. Returns null when the trace has neither, so the dial only
 * appears where it genuinely applies.
 */
export const modelFromTrace = (
  t: Trace, total: number,
): { model: HumanCapitalModel; otherComponents: number } | null => {
  const human = t.inputs.find(
    (n) => n.kind === "observed" && /human capital/i.test(n.label),
  );
  const rate = t.inputs.find(
    (n) => n.kind === "assumption" && n.unit === "ratio",
  );
  if (!human || !rate) return null;

  // Wage growth is part of the convention, not a free parameter. The UK statistics
  // office assumes 2%; the World Bank assumes none. That difference is most of the gap
  // between their two figures for the same country.
  const wageGrowth = /ONS|statistics office/i.test(rate.label) ? 0.02 : 0;

  return {
    model: {
      baseline: human.value,
      baselineRate: rate.value,
      wageGrowth,
      years: 40,
    },
    otherComponents: total - human.value,
  };
};
