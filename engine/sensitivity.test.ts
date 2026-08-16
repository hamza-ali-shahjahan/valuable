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

// ===========================================================================
// COMPOSITION
//
// The bar is a picture of a number, so it has to be as honest as the number. Shares that
// don't sum to 100%, or a negative slice, would be a lie told in a nice colour.
// ===========================================================================

import {
  countryComposition, allCompositions, compositionExtremes, valuableCountries,
} from "./countries.ts";

describe("Composition shares are honest", () => {
  const all = allCompositions();

  test("we can break down essentially every country we value", () => {
    expect(all.length).toBeGreaterThan(valuableCountries().length * 0.98);
  });

  test("EVERY country's shares sum to exactly 100%", () => {
    for (const c of all) {
      expect(c.produced + c.human + c.natural).toBeCloseTo(1, 9);
    }
  });

  test("no share is ever negative — a negative slice would be a lie", () => {
    for (const c of all) {
      expect(c.produced).toBeGreaterThanOrEqual(0);
      expect(c.human).toBeGreaterThanOrEqual(0);
      expect(c.natural).toBeGreaterThanOrEqual(0);
    }
  });

  test("net foreign assets are kept OUT of the shares, because they can be negative", () => {
    const negative = all.filter((c) => c.netForeign < 0);
    expect(negative.length).toBeGreaterThan(0);
    // Its exclusion is why the three shares can still sum to 1.
    for (const c of negative.slice(0, 20)) {
      expect(c.produced + c.human + c.natural).toBeCloseTo(1, 9);
    }
  });

  test("the breakdown reflects the country's real character", () => {
    const nga = countryComposition(valuableCountries().find((c) => c.iso3 === "NGA")!)!;
    const gbr = countryComposition(valuableCountries().find((c) => c.iso3 === "GBR")!)!;
    // Nigeria is resource-heavy; the UK has almost none left.
    expect(nga.natural).toBeGreaterThan(0.25);
    expect(gbr.natural).toBeLessThan(0.05);
    expect(gbr.human).toBeGreaterThan(0.5);
  });
});

describe("The striking examples come from the data, not from a hardcoded list", () => {
  const ex = compositionExtremes();

  test("we find genuine extremes", () => {
    expect(ex.length).toBeGreaterThanOrEqual(2);
  });

  test("each is actually extreme on the dimension it claims", () => {
    const all = allCompositions().filter((c) => c.total > 2e11);
    for (const e of ex) {
      const dominant = (["produced", "human", "natural"] as const)
        .map((k) => ({ k, share: e.composition[k] }))
        .sort((a, b) => b.share - a.share)[0]!;
      const topForThat = Math.max(...all.map((c) => c[dominant.k]));
      // It should be at or very near the top of its own category.
      expect(e.composition[dominant.k]).toBeGreaterThan(topForThat * 0.85);
    }
  });

  test("each explains itself in plain words with its own number", () => {
    for (const e of ex) {
      expect(e.why).toContain(e.composition.name);
      expect(e.why).toMatch(/\d+%/);
    }
  });

  test("no country appears twice", () => {
    expect(new Set(ex.map((e) => e.composition.iso3)).size).toBe(ex.length);
  });
});

// ===========================================================================
// THE FRONT PAGE
//
// Findings are computed, not written, so they cannot drift out of line with the pages
// they point at. These assert that they stay true and stay linked.
// ===========================================================================

import { findings, searchIndex } from "./findings.ts";
import { sourcesInUse, REFUSED } from "./sources.ts";

describe("Findings are computed and stay true", () => {
  const f = findings();

  test("there are enough to fill the page", () => {
    expect(f.length).toBeGreaterThanOrEqual(4);
  });

  test("each carries a headline, a body and something to do next", () => {
    for (const x of f) {
      expect(x.headline.length).toBeGreaterThan(25);
      expect(x.body.length).toBeGreaterThan(80);
      expect(x.action.length).toBeGreaterThan(5);
      expect(x.href.startsWith("/")).toBe(true);
    }
  });

  test("every finding links somewhere that exists", () => {
    const valid =
      /^\/(countries|metros|companies|country\/[a-z]+|metro\/[a-z0-9]+|company\/\d+|trace\/[0-9a-f]{64})$/;
    for (const x of f) {
      expect(valid.test(x.href), `bad link: ${x.href}`).toBe(true);
    }
  });

  test("headlines carry real figures, not vague claims", () => {
    const withNumbers = f.filter((x) => /[\d£$€]/.test(x.headline));
    expect(withNumbers.length).toBeGreaterThanOrEqual(3);
  });

  test("no finding claims to be news — our data has fixed vintages", () => {
    // "worth today" is present-value language, not a freshness claim, so the check
    // targets phrases that actually assert recency.
    const newsy = /\b(breaking|just in|this (week|month)|latest figures|newly released|as of today)\b/i;
    for (const x of f) {
      expect(newsy.test(x.headline + " " + x.body), `sounds like news: ${x.headline}`).toBe(false);
    }
  });
});

describe("Search covers everything we can value", () => {
  const idx = searchIndex();

  test("every country and every city is findable", () => {
    expect(idx.length).toBeGreaterThan(390);
    expect(idx.some((e) => e.kind === "country")).toBe(true);
    expect(idx.some((e) => e.kind === "city")).toBe(true);
  });

  test("the UK resolves to its own richer page, not the generic one", () => {
    expect(idx.find((e) => e.name === "United Kingdom")!.href).toBe("/country/uk");
  });

  test("every entry has somewhere to go and something to show", () => {
    for (const e of idx) {
      expect(e.href.startsWith("/")).toBe(true);
      expect(e.detail.length).toBeGreaterThan(3);
    }
  });
});

describe("The sources page is generated from what is actually used", () => {
  const s = sourcesInUse();

  test("it finds the sources we depend on", () => {
    const names = s.map((x) => x.name);
    expect(names).toContain("World Bank");
    expect(names).toContain("Eurostat");
    expect(names).toContain("ONS");
  });

  test("each records how many published figures rely on it", () => {
    for (const x of s) expect(x.figures).toBeGreaterThan(0);
    // Ordered by how much of the site each one carries. This used to pin the World Bank
    // in first place; companies overtook it, because each company publishes five figures
    // where a country publishes two. Assert the ordering rule, not today's winner —
    // otherwise the test fails every time we add an entity type, which is not a defect.
    for (let i = 1; i < s.length; i++) {
      expect(s[i - 1]!.figures).toBeGreaterThanOrEqual(s[i]!.figures);
    }
    expect(s.find((x) => x.name === "World Bank")!.figures).toBeGreaterThan(200);
  });

  test("each states its licence and whether we may pass it on", () => {
    for (const x of s) {
      expect(x.licence.length).toBeGreaterThan(20);
      expect(typeof x.redistributable).toBe("boolean");
    }
  });

  test("unconfirmed figures are counted, not hidden", () => {
    expect(s.some((x) => x.unverified > 0)).toBe(true);
  });

  test("what we refuse is listed with a reason each", () => {
    expect(REFUSED.length).toBeGreaterThanOrEqual(8);
    for (const r of REFUSED) expect(r.why.length).toBeGreaterThan(40);
    expect(REFUSED.map((r) => r.name).join(" ")).toMatch(/BIS/);
  });
});
