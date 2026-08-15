/**
 * The event-annotation layer — the moat. docs/02-EVENT-CORPUS.md
 *
 * This is the part nobody else sells: leadership, parties and policy decisions tied to
 * movements in a valuation series.
 *
 * THE GOVERNING CONSTRAINT: identification quality varies enormously across episodes.
 * Brexit has synthetic-control estimates with placebo inference. Rwanda has no
 * counterfactual at all and contested outcome data. A product that renders both as
 * "policy X moved value by Y%" is not credible.
 *
 * The tier is therefore structural, not decorative: a narrative claim is a type that
 * CANNOT carry a point estimate. You cannot forget to downgrade it.
 */

import type { Sourced } from "./core.ts";

// ---------------------------------------------------------------------------
// Evidence tiers
// ---------------------------------------------------------------------------

/**
 * How the causal claim was identified. Ordered strongest to weakest.
 *
 * The distinction that matters most is `measured` vs `narrative`. Everything above
 * `narrative` has a counterfactual; `narrative` does not.
 */
export type IdentificationStrategy =
  | "synthetic_control"      // donor-pool counterfactual + placebo inference
  | "difference_in_differences"
  | "regression_discontinuity"
  | "instrumental_variable"
  | "event_study"            // high-frequency market response to announcement
  | "forecast_error"         // ex-ante plan vs ex-post outcome (Blanchard-Leigh)
  | "structural_model"       // calibrated counterfactual simulation
  | "official_assumption";   // an institution's own published assumption (e.g. OBR)

export const HAS_COUNTERFACTUAL: Record<IdentificationStrategy, boolean> = {
  synthetic_control: true,
  difference_in_differences: true,
  regression_discontinuity: true,
  instrumental_variable: true,
  event_study: true,
  forecast_error: true,
  structural_model: true,
  official_assumption: false, // an assumption is not an estimate
};

/**
 * How each method works, in words a reader without a statistics background can follow.
 *
 * The point of showing the method at all is so a reader can judge how much to trust the
 * number. That only works if they can understand what the method was.
 */
export const STRATEGY_PLAIN: Record<IdentificationStrategy, { short: string; how: string }> = {
  synthetic_control: {
    short: "Compared against a stand-in country",
    how:
      "Researchers built an artificial 'twin' Britain out of other countries that had " +
      "behaved almost identically for years beforehand, then watched the two come apart " +
      "after the event. The gap between real and twin is the estimated effect.",
  },
  difference_in_differences: {
    short: "Compared two groups over the same period",
    how:
      "Track something affected by the change and something that wasn't, over the same " +
      "years. Both feel the same economy and the same shocks, so the difference between " +
      "how they moved is what the change itself did.",
  },
  regression_discontinuity: {
    short: "Compared just either side of a cut-off",
    how:
      "Where a rule applies above a threshold and not below it, places just either side " +
      "are near-identical apart from the rule. Comparing them isolates its effect.",
  },
  instrumental_variable: {
    short: "Used an unrelated nudge to isolate cause",
    how:
      "Find something that pushed the cause around for reasons unconnected to the " +
      "outcome, then follow that push through. It separates cause from coincidence.",
  },
  event_study: {
    short: "Measured the market reaction, hour by hour",
    how:
      "Watch prices in the minutes and hours around an announcement. Over such a short " +
      "window almost nothing else can explain a move that size.",
  },
  forecast_error: {
    short: "Compared what was predicted with what happened",
    how:
      "Because the plans were published before the results came in, comparing the two " +
      "shows whether forecasters' assumptions were wrong, and by how much.",
  },
  structural_model: {
    short: "Simulated what would otherwise have happened",
    how:
      "A model of how the economy works is used to replay events without the change. " +
      "Weaker than a real comparison, because the answer depends on the model.",
  },
  official_assumption: {
    short: "An official's judgement, not a measurement",
    how:
      "A number an official body adopted as its working assumption. It carries authority " +
      "and it shapes real budgets — but nobody measured it against a comparison, so it " +
      "is not evidence of an effect.",
  },
};

/** For a claim with no comparison at all. */
export const NO_COUNTERFACTUAL_PLAIN = {
  short: "No fair comparison exists",
  how:
    "Nothing here can serve as a 'what would have happened otherwise', so there is no " +
    "honest number to give. We describe what happened and say plainly that we cannot " +
    "measure how much of it the decision caused.",
} as const;

/**
 * A causal claim backed by a design with a counterfactual.
 * Carrying a point estimate REQUIRES this shape.
 */
export interface MeasuredEffect extends Sourced {
  readonly kind: "measured";
  readonly strategy: IdentificationStrategy;
  /** What the design actually exploits. Free text, but mandatory and non-trivial. */
  readonly identification: string;
  readonly metric: string;
  /** The point estimate, as a fraction (−0.052 = −5.2%). */
  readonly estimate: number;
  /** Range across specifications, where the source reports one. */
  readonly low?: number;
  readonly high?: number;
  readonly unit: "fraction_of_gdp" | "pp" | "fraction" | "bp" | "level";
  /** Placebo tests, p-values, robustness — how we know it isn't noise. */
  readonly inference?: string;
  readonly citation: string;
  readonly url?: string;
}

/**
 * A causal claim with NO counterfactual.
 *
 * Structurally incapable of carrying a point estimate — there is no `estimate` field.
 * This is how Rwanda and Singapore are represented, and why they can never be rendered
 * as "policy X moved value by Y%".
 */
