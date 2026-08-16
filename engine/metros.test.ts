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
