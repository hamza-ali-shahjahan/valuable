/**
 * Metros. The section most at risk of quietly publishing nonsense, because the naive
 * valuation is both obvious and wrong by a factor of three — and because the source
 * dataset mixes metros with countries.
 */

import { describe, test, expect } from "bun:test";

import {
  allMetros, findMetro, metroValue, impliedMultiple, metroCoverage,
  addAgglomerationToLandValue, DoubleCountedMetroError,
  CAPITAL_SHARE, METRO_YEAR,
} from "./metros.ts";
import { verify, assumptions, allWarnings } from "./trace.ts";

describe("Only genuine metros survived ingestion", () => {
  const ms = allMetros();

  test("we have a substantial set across many countries", () => {
    expect(ms.length).toBeGreaterThan(200);
    expect(new Set(ms.map((m) => m.country)).size).toBeGreaterThan(20);
  });

  test("no country totals leaked in as cities", () => {
    // The source dimension mixes metro regions with national and "non-metropolitan"
    // aggregates. Unfiltered, the largest "metro" in Europe is Germany.
    for (const m of ms) {
      expect(m.code, `${m.name} has a non-metro code`).toMatch(/^[A-Z]{2}\d{3}MC?$/);
    }
    const names = ms.map((m) => m.name.toLowerCase());
    for (const country of ["germany", "france", "italy", "spain", "poland"]) {
      expect(names, `${country} leaked in as a city`).not.toContain(country);
    }
  });

  test("capitals are present — a filter missing them still looks plausible", () => {
    // The suffix for a capital metro is MC, not M. Filtering on M alone silently drops
    // every capital in Europe while still returning 226 believable rows.
    const capitals = ms.filter((m) => m.isCapital);
    expect(capitals.length).toBeGreaterThan(20);
    for (const name of ["Paris", "Berlin", "Madrid", "Wien", "Warszawa", "Praha"]) {
      expect(ms.some((m) => m.name === name), `${name} is missing`).toBe(true);
    }
  });

  test("Paris is the largest, as it should be", () => {
    const sorted = [...ms].sort((a, b) => b.gdpEur - a.gdpEur);
    expect(sorted[0]!.name).toBe("Paris");
  });
});

