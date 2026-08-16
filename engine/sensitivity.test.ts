/**
 * The sensitivity dial is the only substantial motion on the site, and it recomputes a
 * published figure — so it has to be as honest as everything else. These assert that it
 * is pinned to reality at the baseline and truthful about the shape away from it.
 */

import { describe, test, expect } from "bun:test";

import {
  annuityFactor, humanCapitalAtRate, totalAtRate,
  sensitivityPerPercentagePoint, modelFromTrace, CONVENTION_MARKS,
} from "./sensitivity.ts";
import { ukComprehensiveWealth } from "./valuations.ts";
import { countryWealth, findCountry } from "./countries.ts";

const ONS = { baseline: 25.5e12, baselineRate: 0.035, wageGrowth: 0.02, years: 40 };

describe("The dial is pinned to the published figure", () => {
  test("at the published rate it returns the published number exactly", () => {
    expect(humanCapitalAtRate(ONS, ONS.baselineRate)).toBeCloseTo(ONS.baseline, 0);
  });

  test("the total at the published rate is the published total", () => {
    const other = 13.3e12;
    const p = totalAtRate(ONS, other, ONS.baselineRate);
    expect(p.total).toBeCloseTo(ONS.baseline + other, 0);
    expect(p.changeFromBaseline).toBeCloseTo(0, 10);
  });
});

describe("It moves the right way, by a defensible amount", () => {
  test("a higher discount rate makes future earnings worth less", () => {
    expect(humanCapitalAtRate(ONS, 0.045)).toBeLessThan(ONS.baseline);
  });

  test("a lower discount rate makes them worth more", () => {
    expect(humanCapitalAtRate(ONS, 0.025)).toBeGreaterThan(ONS.baseline);
  });

  test("one percentage point moves people-value by a substantial double-digit share", () => {
    const perPp = sensitivityPerPercentagePoint(ONS);
    // Large enough to be the point of the exercise, not so large it is implausible.
    expect(perPp).toBeGreaterThan(0.10);
    expect(perPp).toBeLessThan(0.45);
  });

  test("the move dwarfs any year-to-year change — which is why we show it", () => {
    const shifted = totalAtRate(ONS, 13.3e12, ONS.baselineRate + 0.01);
    // The UK balance sheet moved 1.6% between 2024 and 2025.
    expect(Math.abs(shifted.changeFromBaseline)).toBeGreaterThan(0.016 * 3);
  });
});

describe("The annuity maths is sound at the edges", () => {
  test("a zero net rate is a plain sum, not a divide-by-zero", () => {
    expect(annuityFactor(0, 40)).toBe(40);
    expect(Number.isFinite(annuityFactor(1e-15, 40))).toBe(true);
  });

  test("longer working lives are worth more", () => {
    expect(annuityFactor(0.015, 40)).toBeGreaterThan(annuityFactor(0.015, 20));
  });

  test("the factor falls as the net rate rises", () => {
    expect(annuityFactor(0.04, 40)).toBeLessThan(annuityFactor(0.015, 40));
  });

  test("never returns NaN across the whole slider range", () => {
    for (let r = 0.02; r <= 0.06001; r += 0.0005) {
      expect(Number.isFinite(humanCapitalAtRate(ONS, r))).toBe(true);
    }
  });
});

describe("It attaches only where there is a judgement to drag", () => {
  test("builds from the UK's ONS-based figure, carrying the 2% wage assumption", () => {
    const t = ukComprehensiveWealth();
    const m = modelFromTrace(t.trace, t.value)!;
    expect(m).not.toBeNull();
    expect(m.model.baselineRate).toBe(0.035);
    expect(m.model.wageGrowth).toBe(0.02);
    // Components must still add to the published total.
    expect(m.model.baseline + m.otherComponents).toBeCloseTo(t.value, 0);
  });

  test("builds from a World Bank country figure, with NO wage growth", () => {
    const w = countryWealth(findCountry("USA")!)!;
    const m = modelFromTrace(w.trace, w.value)!;
    expect(m.model.baselineRate).toBe(0.04);
    expect(m.model.wageGrowth).toBe(0);
    expect(m.model.baseline + m.otherComponents).toBeCloseTo(w.value, 0);
  });

  test("returns nothing for a calculation with no discount-rate judgement", () => {
    const w = countryWealth(findCountry("USA")!)!;
    const noAssumption = { ...w.trace, inputs: w.trace.inputs.filter((n) => n.kind !== "assumption") };
    expect(modelFromTrace(noAssumption, w.value)).toBeNull();
  });

  test("both conventions are offered as jump points", () => {
    expect(CONVENTION_MARKS.map((m) => m.rate)).toEqual([0.035, 0.04]);
  });
});

describe("The dial explains the gap between the two conventions", () => {
  test("moving the UK figure to World Bank settings makes it materially smaller", () => {
    const t = ukComprehensiveWealth();
    const m = modelFromTrace(t.trace, t.value)!;
    // Same discount rate, but strip the 2% wage-growth assumption the World Bank omits.
    const worldBankStyle = { ...m.model, wageGrowth: 0, baselineRate: 0.035 };
    const shifted = humanCapitalAtRate(
      { ...worldBankStyle, baseline: m.model.baseline, baselineRate: 0.035 }, 0.04,
    );
    expect(shifted).toBeLessThan(m.model.baseline);
  });
});

describe("The gap with the official sensitivity is disclosed, not tuned away", () => {
  test("our simpler model gives less swing than ONS guidance implies", () => {
    const perPp = sensitivityPerPercentagePoint(ONS);
    // ONS guidance implies roughly 25-30% per percentage point. A level annuity over a
    // working life is a flatter stream than real career earnings, so it comes out lower.
    expect(perPp).toBeLessThan(0.25);
    // The component says so explicitly and states the direction. If someone "fixes" the
    // model by tuning `years` until it matches, this test fails and forces the copy to
    // be revisited rather than the discrepancy quietly disappearing.
    expect(perPp).toBeGreaterThan(0.12);
  });
});
