/**
 * Companies — what must stay true.
 *
 * Two kinds of test here. The first kind checks the maths. The second kind checks
 * things nobody would think to check until they have already gone wrong once: that the
 * ranking still contains the companies everyone has heard of, that a business with
 * negative book capital is refused rather than assigned a nonsense return, and that we
 * never publish a value for a company that lost money.
 */

import { describe, test, expect } from "bun:test";
import {
  rankedCompanies, findCompany, investedCapital, returnOnCapital, valueCreated,
  companyValue, impliedByPrice, taxRateOf, displayName, unmeasurable, companyCoverage,
  COST_OF_CAPITAL, LONG_RUN_GROWTH, COST_OF_EQUITY, SEC_YEAR,
} from "./companies.ts";
import { RISK_FREE } from "./constants.ts";
import { verify, assumptions, leaves } from "./trace.ts";

const ranked = rankedCompanies();
const byName = (needle: string) =>
  ranked.find((r) => r.company.name.toUpperCase().includes(needle.toUpperCase()));

describe("The ranking is real and complete", () => {
  test("it publishes a usable number of companies", () => {
    expect(ranked.length).toBeGreaterThan(200);
  });

  test("the companies everyone has heard of are in it", () => {
    // The ingest can lose whole sectors silently when a tag changes — Amazon was dropped
    // by the first draft because it uses a different pre-tax income tag. A ranking that
    // loses these is broken in a way that still looks plausible.
    for (const name of ["APPLE", "MICROSOFT", "AMAZON", "ALPHABET", "WALMART", "NVIDIA"]) {
      expect(byName(name), `missing from the ranking: ${name}`).toBeDefined();
    }
  });

  test("it is sorted by value created, not by size", () => {
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.valueCreated).toBeGreaterThanOrEqual(ranked[i]!.valueCreated);
    }
    // If it were sorted by size, the biggest company by revenue would lead.
    const topByRevenue = [...ranked].sort((a, b) => b.company.revenue - a.company.revenue)[0]!;
    expect(ranked[0]!.company.cik).not.toBe(topByRevenue.company.cik);
  });

  test("both creators and destroyers are present", () => {
    const cov = companyCoverage();
    expect(cov.creators).toBeGreaterThan(50);
    expect(cov.destroyers).toBeGreaterThan(20);
    expect(cov.creators + cov.destroyers).toBe(cov.published);
  });
});

describe("Return on capital", () => {
  test("it reconciles: value created is the gap times the capital", () => {
    for (const r of ranked.slice(0, 30)) {
      const expected = (r.roic - COST_OF_CAPITAL) * r.investedCapital;
      expect(r.valueCreated).toBeCloseTo(expected, 2);
    }
  });

  test("a company clears the bar exactly when it creates value", () => {
    for (const r of ranked) {
      expect(r.valueCreated > 0).toBe(r.roic > COST_OF_CAPITAL);
    }
  });

  test("high-return businesses come out with high returns", () => {
    // A sanity anchor. If a change to invested capital ever puts Apple at 4%, the
    // definition has broken, and no unit test on the arithmetic would notice.
    const apple = byName("APPLE")!;
    expect(apple.roic).toBeGreaterThan(0.30);
    expect(apple.roic).toBeLessThan(2.0);
  });

  test("2024's famous write-downs show up as value destruction", () => {
    // Intel, Boeing and Walgreens all had catastrophic years. If they appear as value
    // creators, the sign convention is wrong somewhere.
    for (const name of ["INTEL", "BOEING", "WALGREENS"]) {
      const r = byName(name);
      expect(r, `${name} should be in the ranking`).toBeDefined();
      expect(r!.valueCreated, `${name} should be destroying value in ${SEC_YEAR}`).toBeLessThan(0);
    }
  });
});

describe("Refusals — what we decline to answer", () => {
  test("negative book capital is refused, not fudged", () => {
    const excluded = unmeasurable();
    expect(excluded.length).toBeGreaterThan(0);
    for (const c of excluded) {
      expect(investedCapital(c)).toBeNull();
      expect(returnOnCapital(c)).toBeNull();
      expect(valueCreated(c)).toBeNull();
      // The reason must be real: equity plus debt less cash is genuinely non-positive.
      expect(c.equity + c.debt - c.cash).toBeLessThanOrEqual(0);
    }
  });

  test("a loss-making company gets no valuation at all", () => {
    const losers = ranked.filter((r) => r.roic <= 0);
    expect(losers.length).toBeGreaterThan(0);
    for (const r of losers) {
      expect(companyValue(r.company), `${r.company.name} should not be valued`).toBeNull();
    }
  });

  test("an implausible tax rate falls back to the marginal rate and says so", () => {
    const odd = ranked
      .map((r) => ({ r, t: taxRateOf(r.company) }))
      .filter((x) => !x.t.measured);
    for (const x of odd) {
      expect(x.t.why.length).toBeGreaterThan(40);
      expect(x.t.rate).toBe(0.25);
    }
  });
});

