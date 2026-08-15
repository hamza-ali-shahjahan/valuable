/**
 * The verifiability guarantee, tested.
 *
 * If any test in this file fails, the claim "anyone can recompute our numbers and prove
 * we didn't cheat" is false, and the product's central promise is broken.
 */

import { describe, test, expect } from "bun:test";

import {
  trace, observed, assumption, derived, step, verify, canonicalNumber, canonicalise,
  hashOf, traceHashInput, leaves, sources, assumptions, allWarnings, depth, walk,
  assertPublishable, challengeUrl, formatValue, ENGINE_VERSION, CANONICAL_PRECISION,
  NonDeterministicValueError, UnpublishableError,
  type Trace,
} from "./trace.ts";

const src = { unit: "GBP", asOf: "2025-12-31", source: "ONS National Balance Sheet 2026" };

const ukNetWorth = () =>
  trace({
    formula: "NW = P + NP + NFW",
    ref: "docs/00-FIRST-PRINCIPLES.md §2.1",
    question: "What does the country own today, net of what it owes?",
    unit: "GBP",
    inputs: [
      observed("Produced assets", 6.6e12, src),
      observed("Non-produced assets (land)", 6.9e12, src),
      observed("Net financial worth", -199.8e9, src),
    ],
    steps: [
      step("Add produced and non-produced", "6.6e12 + 6.9e12", 13.5e12),
      step("Add net financial worth", "13.5e12 + (-199.8e9)", 13.3002e12),
    ],
    value: 13.3002e12,
  });

// ===========================================================================
// THE GUARANTEE
// ===========================================================================

