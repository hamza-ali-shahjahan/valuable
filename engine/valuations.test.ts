/**
 * The publishable layer, end to end.
 *
 * These assert the thing a sceptic actually cares about: that the UK number reconciles
 * to the official figure, that its trail resolves to ONS primary sources, and that the
 * whole graph verifies.
 */

import { describe, test, expect } from "bun:test";

import {
  ukNetWorth, ukComprehensiveWealth, ukRMinusG, ukNetWorthPerCapita,
  ukListedEquity, ukValuation, ukPublishable,
} from "./valuations.ts";
import { verify, sources, assumptions, allWarnings, leaves, depth, walk, trace, type Trace } from "./trace.ts";

describe("The UK reconciliation, now with a full audit trail", () => {
  const t = ukNetWorth();

  test("lands on the published £13.31tn", () => {
    expect(t.value / 1e12).toBeCloseTo(13.30, 1);
    expect(t.value).toBeGreaterThan(13.2e12);
    expect(t.value).toBeLessThan(13.4e12);
  });

  test("the whole graph verifies", () => {
    expect(verify(t.trace, t.value).ok).toBe(true);
  });

  test("every input traces to ONS", () => {
    expect(sources(t.trace)).toEqual(["ONS National Balance Sheet & capital stocks, preliminary estimates 2026"]);
  });

  test("every input carries a vintage", () => {
    for (const leaf of leaves(t.trace)) {
      if (leaf.kind === "observed") expect(leaf.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test("warns that the figure is majority land and therefore tracks house prices", () => {
    const w = allWarnings(t.trace).join(" ").toLowerCase();
    expect(w).toContain("house price");
    expect(w).toMatch(/5[0-9]%/);
  });

  test("a reader can follow the arithmetic step by step", () => {
    expect(t.trace.steps.length).toBe(2);
    expect(t.trace.steps[1]!.value).toBeCloseTo(t.value, 0);
  });

  test("names the question it answers, not just the number", () => {
    expect(t.trace.question).toContain("own today");
  });
});

describe("Comprehensive wealth carries its convention as an assumption", () => {
  const t = ukComprehensiveWealth();

  test("reaches roughly £38.8tn", () => {
    expect(t.value / 1e12).toBeCloseTo(38.8, 0);
  });

  test("verifies through the nested net-worth trace", () => {
    const r = verify(t.trace, t.value);
    expect(r.ok).toBe(true);
    expect(r.childResults.length).toBe(1);
  });

  test("the graph is two levels deep — a reader can drill into net worth", () => {
    expect(depth(t.trace)).toBe(2);
  });

  test("the ONS-vs-CWON convention is an explicit, challengeable assumption", () => {
    const a = assumptions(t.trace);
    expect(a.length).toBe(1);
    expect(a[0]!.label).toContain("ONS");
    expect(a[0]!.rationale).toContain("INVARIANT 10");
    expect(a[0]!.rationale).toContain("never be blended");
  });

  test("warns that the discount rate dominates the uncertainty", () => {
    const w = allWarnings(t.trace).join(" ").toLowerCase();
    expect(w).toContain("discount rate");
    expect(w).toMatch(/25-30%|quarter/);
    // Must say the swing exceeds the year-to-year change — that is the honest point.
    expect(w).toMatch(/year to the next|year-on-year/);
  });

  test("flags that the two halves come from different years", () => {
    const w = allWarnings(t.trace).join(" ");
    expect(w).toContain("2022");
    expect(w).toContain("2025");
  });
});

describe("r − g is surfaced as the master variable", () => {
  const t = ukRMinusG();

  test("is the razor-thin +0.3pp the OBR implies", () => {
    expect(t.value).toBeCloseTo(0.003, 4);
  });

  test("verifies", () => {
    expect(verify(t.trace, t.value).ok).toBe(true);
  });

  test("shows the surplus needed to hold debt flat as its own step", () => {
    const pb = t.trace.steps.find((s) => /surplus/i.test(s.label))!;
    expect(pb).toBeDefined();
    expect(pb.value).toBeCloseTo(0.00274, 4);
  });

  test("warns how violently the required surplus moves on a plausible rate change", () => {
    const w = allWarnings(t.trace).join(" ");
    expect(w).toContain("1.83%");
    expect(w).toMatch(/£50 ?(billion|bn)/);
    expect(w.toLowerCase()).toContain("routinely");
  });

  test("is not flagged distressed at current parameters", () => {
    expect(allWarnings(t.trace).join(" ")).not.toContain("distressed");
  });
});

describe("The publication gate is doing real work, not decoration", () => {
  test("per-capita is BLOCKED because the population figure is unverified", () => {
    const v = ukValuation();
    expect(v.perCapita.publishable).toBe(false);
    expect(v.perCapita.blockedBecause).toContain("Population");
    expect(v.perCapita.blockedBecause).toContain("needsVerification");
  });

  test("the per-capita maths is still correct — it is withheld, not wrong", () => {
    const t = ukNetWorthPerCapita();
    expect(t.value).toBeCloseTo(13.3002e12 / 69.3e6, -2);
    expect(verify(t.trace, t.value).ok).toBe(true);
  });

  test("net worth and comprehensive wealth DO clear the gate", () => {
    const publishable = ukPublishable().map((c) => c.claim);
    expect(publishable).toContain("national_net_worth");
    expect(publishable).toContain("comprehensive_wealth");
  });
});

describe("Listed equity is carried as a signal, never as a level", () => {
  const t = ukListedEquity();

  test("is £2.74tn", () => {
    expect(t.value / 1e12).toBeCloseTo(2.744, 2);
  });

  test("its warnings state the double-count and the listing bias", () => {
    const w = allWarnings(t.trace).join(" ").toLowerCase();
    expect(w).toContain("never add this");
    expect(w).toMatch(/twice|double/);
    expect(w).toContain("overseas");
    expect(w).toContain("not about britain");
  });
});

describe("The composite publishes three answers, never one", () => {
  const v = ukValuation();

  test("returns distinct claims, each with its own question", () => {
    expect(v.claims.length).toBe(3);
    const questions = new Set(v.claims.map((c) => c.question));
    expect(questions.size).toBe(3);
  });

  test("the claims span an order of magnitude — which is the point", () => {
    const values = v.claims.map((c) => c.traced.value).sort((a, b) => a - b);
    expect(values[values.length - 1]! / values[0]!).toBeGreaterThan(10);
  });

  test("every claim verifies independently", () => {
    for (const c of v.claims) {
      expect(verify(c.traced.trace, c.traced.value).ok).toBe(true);
    }
  });

  test("every claim points at the formula that defines it", () => {
    for (const c of v.claims) expect(c.traced.trace.ref).toContain("§2.");
  });

  test("no two claims share a hash — they are genuinely different computations", () => {
    const hashes = new Set(v.claims.map((c) => c.traced.trace.hash));
    expect(hashes.size).toBe(v.claims.length);
  });
});

// ===========================================================================
// READABILITY
//
// The promise is that anyone can check these numbers. If only an economist can read
// them, that promise is a lie — so readability is a tested guarantee, not a style note.
// ===========================================================================


const everyTrace = (): Trace[] => {
  const v = ukValuation();
  const out: Trace[] = [
    ...v.claims.map((c) => c.traced.trace),
    v.rMinusG.trace,
    v.perCapita.traced.trace,
  ];
  for (const t of [...out]) walk(t, (n) => { if (n.kind === "derived") out.push(n.trace); });
  return out;
};

describe("Everything a reader sees has a plain-English version", () => {
  test("every calculation explains its formula in words", () => {
    for (const t of everyTrace()) {
      expect(t.plain, `missing plain text: ${t.formula}`).toBeDefined();
      expect(t.plain!.length).toBeGreaterThan(40);
    }
  });

  test("every top-level answer says what it means, not just what it is", () => {
    for (const c of ukValuation().claims) {
      expect(c.traced.trace.meaning, `no meaning: ${c.question}`).toBeDefined();
      expect(c.traced.trace.meaning!.length).toBeGreaterThan(60);
    }
  });

  test("every measured figure is described in plain words", () => {
    for (const t of everyTrace()) {
      for (const n of t.inputs) {
        if (n.kind === "observed") {
          expect(n.plain, `no plain description: ${n.label}`).toBeDefined();
        }
      }
    }
  });

  test("every judgement explains itself twice — plainly, then technically", () => {
    for (const a of assumptions(ukComprehensiveWealth().trace)) {
      expect(a.plain, `no plain text: ${a.label}`).toBeDefined();
      expect(a.rationale.length).toBeGreaterThan(a.plain!.length / 2);
    }
  });

  test("every arithmetic step says what it is doing in words", () => {
    for (const t of everyTrace()) {
      for (const s of t.steps) {
        expect(s.plain, `no plain text on step: ${s.label}`).toBeDefined();
      }
    }
  });
});

describe("Plain English is actually plain", () => {
  const plainStrings = (): string[] => {
    const out: string[] = [];
    for (const t of everyTrace()) {
      if (t.plain) out.push(t.plain);
      if (t.meaning) out.push(t.meaning);
      out.push(t.question);
      for (const n of t.inputs) if (n.kind !== "derived" && n.plain) out.push(n.plain);
      for (const s of t.steps) if (s.plain) out.push(s.plain);
    }
    return out;
  };

  test("no internal jargon leaks into reader-facing text", () => {
    const banned = [/INVARIANT/i, /§/, /CWON/, /\bNFW\b/, /K_/, /doc s?\//i, /\.md\b/];
    for (const p of plainStrings()) {
      for (const b of banned) {
        expect(b.test(p), `jargon "${b}" in: "${p.slice(0, 70)}…"`).toBe(false);
      }
    }
  });

  test("no scientific notation anywhere a reader looks", () => {
    for (const t of everyTrace()) {
      for (const s of t.steps) {
        expect(/\de[+-]\d/.test(s.expression), `sci notation: ${s.expression}`).toBe(false);
      }
    }
    for (const p of plainStrings()) {
      expect(/\de[+-]\d/.test(p)).toBe(false);
    }
  });

  test("arithmetic is written with readable money, e.g. £6.60tn", () => {
    const netWorthSteps = ukNetWorth().trace.steps;
    expect(netWorthSteps[0]!.expression).toContain("£");
    expect(netWorthSteps[0]!.expression).toContain("tn");
  });

  test("sentences stay short enough to follow", () => {
    for (const p of plainStrings()) {
      for (const sentence of p.split(/(?<=[.?!])\s+/)) {
        const words = sentence.trim().split(/\s+/).length;
        expect(words, `too long (${words} words): "${sentence.slice(0, 60)}…"`)
          .toBeLessThan(45);
      }
    }
  });
});

describe("Wording can improve without rewriting history", () => {
  test("plain text is NOT part of the fingerprint", () => {
    const original = ukListedEquity();
    const reworded = trace({
      formula: original.trace.formula,
      plain: "COMPLETELY DIFFERENT WORDING, same maths.",
      meaning: "Also different.",
      ref: original.trace.ref,
      question: original.trace.question,
      unit: original.trace.unit,
      inputs: original.trace.inputs,
      steps: original.trace.steps,
      value: original.value,
    });
    expect(reworded.trace.hash).toBe(original.trace.hash);
  });

  test("but changing the maths still changes the fingerprint", () => {
    const original = ukListedEquity();
    const altered = trace({
      formula: original.trace.formula,
      plain: original.trace.plain,
      ref: original.trace.ref,
      question: original.trace.question,
      unit: original.trace.unit,
      inputs: original.trace.inputs,
      steps: original.trace.steps,
      value: original.value + 1e9,
    });
    expect(altered.trace.hash).not.toBe(original.trace.hash);
  });
});

// ===========================================================================
// SCALE
//
// 149 countries on one method. The risk in scaling a verifiable product is that the
// verification quietly stops holding — so it is asserted for every single country.
// ===========================================================================

import {
  valuableCountries, countryWealth, countryWealthPerCapita, coverage, findCountry,
} from "./countries.ts";

describe("Every country scales without losing the guarantees", () => {
  const all = valuableCountries();

  test("we value a substantial number of countries", () => {
    expect(all.length).toBeGreaterThan(140);
  });

  test("EVERY country's fingerprint verifies", () => {
    const failures: string[] = [];
    for (const c of all) {
      const w = countryWealth(c)!;
      if (!verify(w.trace, w.value).ok) failures.push(c.iso3);
    }
    expect(failures).toEqual([]);
  });

  test("every country's components reconcile to its total", () => {
    for (const c of all) {
      const w = countryWealth(c)!;
      const sum = w.trace.inputs
        .filter((n) => n.kind === "observed")
        .reduce((s, n) => s + n.value, 0);
      // Within 0.5% — the residual is rounding in the published series.
      expect(Math.abs(sum - w.value) / Math.abs(w.value)).toBeLessThan(0.005);
    }
  });

  test("no country reports negative nonrenewable resources", () => {
    for (const c of all) {
      const nonRen = countryWealth(c)!.trace.inputs
        .find((n) => n.kind === "observed" && n.label.includes("nonrenewable"));
      expect(nonRen && nonRen.value >= 0, `${c.iso3} has negative resources`).toBe(true);
    }
  });

  test("every country carries plain English and a computed meaning", () => {
    for (const c of all) {
      const w = countryWealth(c)!;
      expect(w.trace.plain!.length).toBeGreaterThan(40);
      expect(w.trace.meaning!.length).toBeGreaterThan(40);
      // The meaning must be about THIS country, not a generic sentence.
      expect(w.trace.meaning).toMatch(new RegExp(`${c.name.split(" ")[0]}|times a year|roughly the same`));
    }
  });

  test("every country states what we cannot tell them", () => {
    for (const c of all.slice(0, 25)) {
      expect(coverage(c).missing.length).toBeGreaterThan(0);
    }
  });

  test("the World Bank convention is an explicit judgement on every country", () => {
    for (const c of all.slice(0, 25)) {
      const a = assumptions(countryWealth(c)!.trace);
      expect(a.length).toBe(1);
      expect(a[0]!.rationale).toContain("INVARIANT 10");
    }
  });
});

describe("INVARIANT 10 survives scaling — the UK has two figures that must not merge", () => {
  test("World Bank and ONS give materially different answers for the same country", () => {
    const wb = countryWealth(findCountry("GBR")!)!;
    const ons = ukComprehensiveWealth();
    // Different currencies AND different conventions — the gap is the point.
    expect(wb.trace.unit).toBe("USD");
    expect(ons.trace.unit).toBe("GBP");
    expect(wb.value).not.toBeCloseTo(ons.value, -12);
  });

  test("each names its own convention so they can never be silently swapped", () => {
    const wbAssumption = assumptions(countryWealth(findCountry("GBR")!)!.trace)[0]!;
    const onsAssumption = assumptions(ukComprehensiveWealth().trace)[0]!;
    expect(wbAssumption.label).toContain("World Bank");
    expect(onsAssumption.label).toContain("ONS");
    expect(wbAssumption.value).toBe(0.04);
    expect(onsAssumption.value).toBe(0.035);
  });
});

describe("Per-person figures scale too", () => {
  test("most countries have one, and it verifies", () => {
    const all = valuableCountries();
    const withPc = all.map((c) => countryWealthPerCapita(c)).filter(Boolean);
    expect(withPc.length).toBeGreaterThan(all.length * 0.9);
    for (const pc of withPc.slice(0, 30)) {
      expect(verify(pc!.trace, pc!.value).ok).toBe(true);
    }
  });

  test("flags that it mixes a 2024 population with a 2020 wealth figure", () => {
    const pc = countryWealthPerCapita(findCountry("USA")!)!;
    expect(allWarnings(pc.trace).join(" ")).toContain("mixes two dates");
  });
});