describe("The value range", () => {
  const withValue = ranked
    .map((r) => ({ r, v: companyValue(r.company) }))
    .filter((x) => x.v !== null) as { r: (typeof ranked)[number]; v: NonNullable<ReturnType<typeof companyValue>> }[];

  test("most companies get one", () => {
    expect(withValue.length).toBeGreaterThan(150);
  });

  test("it is never a point estimate for a value-creating business", () => {
    for (const { r, v } of withValue) {
      if (r.roic <= COST_OF_CAPITAL) continue;
      expect(v.ceiling.value, `${r.company.name} range collapsed`).toBeGreaterThan(v.floor.value);
    }
  });

  test("INVARIANT 1 — long-run growth never exceeds the risk-free rate", () => {
    expect(LONG_RUN_GROWTH).toBeLessThanOrEqual(RISK_FREE.aug2026.value);
    expect(COST_OF_CAPITAL).toBeGreaterThan(LONG_RUN_GROWTH);
  });

  test("the ceiling formula agrees with the economic-profit form of the same identity", () => {
    // V = IC x (ROIC - g)/(WACC - g) must equal IC + EP/(WACC - g). They are the same
    // identity written two ways; if they ever diverge, one of them has been edited.
    for (const { r, v } of withValue.slice(0, 40)) {
      const viaEconomicProfit =
        r.investedCapital + r.valueCreated / (COST_OF_CAPITAL - LONG_RUN_GROWTH);
      expect(v.ceiling.value / viaEconomicProfit).toBeCloseTo(1, 6);
    }
  });
});

describe("Inverting a price", () => {
  const apple = findCompany(320193)!;

  test("a higher price always demands more revenue", () => {
    const low = impliedByPrice(apple, 1e12)!;
    const high = impliedByPrice(apple, 4e12)!;
    expect(high.requiredRevenue).toBeGreaterThan(low.requiredRevenue);
    expect(high.requiredGrowth).toBeGreaterThan(low.requiredGrowth);
  });

  test("it inverts cleanly — the required profit reproduces the price", () => {
    const r = impliedByPrice(apple, 3e12)!;
    const backOut = (r.requiredProfit * (1 + LONG_RUN_GROWTH)) / (COST_OF_EQUITY - LONG_RUN_GROWTH);
    expect(backOut).toBeCloseTo(3e12, -6);
  });

  test("it refuses a nonsense price rather than returning a nonsense answer", () => {
    expect(impliedByPrice(apple, 0)).toBeNull();
    expect(impliedByPrice(apple, -5e11)).toBeNull();
  });

  test("every verdict is a sentence a non-expert can act on", () => {
    for (const price of [5e11, 1e12, 3e12, 9e12, 4e13]) {
      const r = impliedByPrice(apple, price)!;
      expect(r.verdict.length).toBeGreaterThan(60);
      expect(/[A-Z]/.test(r.verdict[0]!)).toBe(true);
    }
  });
});

describe("Every company figure is checkable", () => {
  test("every published trace recomputes to its own hash", () => {
    for (const r of ranked.slice(0, 25)) {
      const v = companyValue(r.company);
      for (const t of [
        investedCapital(r.company), returnOnCapital(r.company), valueCreated(r.company),
        v?.floor, v?.ceiling,
      ]) {
        if (!t) continue;
        expect(verify(t.trace, t.value).ok, `${r.company.name}: ${t.trace.formula}`).toBe(true);
      }
    }
  });

  test("the judgements are few, and every one of them is a marked assumption", () => {
    for (const r of ranked.slice(0, 20)) {
      const t = valueCreated(r.company)!;
      const judged = assumptions(t.trace);
      expect(judged.length).toBeGreaterThan(0);
      // The whole claim of these pages: nearly everything is a filed fact.
      expect(judged.length).toBeLessThan(leaves(t.trace).length);
      for (const a of judged) expect(a.rationale.length).toBeGreaterThan(60);
    }
  });

  test("every observed input names the filing it came from", () => {
    const t = valueCreated(ranked[0]!.company)!;
    for (const leaf of leaves(t.trace)) {
      if (leaf.kind !== "observed") continue;
      expect(leaf.source).toContain("SEC EDGAR");
      expect(leaf.url).toContain("sec.gov");
      expect(leaf.asOf.length).toBe(10);
    }
  });
});

describe("It reads like English", () => {
  test("EDGAR's shouting is cleaned up without mangling real names", () => {
    expect(displayName("WALMART INC.")).toBe("Walmart Inc.");
    expect(displayName("PG&E CORP")).toBe("PG&E Corp");
    expect(displayName("AMAZON.COM, INC.")).toBe("Amazon.com, Inc.");
    // Already mixed case is left alone.
    expect(displayName("Meta Platforms, Inc.")).toBe("Meta Platforms, Inc.");
  });

  test("every plain-English line avoids the jargon it exists to replace", () => {
    const banned = /\bNOPAT\b|\bWACC\b|\bEBIT\b|\bROIC\b|economic profit|invested capital/i;
    for (const r of ranked.slice(0, 15)) {
      const v = companyValue(r.company);
      for (const t of [
        investedCapital(r.company), returnOnCapital(r.company), valueCreated(r.company),
        v?.floor, v?.ceiling,
      ]) {
        if (!t?.trace.plain) continue;
        expect(banned.test(t.trace.plain), `jargon leaked: ${t.trace.plain}`).toBe(false);
      }
    }
  });

  test("what a figure means is computed per company, not boilerplate", () => {
    const meanings = ranked.slice(0, 20).map((r) => valueCreated(r.company)!.trace.meaning);
    expect(new Set(meanings).size).toBe(meanings.length);
  });
});