export interface NarrativeClaim extends Sourced {
  readonly kind: "narrative";
  readonly direction: "increase" | "decrease" | "ambiguous";
  readonly mechanism: string;
  /** Why no counterfactual exists. Mandatory — forces the author to confront it. */
  readonly whyNotIdentified: string;
  /** Published disputes over the underlying data or interpretation. */
  readonly contestation?: readonly string[];
  readonly citation: string;
  readonly url?: string;
}

export type CausalClaim = MeasuredEffect | NarrativeClaim;

/** A market response — observed, not modelled. Distinct from a causal claim. */
export interface MarketResponse extends Sourced {
  readonly instrument: string;
  readonly before: number;
  readonly after: number;
  readonly window: string;
  readonly unit: string;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type EventCategory =
  | "election" | "referendum" | "leadership_change" | "budget"
  | "monetary_policy" | "trade_policy" | "fiscal_policy" | "regulatory"
  | "default" | "restructuring" | "rating_action" | "external_shock";

export interface PolicyEvent {
  readonly id: string;
  readonly iso3: string;
  /** ISO date. Events are dated to the day — markets reprice in hours. */
  readonly date: string;
  readonly category: EventCategory;
  readonly title: string;
  readonly description: string;
  /** Who was in office, and their party. The user asked for this explicitly. */
  readonly leader?: string;
  readonly party?: string;
  readonly claims: readonly CausalClaim[];
  readonly marketResponses?: readonly MarketResponse[];
}

export interface Leader {
  readonly iso3: string;
  readonly name: string;
  readonly party: string;
  readonly from: string;
  readonly to: string | null;
  readonly note?: string;
}

// ---------------------------------------------------------------------------
// The guard — INVARIANT 19
// ---------------------------------------------------------------------------

export class OverclaimError extends Error {}

/**
 * INVARIANT 19: a narrative claim may never be rendered as a measured effect.
 *
 * Use this at every render boundary. It returns the number ONLY when the claim has a
 * counterfactual behind it.
 */
export const effectSize = (claim: CausalClaim): number => {
  if (claim.kind === "narrative") {
    throw new OverclaimError(
      `INVARIANT 19 violated: "${claim.mechanism}" is a narrative claim with no ` +
      `counterfactual (${claim.whyNotIdentified}). It has no effect size and must not ` +
      `be rendered as one. See docs/02-EVENT-CORPUS.md.`,
    );
  }
  if (!HAS_COUNTERFACTUAL[claim.strategy]) {
    throw new OverclaimError(
      `INVARIANT 19 violated: "${claim.metric}" rests on ${claim.strategy}, which has ` +
      `no counterfactual. An institution's published assumption is not an estimate.`,
    );
  }
  return claim.estimate;
};

/** Safe accessor for display: returns null instead of throwing. */
export const effectSizeOrNull = (claim: CausalClaim): number | null => {
  try { return effectSize(claim); } catch { return null; }
};

/**
 * A measured effect must state what its design exploits. An empty or hand-wavy
 * identification string is the tell for a claim that was tiered up without warrant.
 */
export const assertIdentificationStated = (claim: MeasuredEffect): void => {
  if (claim.identification.trim().length < 30) {
    throw new OverclaimError(
      `A measured effect must state its identification strategy in substance. ` +
      `"${claim.identification}" is too thin to audit.`,
    );
  }
};

// ---------------------------------------------------------------------------
// Figures that failed verification — encoded so they cannot creep back in
// ---------------------------------------------------------------------------

/**
 * Widely-circulated numbers that did NOT survive verification.
 *
 * These are in the corpus precisely because they are plausible, repeated, and wrong.
 * The ingestion linter checks incoming claims against this list.
 */
export const REFUTED_FIGURES: ReadonlyArray<{
  claim: string; correction: string; note: string;
}> = [
  {
    claim: "Brexit reduced inward FDI projects by 37%",
    correction: "16–20% (services ~25%) — Serwicka & Tamberi, UKTPO BP 23",
    note: "The −37% figure is not a UKTPO number and has no traceable source.",
  },
  {
    claim: "US FDI in Ireland exceeds USD 1 trillion",
    correction: "USD 466.8bn (BEA historical-cost position, end-2024)",
    note: "Conflates two different measurement bases.",
  },
  {
    claim: "Estonia's e-government saves over 2% of GDP annually",
    correction: "Absent from every current primary page; the state agency now frames savings only in working time.",
    note: "Unsourced legacy claim the primary source itself has dropped.",
  },
  {
    claim: "Ireland's 2015 real GDP growth was 25.2% (or 26.3%)",
    correction: "24.6% on the current Eurostat vintage",
    note: "26.3% was the July 2016 first estimate. Vintage matters.",
  },
  {
    claim: "Poland's cumulative real GDP growth 2004–2024 was 130–160%",
    correction: "+107.5% on Eurostat chain-linked volumes",
    note: "The higher figures are not supported by the current vintage.",
  },
  {
    claim: "Turkey's emergency rate hike to 24% was on 24 September 2018",
    correction: "Decided 13 Sep, effective 14 Sep 2018",
    note: "Checked against the CBRT's own one-week repo table.",
  },
  {
    claim: "Argentina's poverty rate was 38.1% in H1 2025",
    correction: "38.1% is H2 2024. H1 2025 was 31.6%; H2 2025 was 28.2%.",
    note: "INDEC EPH half-year series, commonly misaligned.",
  },
  {
    claim: "Estonia's 2022–24 recession was −0.5 / −3.0 / −0.3",
    correction: "−1.2 / −2.7 / −0.1 on the current Eurostat vintage",
    note: "Older vintage still widely quoted.",
  },
];

export const isRefuted = (text: string): boolean =>
  REFUTED_FIGURES.some((r) => text.toLowerCase().includes(r.claim.toLowerCase().slice(0, 30)));