describe("Determinism — the guarantee the whole product rests on", () => {
  test("1,000 independent constructions produce one identical hash", () => {
    const hashes = new Set<string>();
    for (let i = 0; i < 1000; i++) hashes.add(ukNetWorth().trace.hash);
    expect(hashes.size).toBe(1);
  });

  test("the hash is a real sha256", () => {
    expect(ukNetWorth().trace.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test("a trace verifies against its own recorded contents", () => {
    const t = ukNetWorth();
    const r = verify(t.trace, t.value);
    expect(r.ok).toBe(true);
    expect(r.problems).toEqual([]);
    expect(r.recomputed).toBe(r.hash);
  });

  test("object key order does not affect the hash", () => {
    const a = canonicalise({ b: 2, a: 1, c: 3 });
    const b = canonicalise({ c: 3, a: 1, b: 2 });
    expect(a).toBe(b);
    expect(hashOf(a)).toBe(hashOf(b));
  });
});

describe("Float noise is absorbed, real differences are not", () => {
  test("0.1 + 0.2 canonicalises identically to 0.3", () => {
    expect(canonicalNumber(0.1 + 0.2)).toBe(canonicalNumber(0.3));
  });

  test("different-but-equivalent operation orders agree", () => {
    const a = 6.6e12 + 6.9e12 + -199.8e9;
    const b = -199.8e9 + 6.9e12 + 6.6e12;
    expect(canonicalNumber(a)).toBe(canonicalNumber(b));
  });

  test("-0 and 0 collapse", () => {
    expect(canonicalNumber(-0)).toBe(canonicalNumber(0));
    expect(canonicalNumber(-0)).toBe("0");
  });

  test("an economically meaningful difference still changes the hash", () => {
    // One penny on £13.31tn is far below the precision we retain...
    const a = canonicalNumber(13_310_000_000_000);
    const b = canonicalNumber(13_310_000_000_000.01);
    expect(a).toBe(b);
    // ...but a single pound is within 15 significant figures and must register.
    expect(canonicalNumber(13_310_000_000_000))
      .not.toBe(canonicalNumber(13_310_000_001_000));
  });

  test("retains at least 15 significant figures", () => {
    expect(CANONICAL_PRECISION).toBeGreaterThanOrEqual(15);
  });

  test("NaN and Infinity are rejected rather than hashed", () => {
    expect(() => canonicalNumber(NaN)).toThrow(NonDeterministicValueError);
    expect(() => canonicalNumber(Infinity)).toThrow(NonDeterministicValueError);
    expect(() => canonicalNumber(-Infinity)).toThrow(NonDeterministicValueError);
    expect(() => trace({
      formula: "x", ref: "r", question: "q",
      unit: "GBP",
      inputs: [observed("bad", NaN, src)], value: NaN,
    })).toThrow(NonDeterministicValueError);
  });
});

// ===========================================================================
// DRIFT DETECTION
// ===========================================================================

describe("Any change anywhere changes the hash", () => {
  const base = ukNetWorth().trace.hash;

  test("changing an input value", () => {
    const t = trace({
      formula: "NW = P + NP + NFW", ref: "docs/00-FIRST-PRINCIPLES.md §2.1",
      question: "What does the country own today, net of what it owes?",
      unit: "GBP",
      inputs: [
        observed("Produced assets", 6.7e12, src), // changed
        observed("Non-produced assets (land)", 6.9e12, src),
        observed("Net financial worth", -199.8e9, src),
      ],
      steps: [
        step("Add produced and non-produced", "6.6e12 + 6.9e12", 13.5e12),
        step("Add net financial worth", "13.5e12 + (-199.8e9)", 13.3002e12),
      ],
      value: 13.3002e12,
    });
    expect(t.trace.hash).not.toBe(base);
  });

  test("changing the vintage of a source", () => {
    const t = trace({
      formula: "NW = P + NP + NFW", ref: "docs/00-FIRST-PRINCIPLES.md §2.1",
      question: "What does the country own today, net of what it owes?",
      unit: "GBP",
      inputs: [
        observed("Produced assets", 6.6e12, { ...src, asOf: "2024-12-31" }),
        observed("Non-produced assets (land)", 6.9e12, src),
        observed("Net financial worth", -199.8e9, src),
      ],
      value: 13.3002e12,
    });
    expect(t.trace.hash).not.toBe(base);
  });

  test("changing the formula", () => {
    const t = trace({
      formula: "NW = P + NP", ref: "docs/00-FIRST-PRINCIPLES.md §2.1",
      question: "What does the country own today, net of what it owes?",
      unit: "GBP",
      inputs: [observed("Produced assets", 6.6e12, src)],
      value: 13.3002e12,
    });
    expect(t.trace.hash).not.toBe(base);
  });

  test("changing the engine version", () => {
    const contents = {
      formula: "NW = P + NP + NFW", ref: "docs/00-FIRST-PRINCIPLES.md §2.1",
      question: "What does the country own today, net of what it owes?",
      unit: "GBP",
      inputs: [observed("Produced assets", 6.6e12, src)],
      steps: [], value: 6.6e12,
    };
    const a = hashOf(traceHashInput({ ...contents, engineVersion: "0.1.0" }));
    const b = hashOf(traceHashInput({ ...contents, engineVersion: "0.9.9" }));
    expect(a).not.toBe(b);
  });

  test("verification catches a tampered stored value", () => {
    const t = ukNetWorth();
    const r = verify(t.trace, 99e12); // someone edited the number, not the trail
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("hash mismatch");
  });

  test("verification catches a tampered trail", () => {
    const t = ukNetWorth();
    const tampered: Trace = { ...t.trace, formula: "NW = whatever we like" };
    expect(verify(tampered, t.value).ok).toBe(false);
  });
});

// ===========================================================================
// THE GRAPH
// ===========================================================================

describe("Derived nodes build a merkle graph", () => {
  const child = ukNetWorth();
  const parent = trace({
    formula: "NW per capita = NW / population",
    ref: "docs/00-FIRST-PRINCIPLES.md §6",
    question: "What is that per person?",
    unit: "GBP",
    inputs: [
      derived("UK net worth", child),
      observed("Population", 69.3e6, { unit: "people", asOf: "2024-06-30", source: "ONS" }),
    ],
    steps: [step("Divide", "13.3002e12 / 69.3e6", 191_923)],
    value: 191_923,
  });

  test("the parent verifies, and so does every child", () => {
    const r = verify(parent.trace, parent.value);
    expect(r.ok).toBe(true);
    expect(r.childResults.length).toBe(1);
    expect(r.childResults[0]!.ok).toBe(true);
  });

  test("changing the child changes the parent's hash", () => {
    const alteredChild = trace({
      formula: "NW = P + NP + NFW", ref: "docs/00-FIRST-PRINCIPLES.md §2.1",
      question: "What does the country own today, net of what it owes?",
      unit: "GBP",
      inputs: [observed("Produced assets", 7.0e12, src)],
      value: 13.4e12,
    });
    const alteredParent = trace({
      formula: "NW per capita = NW / population",
      ref: "docs/00-FIRST-PRINCIPLES.md §6",
      question: "What is that per person?",
      unit: "GBP",
      inputs: [
        derived("UK net worth", alteredChild),
        observed("Population", 69.3e6, { unit: "people", asOf: "2024-06-30", source: "ONS" }),
      ],
      steps: [step("Divide", "13.3002e12 / 69.3e6", 191_923)],
      value: 191_923,
    });
    expect(alteredParent.trace.hash).not.toBe(parent.trace.hash);
  });

  test("a corrupted child fails the parent's verification", () => {
    const corrupted: Trace = {
      ...parent.trace,
      inputs: [
        { kind: "derived", label: "UK net worth", value: child.value,
          trace: { ...child.trace, hash: "0".repeat(64) } },
        parent.trace.inputs[1]!,
      ],
    };
    const r = verify(corrupted, parent.value);
    expect(r.ok).toBe(false);
    expect(r.problems.some((p) => p.includes("child"))).toBe(true);
  });

  test("the graph can be walked to its leaves", () => {
    expect(depth(parent.trace)).toBe(2);
    const l = leaves(parent.trace);
    expect(l.length).toBe(4); // 3 ONS figures + population
    // The return type already excludes "derived"; assert the runtime agrees.
    expect([...new Set(l.map((n) => n.kind))].sort()).toEqual(["observed"]);
  });

  test("sources are collected for citation", () => {
    expect(sources(parent.trace)).toContain("ONS National Balance Sheet 2026");
    expect(sources(parent.trace)).toContain("ONS");
  });

  test("every node is visited exactly once", () => {
    const seen: string[] = [];
    walk(parent.trace, (n) => seen.push(n.label));
    expect(seen).toEqual([
      "UK net worth", "Produced assets", "Non-produced assets (land)",
      "Net financial worth", "Population",
    ]);
  });
});

// ===========================================================================
// ASSUMPTIONS — the honesty mechanism
// ===========================================================================

describe("Assumptions are distinct from observations and must justify themselves", () => {
  test("an assumption without real reasoning is rejected", () => {
    expect(() => assumption("Discount rate", 0.04, "ratio", "seems right", "§2.2"))
      .toThrow(/must justify itself/);
  });

  test("a properly reasoned assumption is accepted and surfaced", () => {
    const a = assumption(
      "Discount rate", 0.04, "ratio",
      "CWON applies a uniform 4% real rate across all assets and countries. Moving " +
      "renewables to 2% more than doubles their share of global wealth.",
      "docs/00-FIRST-PRINCIPLES.md §2.2",
    );
    const t = trace({
      formula: "PV = rent / r", ref: "§2.2",
      question: "What is the natural capital worth?",
      unit: "GBP",
      inputs: [
        observed("Annual resource rent", 1e9, { unit: "GBP", asOf: "2020-12-31", source: "World Bank CWON" }),
        a,
      ],
      value: 25e9,
    });
    expect(assumptions(t.trace).length).toBe(1);
    expect(assumptions(t.trace)[0]!.label).toBe("Discount rate");
  });

  test("assumptions are reachable through nested traces", () => {
    const inner = trace({
      formula: "PV = rent / r", ref: "§2.2", question: "Natural capital?",
      unit: "GBP",
      inputs: [
        observed("Rent", 1e9, { unit: "GBP", asOf: "2020-12-31", source: "CWON" }),
        assumption("Discount rate", 0.04, "ratio",
          "CWON's uniform 4% real rate, applied across all assets and countries.", "§2.2"),
      ],
      value: 25e9,
    });
    const outer = trace({
      formula: "W = P + N", ref: "§2.2", question: "Comprehensive wealth?",
      unit: "GBP",
      inputs: [
        observed("Produced", 6.6e12, src),
        derived("Natural capital", inner),
      ],
      value: 6.625e12,
    });
    expect(assumptions(outer.trace).length).toBe(1);
  });
});

// ===========================================================================
// PUBLICATION GATE
// ===========================================================================

describe("Unverified inputs block publication", () => {
  const withUnverified = trace({
    formula: "NW per capita = NW / population", ref: "§6", question: "Per person?",
    unit: "GBP",
    inputs: [
      observed("Net worth", 13.3002e12, src),
      observed("Population", 69.3e6, {
        unit: "people", asOf: "2024-06-30", source: "ONS mid-year estimate",
        needsVerification: true,
      }),
    ],
    value: 191_923,
  });

  test("publishing throws, naming the offending input", () => {
    expect(() => assertPublishable(withUnverified.trace)).toThrow(UnpublishableError);
    expect(() => assertPublishable(withUnverified.trace)).toThrow(/Population/);
  });

  test("a fully verified trace publishes", () => {
    expect(() => assertPublishable(ukNetWorth().trace)).not.toThrow();
  });

  test("an unverified input deep in the graph still blocks the root", () => {
    const parent = trace({
      formula: "x = a", ref: "§6", question: "q",
      unit: "GBP",
      inputs: [derived("child", withUnverified)],
      value: 1,
    });
    expect(() => assertPublishable(parent.trace)).toThrow(UnpublishableError);
  });
});

// ===========================================================================
// WARNINGS AND PEER REVIEW
// ===========================================================================

describe("Warnings propagate up the graph", () => {
  test("a warning raised deep down surfaces at the root", () => {
    const child = trace({
      formula: "x", ref: "§1", question: "q",
      unit: "GBP",
      inputs: [observed("a", 1, src)],
      warnings: ["Terminal value is 85% of total — this is an assumption model"],
      value: 1,
    });
    const parent = trace({
      formula: "y", ref: "§1", question: "q",
      unit: "GBP",
      inputs: [derived("child", child)], value: 1,
    });
    expect(allWarnings(parent.trace)).toContain(
      "Terminal value is 85% of total — this is an assumption model",
    );
  });
});

describe("Challenge links anchor to an exact computation", () => {
  const t = ukNetWorth().trace;

  test("the link carries the trace hash and engine version", () => {
    const url = challengeUrl(t);
    expect(url).toContain(`trace=${t.hash}`);
    expect(url).toContain(`engine=${ENGINE_VERSION}`);
    expect(url).toContain("template=challenge.yml");
  });

  test("a step-level challenge names the step", () => {
    const url = challengeUrl(t, { kind: "step", label: "Add net financial worth" });
    // URLSearchParams uses form encoding, so spaces are "+" — which GitHub decodes.
    const title = new URL(url).searchParams.get("title")!;
    expect(title).toContain("Add net financial worth");
    expect(title).toContain("§2.1");
  });
});

// ===========================================================================
// THE RECONCILIATION, NOW TRACED
// ===========================================================================

describe("The UK reconciliation survives being traced", () => {
  const t = ukNetWorth();

  test("still lands on the published £13.31tn", () => {
    expect(t.value / 1e12).toBeCloseTo(13.30, 1);
  });

  test("carries the question it answers", () => {
    expect(t.trace.question).toContain("own today");
  });

  test("points at the formula that defines it", () => {
    expect(t.trace.ref).toContain("§2.1");
  });

  test("every input is attributable to ONS", () => {
    expect(sources(t.trace)).toEqual(["ONS National Balance Sheet 2026"]);
  });

  test("a reader can follow the arithmetic step by step", () => {
    expect(t.trace.steps.length).toBe(2);
    expect(t.trace.steps[1]!.expression).toContain("199.8e9");
  });
});

// ===========================================================================
// UNIT-AWARE FORMATTING
// Regression guard: the first `verify` run rendered a 3.8% interest rate as "£0".
// A number without its unit is not merely ugly — it is wrong.
// ===========================================================================

describe("Values format according to their own unit", () => {
  test("money scales to trillions, billions, millions", () => {
    expect(formatValue(13.3002e12, "GBP")).toBe("£13.30tn");
    expect(formatValue(-199.8e9, "GBP")).toBe("−£199.8bn");
    expect(formatValue(191_922, "GBP")).toBe("£191,922");
  });

  test("a rate renders as a percentage, never as money", () => {
    expect(formatValue(0.038, "ratio")).toBe("3.80%");
    expect(formatValue(0.038, "ratio")).not.toContain("£");
  });

  test("a spread renders in basis points", () => {
    expect(formatValue(0.003, "pp")).toBe("30bp");
  });

  test("a headcount is not currency", () => {
    expect(formatValue(69.3e6, "people")).toBe("69.3m");
    expect(formatValue(69.3e6, "people")).not.toContain("£");
  });

  test("an unknown unit is labelled rather than guessed at", () => {
    expect(formatValue(1.55, "multiple")).toContain("multiple");
  });

  test("the unit is part of the hashed identity, not display metadata", () => {
    const spec = {
      formula: "x", ref: "§1", question: "q",
      inputs: [observed("a", 1, src)], steps: [], value: 1,
      engineVersion: ENGINE_VERSION,
    };
    const a = hashOf(traceHashInput({ ...spec, unit: "GBP" }));
    const b = hashOf(traceHashInput({ ...spec, unit: "USD" }));
    expect(a).not.toBe(b);
  });
});

// ===========================================================================
// WHAT IS HASHED, AND WHAT ISN'T
//
// The line: the COMPUTATION is pinned, the EXPLANATION is free to improve. Rewriting a
// step so a non-expert can follow it must never break a published link.
// ===========================================================================

describe("Explanations can improve without breaking published links", () => {
  const build = (label: string, expression: string, plain: string) =>
    trace({
      formula: "NW = P + NP", ref: "§2.1", question: "q", unit: "GBP",
      plain, inputs: [observed("Produced assets", 6.6e12, src)],
      steps: [step(label, expression, 13.5e12, plain)],
      value: 13.5e12,
    });

  test("rewording a step's label and arithmetic keeps the same fingerprint", () => {
    const before = build("Add produced and non-produced", "6.6000e+12 + 6.9000e+12", "technical");
    const after = build("Add the buildings to the land", "£6.60tn + £6.90tn = £13.50tn", "plain");
    expect(after.trace.hash).toBe(before.trace.hash);
  });

  test("but changing a step's VALUE changes it — that is real arithmetic", () => {
    const before = build("Add", "a + b", "x");
    const after = trace({
      formula: "NW = P + NP", ref: "§2.1", question: "q", unit: "GBP",
      plain: "x", inputs: [observed("Produced assets", 6.6e12, src)],
      steps: [step("Add", "a + b", 13.6e12, "x")],
      value: 13.5e12,
    });
    expect(after.trace.hash).not.toBe(before.trace.hash);
  });

  test("an input's plain description is not hashed either", () => {
    const bare = observed("Produced assets", 6.6e12, src);
    const described = observed("Produced assets", 6.6e12, { ...src, plain: "Everything built." });
    const mk = (input: typeof bare) => trace({
      formula: "f", ref: "§1", question: "q", unit: "GBP", inputs: [input], value: 1,
    });
    expect(mk(described).trace.hash).toBe(mk(bare).trace.hash);
  });

  test("changing the engine version still changes everything", () => {
    expect(ENGINE_VERSION).toBe("0.2.0");
  });
});
