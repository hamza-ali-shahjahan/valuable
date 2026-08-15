/**
 * The audit trail. SPEC.md §2.
 *
 * Every published number carries its complete working, and anyone can recompute the
 * hash to prove the number and its trail have not drifted apart.
 *
 * THE GUARANTEE: same inputs + same engine version -> same hash. That is the difference
 * between transparent (you can read the working) and verifiable (you can prove it).
 *
 * Determinism requirements this file enforces:
 *   - no wall-clock time anywhere (every date comes from the data)
 *   - fixed-precision number serialisation (floats do not hash reliably raw)
 *   - engineVersion inside every hash, so a method change cannot silently rewrite history
 */

import { createHash } from "node:crypto";

/**
 * Bump on ANY change to a formula or to canonicalisation. Old hashes stay resolvable;
 * they simply belong to an earlier version. Never rewrite history in place.
 *
 * 0.2.0 — step labels and expressions left out of the hash. Rewriting
 *         "6.6000e+12 + 6.9000e+12" as "£6.60tn + £6.90tn" is presentation, not
 *         arithmetic, and improving readability must never orphan a published link.
 *         The step VALUE is still hashed, because that is the substance.
 */
export const ENGINE_VERSION = "0.2.0";

/**
 * Significant figures retained before hashing.
 *
 * IEEE-754 needs ~17 digits to round-trip exactly, so rounding to 15 absorbs last-bit
 * noise from different-but-equivalent operation orders while preserving far more
 * precision than any valuation could justify. £13.31tn to 15 s.f. is precision to the
 * nearest hundredth of a penny.
 */
export const CANONICAL_PRECISION = 15;

// ---------------------------------------------------------------------------
// Trace nodes — three kinds, and the distinction is the honesty (SPEC §2.2)
// ---------------------------------------------------------------------------

/**
 * Plain-English text is DELIBERATELY NOT HASHED.
 *
 * The fingerprint pins the computation — formula, inputs, steps, engine version. The
 * explanation is a gloss on top, and we want to keep improving how readable it is
 * without rewriting history or orphaning every published hash.
 *
 * Consequence to be honest about: someone could reword a description without changing
 * the fingerprint. What they cannot change without changing it is the maths.
 */
export interface Plain {
  /** One sentence, no jargon, no symbols. What this actually is. */
  readonly plain?: string;
}

/** A figure read from a primary source. */
export interface ObservedNode extends Plain {
  readonly kind: "observed";
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly asOf: string;
  readonly source: string;
  readonly url?: string;
  /** Blocks publication (SPEC §7). */
  readonly needsVerification?: boolean;
}

/** Another traced computation. Recursion here is what builds the full graph. */
export interface DerivedNode {
  readonly kind: "derived";
  readonly label: string;
  readonly value: number;
  readonly trace: Trace;
}

/**
 * A judgement we made. Discount rates, capital shares, terminal growth.
 *
 * This is where a valuation is actually contestable, so assumptions render distinctly
 * and are the default target of a challenge. A platform that blurs assumptions into
 * observations is not verifiable whatever else it does.
 */
export interface AssumptionNode extends Plain {
  readonly kind: "assumption";
  readonly label: string;
  readonly value: number;
  readonly unit: string;
  readonly rationale: string;
  readonly ref: string;
}

export type TraceNode = ObservedNode | DerivedNode | AssumptionNode;

export interface Step extends Plain {
  readonly label: string;
  /** The arithmetic, written out so a reader can follow it. */
  readonly expression: string;
  readonly value: number;
}

export interface Trace extends Plain {
  readonly hash: string;
  readonly formula: string;
  /** What the answer means, once you have it. The "so what". */
  readonly meaning?: string;
  /** Where the formula is defined, e.g. "docs/00-FIRST-PRINCIPLES.md §2.1". */
  readonly ref: string;
  /** Which claim this number answers (§2.0 — the question must be named). */
  readonly question: string;
  /**
   * The unit of the output. A number without its unit is meaningless, and a unit change
   * is a semantic change — so it is part of the hashed identity, not display metadata.
   */
  readonly unit: string;
  readonly inputs: readonly TraceNode[];
  readonly steps: readonly Step[];
  readonly engineVersion: string;
  /** Invariant checks that fired while computing. Surfaced, never swallowed. */
  readonly warnings: readonly string[];
}

export interface Traced<T> {
  readonly value: T;
  readonly trace: Trace;
}

// ---------------------------------------------------------------------------
// Canonical form
// ---------------------------------------------------------------------------

export class NonDeterministicValueError extends Error {}

/**
 * Serialise a number to a stable decimal form.
 *
 * NaN and Infinity throw — neither can appear in a valuation, and allowing them would
 * let a broken computation produce a valid-looking hash.
 */
export const canonicalNumber = (n: number): string => {
  if (Number.isNaN(n)) {
    throw new NonDeterministicValueError("NaN cannot appear in a traced computation");
  }
  if (!Number.isFinite(n)) {
    throw new NonDeterministicValueError(`${n} cannot appear in a traced computation`);
  }
  if (n === 0) return "0"; // collapses -0 and 0, which are distinct in IEEE-754
  return Number(n.toPrecision(CANONICAL_PRECISION)).toExponential();
};