describe("The valuation avoids the obvious mistake", () => {
  test("only the capital share of output is claimed", () => {
    expect(CAPITAL_SHARE).toBeGreaterThan(0.2);
    expect(CAPITAL_SHARE).toBeLessThan(0.5);
  });

  test("the multiple sits inside the defensible 4-8x band", () => {
    const m = impliedMultiple();
    expect(m).toBeGreaterThan(4);
    expect(m).toBeLessThan(8);
  });

  test("it is well below the naive whole-output capitalisation", () => {
    // Capitalising ALL of city output gives roughly 23x — the error this avoids.
    const naive = (1 + 0.03) / (0.075 - 0.03);
    expect(impliedMultiple()).toBeLessThan(naive / 2.5);
  });

  test("EVERY metro verifies", () => {
    const failures: string[] = [];
    for (const m of allMetros()) {
      const v = metroValue(m);
      if (v && !verify(v.trace, v.value).ok) failures.push(m.code);
    }
    expect(failures).toEqual([]);
  });

  test("every metro says the labour share is not ours to claim", () => {
    for (const m of allMetros().slice(0, 30)) {
      const w = allWarnings(metroValue(m)!.trace).join(" ").toLowerCase();
      expect(w).toContain("wages");
      expect(w).toMatch(/can leave|can't move|cannot move/);
    }
  });

  test("every metro admits the multiple is a two-to-one range", () => {
    for (const m of allMetros().slice(0, 30)) {
      const w = allWarnings(metroValue(m)!.trace).join(" ");
      expect(w).toMatch(/four and eight/);
      expect(w).toContain("order of magnitude");
    }
  });

  test("three of the four inputs are judgements, and are marked as such", () => {
    const v = metroValue(findMetro("FR001MC")!)!;
    expect(assumptions(v.trace).length).toBe(3);
    expect(v.trace.inputs.filter((n) => n.kind === "observed").length).toBe(1);
  });
});

describe("Ireland's distortion is flagged where it lands", () => {
  test("Dublin carries an extra warning about inflated national accounts", () => {
    const w = allWarnings(metroValue(findMetro("IE001MC")!)!.trace).join(" ");
    expect(w).toContain("intellectual property");
    expect(w).toMatch(/aircraft leasing/);
    expect(w).toContain("accounting reasons");
  });

  test("other metros do not carry it", () => {
    const w = allWarnings(metroValue(findMetro("DE001MC")!)!.trace).join(" ");
    expect(w).not.toContain("aircraft leasing");
  });

  test("Dublin outranks cities several times its size — which is the point of the warning", () => {
    const dublin = findMetro("IE001MC")!;
    const berlin = findMetro("DE001MC")!;
    expect(dublin.gdpEur).toBeGreaterThan(berlin.gdpEur);
    expect(dublin.population!).toBeLessThan(berlin.population! / 2);
  });
});

describe("INVARIANT 11: agglomeration and land value are the same thing", () => {
  test("adding them throws", () => {
    expect(() => addAgglomerationToLandValue()).toThrow(DoubleCountedMetroError);
    expect(() => addAgglomerationToLandValue()).toThrow(/same thing counted/);
  });
});

describe("The coverage gap is stated, not hidden", () => {
  const cov = metroCoverage();

  test("London's absence is named explicitly", () => {
    expect(cov.missing.join(" ")).toContain("London");
    expect(cov.missing.join(" ")).toContain("left the EU");
  });

  test("the rest of the world is named as absent, with the reason", () => {
    const all = cov.missing.join(" ");
    expect(all).toContain("India");
    expect(all).toMatch(/commercial model/);
  });

  test("the frozen year is carried through", () => {
    expect(METRO_YEAR).toBe(2021);
    expect(allWarnings(metroValue(findMetro("FR001MC")!)!.trace).join(" ")).toContain("2021");
  });
});

// ===========================================================================
// THE FOUNDER TOOL
//
// The "what would move it" half of the promise. Its job is to be honest with someone
// who badly wants good news — so the guarantees are tested, not intended.
// ===========================================================================

import {
  founderValuation, projectExitRevenue, rankLevers, GROWTH_ENDURANCE,
  FAILURE_BY_STAGE, STAGE_THRESHOLDS, topDownTam, TopDownTamError,
  type FounderInputs, type Stage,
} from "./startup.ts";
import { rangeWidth } from "./core.ts";

const FOUNDER: FounderInputs = {
  stage: "seed", arr: 1_200_000, growthRate: 1.8, grossMargin: 0.72,
  ndr: 0.96, grr: 0.88, logoRetention: 0.83, netBurn: 2_400_000,
  netNewArr: 800_000, cac: 18_000, arpa: 24_000, fcfMargin: -1.2,
  salesAndMarketing: 900_000,
};

describe("The founder tool never gives a single number", () => {
  test("it returns a range, and a wide one", () => {
    const v = founderValuation({ inputs: FOUNDER });
    expect(v.range.low).toBeLessThan(v.range.central);
    expect(v.range.central).toBeLessThan(v.range.high);
    // Narrow bands here would be false precision — the honest band is wide.
    expect(rangeWidth(v.range)).toBeGreaterThan(0.5);
  });

  test("it works at every stage", () => {
    for (const stage of Object.keys(STAGE_THRESHOLDS) as Stage[]) {
      const v = founderValuation({ inputs: { ...FOUNDER, stage } });
      expect(Number.isFinite(v.range.central)).toBe(true);
      expect(v.range.low).toBeGreaterThan(0);
    }
  });

  test("it refuses a top-down market size", () => {
    expect(() => topDownTam()).toThrow(TopDownTamError);
  });
});

describe("It assumes growth slows, because growth always slows", () => {
  test("projected revenue is far below naive compounding", () => {
    const years = 8;
    const decayed = projectExitRevenue({ arr: 1e6, growthRate: 1.8, years });
    const naive = 1e6 * Math.pow(1 + 1.8, years);
    expect(decayed).toBeLessThan(naive / 20);
  });

  test("endurance is set below 1 — assuming otherwise is the classic fantasy", () => {
    expect(GROWTH_ENDURANCE).toBeGreaterThan(0.4);
    expect(GROWTH_ENDURANCE).toBeLessThan(0.9);
  });

  test("faster growth still means a bigger exit, just not a silly one", () => {
    const slow = projectExitRevenue({ arr: 1e6, growthRate: 0.5, years: 8 });
    const fast = projectExitRevenue({ arr: 1e6, growthRate: 2.5, years: 8 });
    expect(fast).toBeGreaterThan(slow);
  });
});

describe("Failure odds are shown, not buried in the discount rate", () => {
  test("every stage carries a real failure probability", () => {
    for (const stage of Object.keys(FAILURE_BY_STAGE) as Stage[]) {
      expect(FAILURE_BY_STAGE[stage]).toBeGreaterThan(0.2);
      expect(FAILURE_BY_STAGE[stage]).toBeLessThan(0.9);
    }
  });

  test("earlier stages are riskier than later ones", () => {
    expect(FAILURE_BY_STAGE.pre_seed).toBeGreaterThan(FAILURE_BY_STAGE.series_b);
  });

  test("the odds are surfaced as a named assumption a founder can see", () => {
    const v = founderValuation({ inputs: FOUNDER });
    const shown = v.assumptions.find((a) => /doesn't work|odds/i.test(a.label));
    expect(shown).toBeDefined();
    expect(shown!.value).toContain("%");
  });

  test("all six assumptions explain why they matter", () => {
    const v = founderValuation({ inputs: FOUNDER });
    expect(v.assumptions.length).toBe(6);
    for (const a of v.assumptions) expect(a.why.length).toBeGreaterThan(40);
  });
});

describe("The levers are the product, and they rank honestly", () => {
  test("what's broken comes before what's fine", () => {
    const r = rankLevers(FOUNDER);
    const firstPassing = r.levers.findIndex((l) => l.passing);
    const lastFailing = r.levers.map((l) => l.passing).lastIndexOf(false);
    if (firstPassing !== -1 && lastFailing !== -1) {
      expect(lastFailing).toBeLessThan(firstPassing);
    }
  });

  test("every lever tells you what to actually do", () => {
    for (const l of rankLevers(FOUNDER).levers) {
      expect(l.action.length).toBeGreaterThan(30);
    }
  });

  test("strong efficiency at low revenue is recognised, not punished", () => {
    const lean = rankLevers({
      ...FOUNDER, stage: "series_a", arr: 2.4e6, ndr: 1.18,
      netBurn: 1.2e6, netNewArr: 1.4e6, grossMargin: 0.8, logoRetention: 0.93,
    });
    expect(lean.pattern).toContain("lower ARR");
  });

  test("revenue without efficiency is called out as the classic rejection", () => {
    const bloated = rankLevers({
      ...FOUNDER, stage: "series_a", arr: 6e6, growthRate: 0.3,
      ndr: 0.9, netBurn: 9e6, netNewArr: 1.2e6, grossMargin: 0.5, logoRetention: 0.72,
    });
    expect(bloated.pattern).toContain("pattern mismatch");
    expect(bloated.readiness).toBe("not_ready");
  });
});

// ===========================================================================
// THE PICKER, AND WHOSE COUNTRY LEADS THE PAGE
//
// Both of these were reported by the operator looking at the live site, not by any
// failing test. Encoded so they cannot come back.
// ===========================================================================

import { allCompositions as _comps } from "./countries.ts";
import { findings as _findings } from "./findings.ts";

describe("Countries can be found in a list of 149", () => {
  const alphabetical = [..._comps()].sort((a, b) => a.name.localeCompare(b.name));

  test("large countries people look for are all present", () => {
    const names = alphabetical.map((c) => c.name);
    for (const n of ["India", "Pakistan", "Bangladesh", "Nigeria", "Brazil", "Indonesia"]) {
      expect(names, `${n} is missing`).toContain(n);
    }
  });

  test("sorting alphabetically actually reorders — it is not already A to Z", () => {
    // The engine returns countries ranked by wealth, which is right for a ranking and
    // useless in a picker. India sat at position 8 and Pakistan at 43 among 149 rows.
    const byWealth = _comps().map((c) => c.name);
    const byName = alphabetical.map((c) => c.name);
    expect(byWealth[0]).not.toBe(byName[0]);
    expect(byName[0]! <= byName[1]!).toBe(true);
  });

  test("A to Z puts India and Pakistan where someone would look", () => {
    const names = alphabetical.map((c) => c.name);
    const india = names.indexOf("India");
    const pakistan = names.indexOf("Pakistan");
    // Both should sit in the middle-to-late alphabet, not at wealth-rank 8 and 43.
    expect(india).toBeGreaterThan(40);
    expect(pakistan).toBeGreaterThan(india);
  });
});

describe("The front page represents the world, not one country", () => {
  const f = _findings();

  test("no finding leads with Britain", () => {
    for (const x of f) {
      expect(/^(britain|the uk|united kingdom)/i.test(x.headline), x.headline).toBe(false);
    }
  });

  test("at most one finding is about Britain at all", () => {
    const uk = f.filter((x) => /britain|british|united kingdom/i.test(x.headline + x.body));
    expect(uk.length).toBeLessThanOrEqual(1);
  });

  test("findings span several continents", () => {
    const all = f.map((x) => x.headline + " " + x.body).join(" ");
    const mentioned = ["India", "China", "Singapore", "Iraq", "Nigeria", "Lao", "Dublin", "Berlin"]
      .filter((n) => all.includes(n));
    expect(mentioned.length).toBeGreaterThanOrEqual(4);
  });

  test("the opening finding is not about Britain", () => {
    expect(/britain|united kingdom/i.test(f[0]!.headline)).toBe(false);
  });
});