/** Deterministic JSON: keys sorted, numbers canonicalised, no incidental whitespace. */
export const canonicalise = (v: unknown): string => {
  if (v === null) return "null";
  if (typeof v === "number") return canonicalNumber(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v === undefined) return "null";
  if (Array.isArray(v)) return `[${v.map(canonicalise).join(",")}]`;
  if (typeof v === "object") {
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([, val]) => val !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, val]) => `${JSON.stringify(k)}:${canonicalise(val)}`).join(",")}}`;
  }
  throw new NonDeterministicValueError(`Cannot canonicalise ${typeof v}`);
};

/**
 * A derived node contributes its child's HASH, not the child's full contents — a merkle
 * DAG. Changing anything deep in the graph still changes every hash above it.
 */
const nodeForHashing = (n: TraceNode): unknown => {
  switch (n.kind) {
    case "observed":
      return { kind: n.kind, label: n.label, value: n.value, unit: n.unit,
               asOf: n.asOf, source: n.source, url: n.url };
    case "assumption":
      return { kind: n.kind, label: n.label, value: n.value, unit: n.unit,
               rationale: n.rationale, ref: n.ref };
    case "derived":
      return { kind: n.kind, label: n.label, value: n.value, childHash: n.trace.hash };
  }
};

export const traceHashInput = (spec: {
  formula: string; ref: string; question: string; unit: string;
  inputs: readonly TraceNode[]; steps: readonly Step[];
  engineVersion: string; value: number;
}): string =>
  canonicalise({
    engineVersion: spec.engineVersion,
    formula: spec.formula,
    inputs: spec.inputs.map(nodeForHashing),
    question: spec.question,
    ref: spec.ref,
    // Only the step's VALUE is hashed. Its label and written-out arithmetic are how we
    // explain the step, and explanations must be free to improve (see `Plain` above).
    steps: spec.steps.map((s) => ({ value: s.value })),
    unit: spec.unit,
    value: spec.value,
  });

export const hashOf = (canonical: string): string =>
  createHash("sha256").update(canonical, "utf8").digest("hex");

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export const observed = (
  label: string, value: number,
  meta: {
    unit: string; asOf: string; source: string; url?: string;
    needsVerification?: boolean; plain?: string;
  },
): ObservedNode => ({ kind: "observed", label, value, ...meta });

export const assumption = (
  label: string, value: number, unit: string, rationale: string, ref: string,
  plain?: string,
): AssumptionNode => {
  if (rationale.trim().length < 20) {
    throw new Error(
      `An assumption must justify itself. "${rationale}" is too thin — assumptions are ` +
      `the part of a valuation people challenge, so the reasoning has to be auditable.`,
    );
  }
  return { kind: "assumption", label, value, unit, rationale, ref, plain };
};

export const derived = <T extends number>(label: string, t: Traced<T>): DerivedNode =>
  ({ kind: "derived", label, value: t.value, trace: t.trace });

export const step = (
  label: string, expression: string, value: number, plain?: string,
): Step => ({ label, expression, value, plain });

/**
 * Build a traced value. This is the only way to produce one, so a number that reaches a
 * page necessarily carries its working.
 */
export const trace = (spec: {
  formula: string;
  /** The formula in words. Shown ABOVE the notation, never below it. */
  plain?: string;
  /** What the answer means once you have it. */
  meaning?: string;
  ref: string;
  question: string;
  unit: string;
  inputs: readonly TraceNode[];
  steps?: readonly Step[];
  warnings?: readonly string[];
  value: number;
}): Traced<number> => {
  const steps = spec.steps ?? [];
  const warnings = spec.warnings ?? [];
  const canonical = traceHashInput({
    formula: spec.formula, ref: spec.ref, question: spec.question, unit: spec.unit,
    inputs: spec.inputs, steps, engineVersion: ENGINE_VERSION, value: spec.value,
  });
  return {
    value: spec.value,
    trace: {
      hash: hashOf(canonical),
      formula: spec.formula,
      plain: spec.plain,
      meaning: spec.meaning,
      ref: spec.ref,
      question: spec.question,
      unit: spec.unit,
      inputs: spec.inputs,
      steps,
      engineVersion: ENGINE_VERSION,
      warnings,
    },
  };
};

// ---------------------------------------------------------------------------
// Verification — the guarantee, made mechanical
// ---------------------------------------------------------------------------

export interface VerificationResult {
  readonly ok: boolean;
  readonly hash: string;
  readonly recomputed: string;
  readonly childResults: readonly VerificationResult[];
  readonly problems: readonly string[];
}

/**
 * Recompute a trace's hash from its own recorded contents and compare. Recurses into
 * every derived node, so verifying the root verifies the whole graph.
 *
 * This is what `bun run verify` walks, and what makes the claim testable rather than
 * rhetorical.
 */
export const verify = (t: Trace, value: number): VerificationResult => {
  const problems: string[] = [];

  const childResults = t.inputs
    .filter((n): n is DerivedNode => n.kind === "derived")
    .map((n) => {
      const r = verify(n.trace, n.value);
      if (!r.ok) problems.push(`child "${n.label}" failed verification`);
      return r;
    });

  const recomputed = hashOf(traceHashInput({
    formula: t.formula, ref: t.ref, question: t.question, unit: t.unit,
    inputs: t.inputs, steps: t.steps, engineVersion: t.engineVersion, value,
  }));

  if (recomputed !== t.hash) {
    problems.push(
      `hash mismatch: stored ${t.hash.slice(0, 12)}… but recomputed ${recomputed.slice(0, 12)}…`,
    );
  }

  return { ok: problems.length === 0, hash: t.hash, recomputed, childResults, problems };
};

// ---------------------------------------------------------------------------
// Graph traversal
// ---------------------------------------------------------------------------

export const walk = (t: Trace, visit: (n: TraceNode, depth: number) => void, depth = 0): void => {
  for (const n of t.inputs) {
    visit(n, depth);
    if (n.kind === "derived") walk(n.trace, visit, depth + 1);
  }
};

/** Every bottom-level input: the primary sources and the judgements. */
export const leaves = (t: Trace): readonly (ObservedNode | AssumptionNode)[] => {
  const out: (ObservedNode | AssumptionNode)[] = [];
  walk(t, (n) => { if (n.kind !== "derived") out.push(n); });
  return out;
};

/** Distinct primary sources behind a number — the citation list for a page. */
export const sources = (t: Trace): readonly string[] =>
  [...new Set(leaves(t).filter((n): n is ObservedNode => n.kind === "observed").map((n) => n.source))].sort();

/** Every judgement behind a number — what a reviewer should attack first. */
export const assumptions = (t: Trace): readonly AssumptionNode[] =>
  leaves(t).filter((n): n is AssumptionNode => n.kind === "assumption");

/** All warnings raised anywhere in the graph. */
export const allWarnings = (t: Trace): readonly string[] => {
  const out = [...t.warnings];
  walk(t, (n) => { if (n.kind === "derived") out.push(...n.trace.warnings); });
  return [...new Set(out)];
};

export class UnpublishableError extends Error {}

/**
 * A number may not be published while any input behind it is flagged unverified
 * (SPEC §7 "never"). Called at the render boundary.
 */
export const assertPublishable = (t: Trace): void => {
  const unverified = leaves(t)
    .filter((n): n is ObservedNode => n.kind === "observed" && n.needsVerification === true);
  if (unverified.length > 0) {
    throw new UnpublishableError(
      `Cannot publish: ${unverified.length} input(s) are flagged needsVerification — ` +
      unverified.map((n) => `"${n.label}" (${n.source})`).join(", ") +
      `. Verify against the primary source or remove the figure.`,
    );
  }
};

/**
 * Format a value for display according to its own unit.
 *
 * Exists because the first verify run rendered a 3.8% interest rate as "£0" — a number
 * without its unit is not just ugly, it is wrong.
 */
export const formatValue = (value: number, unit: string): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";

  switch (unit) {
    case "GBP": case "USD": case "EUR": {
      const sym = unit === "GBP" ? "£" : unit === "USD" ? "$" : "€";
      if (abs >= 1e12) return `${sign}${sym}${(abs / 1e12).toFixed(2)}tn`;
      if (abs >= 1e9) return `${sign}${sym}${(abs / 1e9).toFixed(1)}bn`;
      if (abs >= 1e6) return `${sign}${sym}${(abs / 1e6).toFixed(1)}m`;
      return `${sign}${sym}${abs.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
    }
    case "ratio":
      return `${(value * 100).toFixed(2)}%`;
    case "pp":
      return `${(value * 10000).toFixed(0)}bp`;
    case "people":
      return abs >= 1e6
        ? `${sign}${(abs / 1e6).toFixed(1)}m`
        : `${sign}${abs.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
    default:
      return `${value.toLocaleString("en-GB", { maximumSignificantDigits: 6 })} ${unit}`;
  }
};

/** Depth of the dependency graph — how far a reader can drill down. */
export const depth = (t: Trace): number => {
  let max = 0;
  walk(t, (_n, d) => { max = Math.max(max, d + 1); });
  return max;
};

// ---------------------------------------------------------------------------
// Peer review (SPEC §2.4)
// ---------------------------------------------------------------------------

export const REPO = "hamza-ali-shahjahan/valuable";

/**
 * A challenge is anchored to an exact computation rather than a vibe, which is what
 * makes it actionable.
 */
export const challengeUrl = (t: Trace, target?: { kind: "step" | "input"; label: string }): string => {
  const title = target
    ? `${t.ref} — ${target.kind}: ${target.label}`
    : `${t.ref} — ${t.formula}`;
  const params = new URLSearchParams({
    template: "challenge.yml",
    title,
    trace: t.hash,
    engine: t.engineVersion,
  });
  return `https://github.com/${REPO}/issues/new?${params.toString()}`;
};
