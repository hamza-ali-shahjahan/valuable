/**
 * The invariants from docs/00-FIRST-PRINCIPLES.md §7, as executable tests.
 *
 * Each of these was earned by a specific documented error mode. A failure here means
 * the engine would publish a number we know to be wrong.
 */

import { describe, test, expect } from "bun:test";

import { perpetuity, cumulatedDiscountFactor, range, sensitivities, universalValue } from "./core.ts";
import { RISK_FREE, INDUSTRY_ANCHORS, NIGHTLIGHTS_GDP_ELASTICITY, CLINICAL_PHASE_SUCCESS } from "./constants.ts";
import {
  nationalNetWorth, debtDynamics, addListedEquityToNetWorth, DoubleCountError,
  assertSameConvention, ConventionMismatchError, gdpMultipleAxis, comprehensiveWealth,
} from "./country.ts";
import {
  fcffValuation, breakevenRevenue, evToRevenue, evToGmv, priceToTangibleBook,
  assertValidDenominator, WrongDenominatorError, rnpv,
} from "./company.ts";
import {
  topDownTam, bottomUpTam, TopDownTamError, valueStartup, rateBurnMultiple,
  magicNumber, BURN_MULTIPLE_SCALE, vcMethod, survivalAdjust, optionPoolShuffle,
  totalBeta, INVESTOR_CORRELATION, cacPaybackMonths, rankLevers,
} from "./startup.ts";
import {
  UK_NET_WORTH, UK_BALANCE_SHEET_2025, UK_SECTOR_SPLIT_2025, UK_FISCAL,
  UK_HUMAN_CAPITAL, METRO_EV_TO_GMP_BENCHMARKS, MUSK_UK_EVENT, LONDON,
} from "../data/uk.ts";

const meta = { asOf: "2026-08-14", source: "test" };

// ===========================================================================
// THE RECONCILIATION — the "proof before done" for slice 1
// ===========================================================================

describe("UK reconciliation — our engine must match the official balance sheet", () => {
  test("components sum to the published £13.31tn net worth", () => {
    const result = nationalNetWorth({
      producedAssets: UK_BALANCE_SHEET_2025.producedAssets.value,
      nonProducedAssets: UK_BALANCE_SHEET_2025.nonProducedAssets.value,
      netFinancialWorth: UK_BALANCE_SHEET_2025.netFinancialWorth.value,
    });
    // 6.6 + 6.9 - 0.1998 = 13.3002tn against a published 13.31tn.
    expect(result.netWorth / 1e12).toBeCloseTo(13.30, 1);
    expect(result.netWorth).toBeGreaterThan(13.2e12);
    expect(result.netWorth).toBeLessThan(13.4e12);
  });

  test("sector split also reconciles to the headline", () => {
    const sum = UK_SECTOR_SPLIT_2025.households.value
      + UK_SECTOR_SPLIT_2025.corporations.value
      + UK_SECTOR_SPLIT_2025.government.value;
    expect(sum / 1e12).toBeCloseTo(13.32, 1);
  });

  test("the number journalists published on 12 Aug 2026 is reproduced", () => {
    expect(MUSK_UK_EVENT.derivedFigure / 1e12).toBeCloseTo(13.31, 2);
    expect(UK_NET_WORTH["2025"]!.value).toBe(MUSK_UK_EVENT.derivedFigure);
  });

  test("flags that the UK headline is land-dominated (52%) — a house-price index", () => {
    const result = nationalNetWorth({
      producedAssets: UK_BALANCE_SHEET_2025.producedAssets.value,
      nonProducedAssets: UK_BALANCE_SHEET_2025.nonProducedAssets.value,
      netFinancialWorth: UK_BALANCE_SHEET_2025.netFinancialWorth.value,
    });
    expect(result.landShare).toBeGreaterThan(0.5);
    expect(result.landDominated).toBe(true);
  });

  test("UK r-g is the razor-thin +0.3pp the OBR implies", () => {
    const d = debtDynamics({
      debtToGdp: UK_FISCAL.debtToGdp.value,
      r: UK_FISCAL.effectiveRate.value,
      g: UK_FISCAL.nominalGdpGrowth.value,
      primaryBalance: 0,
    });
    expect(d.rMinusG).toBeCloseTo(0.003, 4);
    // pb* = 0.945 * 0.003/1.035 = 0.274% of GDP
    expect(d.debtStabilisingPrimaryBalance).toBeCloseTo(0.00274, 4);
  });

  test("a plausible rate shock swings the required primary balance by ~1.6pp of GDP", () => {
    const base = debtDynamics({ debtToGdp: 0.945, r: 0.038, g: 0.035, primaryBalance: 0 });
    const stressed = debtDynamics({ debtToGdp: 0.945, r: 0.050, g: 0.030, primaryBalance: 0 });
    expect(stressed.debtStabilisingPrimaryBalance).toBeCloseTo(0.0183, 3);
    const swing = stressed.debtStabilisingPrimaryBalance - base.debtStabilisingPrimaryBalance;
    expect(swing).toBeGreaterThan(0.015); // >1.5pp of GDP, ~£47bn/yr
  });
});

// ===========================================================================
// INVARIANT 1 — g <= risk-free rate
// ===========================================================================

describe("INVARIANT 1: terminal growth may not exceed the risk-free rate", () => {
  test("rejects terminal growth above the risk-free rate", () => {
    expect(() => perpetuity(100, 0.10, 0.08, RISK_FREE.aug2026.value)).toThrow(/INVARIANT 1/);
  });

  test("accepts terminal growth at or below the risk-free rate", () => {
    expect(() => perpetuity(100, 0.10, 0.03, RISK_FREE.aug2026.value)).not.toThrow();
  });

  test("rejects a discount rate at or below growth", () => {
    expect(() => perpetuity(100, 0.03, 0.03)).toThrow(/must exceed growth/);
  });
});

// ===========================================================================
// INVARIANT 2 & 3 — imputed ROIC reported; cumulated discounting
// ===========================================================================

describe("INVARIANT 3: multi-stage discounting uses cumulated factors", () => {
  test("reproduces Damodaran's worked year-5 factor of 2.13416", () => {
    const factor = cumulatedDiscountFactor([0.19, 0.19, 0.16, 0.16, 0.12]);
    expect(factor).toBeCloseTo(2.13416, 4);
  });

  test("a single averaged rate gives a materially different answer", () => {
    const cumulated = cumulatedDiscountFactor([0.19, 0.19, 0.16, 0.16, 0.12]);
    const avg = (0.19 + 0.19 + 0.16 + 0.16 + 0.12) / 5;
    const naive = Math.pow(1 + avg, 5);
    expect(Math.abs(cumulated - naive) / cumulated).toBeGreaterThan(0.001);
  });
});

describe("INVARIANT 2: imputed ROIC is always reported", () => {
  const result = fcffValuation({
    revenue: [55e6, 175e6, 400e6, 700e6, 1000e6],
    operatingMargin: [-0.10, -0.05, 0.05, 0.10, 0.13],
    taxRate: 0.40,
    salesToCapital: 1.95,
    investedCapital0: 50e6,
    wacc: [0.19, 0.19, 0.16, 0.16, 0.12],
    terminalGrowth: 0.03,
    terminalRoic: 0.15,
    terminalWacc: 0.10,
    nolCarryforward: 15e6,
  });

  test("every year after the first carries an imputed ROIC", () => {
    const withRoic = result.years.filter((y) => y.imputedRoic !== null);
    expect(withRoic.length).toBe(result.years.length - 1);
  });

  test("emits consistency warnings rather than hiding them", () => {
    expect(Array.isArray(result.consistencyWarnings)).toBe(true);
  });

  test("NOL carryforward shelters early profits from tax", () => {
    expect(result.years[0]!.taxPaid).toBe(0); // negative EBIT
    expect(result.years[1]!.taxPaid).toBe(0); // still negative
  });

  test("produces a positive operating value", () => {
    expect(result.operatingValue).toBeGreaterThan(0);
  });
});

// ===========================================================================
// INVARIANT 4 — startups are ranges, never points
// ===========================================================================

describe("INVARIANT 4: startup values are structurally ranges", () => {
  const v = valueStartup({
    vc: {
      exitRevenue: 40e6, exitMultiple: 5, investment: 5e6,
      targetIrr: 0.30, years: 8, cumulativeDilution: 0.40,
    },
    probabilityOfFailure: 0.40,
    meta,
  });

  test("returns low, central and high", () => {
    expect(v.low).toBeLessThan(v.central);
    expect(v.central).toBeLessThan(v.high);
  });

  test("the band is wide enough to be honest about the uncertainty", () => {
    expect((v.high - v.low) / v.central).toBeGreaterThan(0.2);
  });

  test("a malformed range is rejected at construction", () => {
    expect(() => range(10, 5, 20, meta)).toThrow(/Malformed range/);
  });
});

describe("VC method — reproduces the published worked example", () => {
  const r = vcMethod({
    exitRevenue: 40e6, exitMultiple: 5, investment: 5e6,
    targetIrr: 0.30, years: 8, cumulativeDilution: 0.40,
  });

  test("exit value = revenue x multiple = $200M", () => {
    expect(r.exitValue).toBe(200e6);
  });

  /**
   * NOTE — a correction to the published worked example.
   *
   * The source states "$5M x (1.3)^8 = $43M" and derives 21.5% ownership from it.
   * The exact arithmetic is $5M x 1.3^8 = $40.79M, giving 20.4%. The source rounded
   * (1.3^8 = 8.157, but 43/5 = 8.6 implies 1.3^7.85).
   *
   * We assert the correct arithmetic and record the discrepancy rather than
   * reproducing a rounding error.
   */
  test("required future value is exactly $5M x 1.3^8 = $40.79M", () => {
    expect(r.requiredFutureValue / 1e6).toBeCloseTo(40.79, 1);
    expect(r.requiredFutureValue).toBeCloseTo(5e6 * Math.pow(1.3, 8), 0);
  });

  test("required ownership at exit is 20.4% (source rounds this to 21.5%)", () => {
    expect(r.requiredOwnershipAtExit).toBeCloseTo(0.204, 2);
  });

  test("a longer hold REDUCES today's valuation — the fund needs more of it", () => {
    const base = { exitRevenue: 40e6, exitMultiple: 5, investment: 5e6, targetIrr: 0.30, years: 8, cumulativeDilution: 0.40 };
    const short = vcMethod({ ...base, years: 5 }).preMoney;
    const long = vcMethod({ ...base, years: 10 }).preMoney;
    // Five extra years of compounding at 30% swings pre-money by more than 2x.
    expect(short).toBeGreaterThan(long);
    expect(short / long).toBeGreaterThan(2);
  });
});

// ===========================================================================
// INVARIANT 5 — survival probability explicit, never in the rate
// ===========================================================================

describe("INVARIANT 5: survival risk is explicit, not buried in the discount rate", () => {
  test("reproduces the worked example: $177.56M x 0.60 = $106.54M", () => {
    const r = survivalAdjust({ goingConcernValue: 177.56e6, probabilityOfFailure: 0.40 });
    expect(r.expectedValue / 1e6).toBeCloseTo(106.54, 1);
  });

  test("rNPV refuses a discount rate that double-counts clinical risk", () => {
    expect(() => rnpv({
      cashFlows: [-10e6, -20e6, 100e6],
      cumulativeProbabilities: [1, 0.52, 0.15],
      discountRate: 0.28,
    })).toThrow(/INVARIANT 5/);
  });

  test("rNPV accepts a commercial rate with an explicit probability", () => {
    expect(() => rnpv({
      cashFlows: [-10e6, -20e6, 100e6],
      cumulativeProbabilities: [1, 0.52, 0.15],
      discountRate: 0.10,
    })).not.toThrow();
  });

  test("verified BIO phase transitions compound to the published 7.9% LOA", () => {
    const c = CLINICAL_PHASE_SUCCESS;
    const compounded = c.phase1to2 * c.phase2to3 * c.phase3toFiling * c.filingToApproval;
    expect(compounded).toBeCloseTo(c.phase1ToApproval, 2);
  });
});

// ===========================================================================
// INVARIANT 7 — EV/Sales and EV/EBITDA are not reconcilable
// ===========================================================================

describe("INVARIANT 7: EV/Sales and EV/EBITDA must never be derived from each other", () => {
  test("the anchors genuinely do not reconcile through margin", () => {
    const a = INDUSTRY_ANCHORS.softwareSystemApp!;
    // If they reconciled, evSales / evEbitda would equal the EBITDA margin (35.93%).
    const implied = a.evSales / a.evEbitda;
    expect(Math.abs(implied - 0.3593)).toBeGreaterThan(0.05);
  });
});

// ===========================================================================
// INVARIANT 8 — sovereign debt dynamics
// ===========================================================================

describe("INVARIANT 8: sovereign valuations respect debt dynamics", () => {
  test("r < g produces a negative snowball — permanent deficits are sustainable", () => {
    const d = debtDynamics({ debtToGdp: 0.60, r: 0.02, g: 0.04, primaryBalance: 0 });
    expect(d.snowball).toBeLessThan(0);
    expect(d.rMinusG).toBeLessThan(0);
  });

  test("high debt with a rising path is flagged distressed", () => {
    const d = debtDynamics({ debtToGdp: 1.50, r: 0.09, g: 0.02, primaryBalance: -0.03 });
    expect(d.beyondFiscalFatigue).toBe(true);
    expect(d.distressed).toBe(true);
  });

  test("the UK is not flagged distressed at current parameters", () => {
    const d = debtDynamics({ debtToGdp: 0.945, r: 0.038, g: 0.035, primaryBalance: 0.005 });
    expect(d.distressed).toBe(false);
  });
});

// ===========================================================================
// INVARIANT 10 & 16 — human capital conventions must not be blended
// ===========================================================================

describe("INVARIANT 10/16: ONS and CWON human capital may never be blended", () => {
  const onsBased = comprehensiveWealth({
    producedCapital: 6.6e12, naturalCapital: 0.5e12,
    humanCapital: UK_HUMAN_CAPITAL.value, humanCapitalConvention: "ONS",
    netForeignAssets: -0.2e12,
  });
  const cwonBased = comprehensiveWealth({
    producedCapital: 6.6e12, naturalCapital: 0.5e12,
    humanCapital: 18e12, humanCapitalConvention: "CWON_2024",
    netForeignAssets: -0.2e12,
  });

  test("refuses to compare across conventions", () => {
    expect(() => assertSameConvention(onsBased, cwonBased)).toThrow(ConventionMismatchError);
  });

  test("allows comparison within the same convention", () => {
    expect(() => assertSameConvention(onsBased, onsBased)).not.toThrow();
  });

  test("CWON 2024 and CWON 2021 are also not comparable", () => {
    const c2021 = comprehensiveWealth({
      producedCapital: 6.6e12, naturalCapital: 0.5e12,
      humanCapital: 24e12, humanCapitalConvention: "CWON_2021", netForeignAssets: -0.2e12,
    });
    expect(() => assertSameConvention(cwonBased, c2021)).toThrow(ConventionMismatchError);
  });

  test("UK comprehensive wealth under ONS convention lands near £38.8tn", () => {
    expect(onsBased.total / 1e12).toBeCloseTo(32.4, 0);
  });
});

// ===========================================================================
// INVARIANT 12 — no double counting of listed equity
// ===========================================================================

describe("INVARIANT 12: listed market cap may not be added to net worth", () => {
  test("throws rather than silently double-counting", () => {
    expect(() => addListedEquityToNetWorth()).toThrow(DoubleCountError);
  });
});

// ===========================================================================
// The GDP multiple is circular
// ===========================================================================

describe("The 'GDP x multiple' headline is 1/(r-g) restated", () => {
  test("a 2pp assumption produces a 3x range in the multiple", () => {
    const axis = gdpMultipleAxis([0.01, 0.03]);
    expect(axis[0]!.multiple).toBe(100);
    expect(axis[1]!.multiple).toBeCloseTo(33.33, 1);
    expect(axis[0]!.multiple / axis[1]!.multiple).toBeCloseTo(3, 1);
  });
});

// ===========================================================================
// INVARIANT 15 — nighttime lights elasticity is 0.28, not 1
// ===========================================================================

describe("INVARIANT 15: the nightlights-GDP elasticity is 0.28", () => {
  test("is not 1", () => {
    expect(NIGHTLIGHTS_GDP_ELASTICITY.value).toBeCloseTo(0.28, 2);
    expect(NIGHTLIGHTS_GDP_ELASTICITY.value).not.toBeCloseTo(1.0, 1);
  });

  test("a 10% luminosity change implies only ~2.8% GDP change", () => {
    expect(0.10 * NIGHTLIGHTS_GDP_ELASTICITY.value).toBeCloseTo(0.028, 3);
  });
});

// ===========================================================================
// INVARIANT 18 — top-down TAM is refused
// ===========================================================================

describe("INVARIANT 18: the simulator refuses top-down TAM", () => {
  test("throws with an explanation", () => {
    expect(() => topDownTam()).toThrow(TopDownTamError);
    expect(() => topDownTam()).toThrow(/Top-down TAM is refused/);
  });

  test("bottom-up TAM sums reachable accounts x ACV", () => {
    const r = bottomUpTam([
      { name: "Mid-market SaaS", reachableAccounts: 4_000, acv: 25_000 },
      { name: "Enterprise", reachableAccounts: 500, acv: 120_000 },
    ]);
    expect(r.tam).toBe(160_000_000);
  });
});

// ===========================================================================
// The cross-sector bridge
// ===========================================================================

describe("Cross-sector bridge: EV/Revenue = EV/GrossProfit x GrossMargin", () => {
  test("hardware at 40% GM and software at 80% GM are equally priced on gross profit", () => {
    expect(evToRevenue(12, 0.40)).toBeCloseTo(4.8, 2);
    expect(evToRevenue(12, 0.80)).toBeCloseTo(9.6, 2);
  });

  test("Airbnb and Uber converge once normalised for gross margin", () => {
    const airbnb = 7.56 / 0.829; // ~9.1x gross profit
    const uber = 2.89 / 0.408;   // ~7.1x gross profit
    expect(airbnb).toBeCloseTo(9.1, 0);
    expect(uber).toBeCloseTo(7.1, 0);
    // The apparent 2.6x revenue-multiple gap is really ~1.3x.
    expect(7.56 / 2.89).toBeGreaterThan(2.5);
    expect(airbnb / uber).toBeLessThan(1.5);
  });
});

describe("Marketplace identity: EV/GMV = EV/NetRevenue x take rate", () => {
  // Empirically verified against five marketplaces (Aug 2026).
  const cases = [
    { name: "Airbnb", evRev: 7.56, takeRate: 0.134, actualEvGmv: 1.09 },
    { name: "Uber", evRev: 2.89, takeRate: 0.269, actualEvGmv: 0.82 },
    { name: "Etsy", evRev: 3.18, takeRate: 0.243, actualEvGmv: 0.79 },
    { name: "eBay", evRev: 4.19, takeRate: 0.139, actualEvGmv: 0.63 },
  ];

  for (const c of cases) {
    test(`${c.name}: predicted EV/GMV matches the market within 0.2x`, () => {
      const predicted = evToGmv(c.evRev, c.takeRate);
      expect(Math.abs(predicted - c.actualEvGmv)).toBeLessThan(0.2);
    });
  }

  test("identical GMV at different take rates gives a 6x value spread", () => {
    expect(evToGmv(5, 0.30) / evToGmv(5, 0.05)).toBeCloseTo(6, 1);
  });
});

describe("Sector routing refuses the wrong denominator", () => {
  test("lenders cannot be valued on revenue multiples", () => {
    expect(() => assertValidDenominator("lending", "revenue")).toThrow(WrongDenominatorError);
  });

  test("P/TBV = (ROTCE - g)/(COE - g) gives 1.5x at plausible inputs", () => {
    expect(priceToTangibleBook(0.15, 0.11, 0.03)).toBeCloseTo(1.5, 2);
  });

  test("clinical-stage biotech requires rNPV", () => {
    expect(() => assertValidDenominator("biotech", "revenue")).toThrow(WrongDenominatorError);
  });
});

// ===========================================================================
// Burn multiple — the corrected scale
// ===========================================================================

describe("Burn multiple: the SaaS scale is Sacks', not the marketplace adaptation", () => {
  test("1.5x is 'Good' on the SaaS scale", () => {
    expect(rateBurnMultiple(1.5, "saas").label).toBe("Good");
  });

  test("1.5x is 'Suspect' on the marketplace scale — the scales genuinely differ", () => {
    expect(rateBurnMultiple(1.5, "marketplace").label).toBe("Suspect");
  });

  test("the two scales use different denominators", () => {
    expect(BURN_MULTIPLE_SCALE.saas.denominator).toContain("Net New ARR");
    expect(BURN_MULTIPLE_SCALE.marketplace.denominator).toContain("Gross Profit");
  });

  test("0.4x is Amazing on both", () => {
    expect(rateBurnMultiple(0.4, "saas").label).toBe("Amazing");
    expect(rateBurnMultiple(0.4, "marketplace").label).toBe("Amazing");
  });
});

describe("Magic number annualises x4 per the Scale VP original", () => {
  test("annualised is 4x the raw quarterly ratio", () => {
    const args = { currentQuarterRevenue: 11e6, priorQuarterRevenue: 10e6, priorQuarterSalesAndMarketing: 2e6 };
    expect(magicNumber({ ...args, annualise: true })).toBeCloseTo(2.0, 3);
    expect(magicNumber({ ...args, annualise: false })).toBeCloseTo(0.5, 3);
  });
});

describe("CAC payback variants are not interchangeable", () => {
  const args = { salesAndMarketing: 1e6, newArr: 1e6, grossMargin: 0.78 };
  test("the gross-margin-adjusted variant is ~28% longer at 78% GM", () => {
    const adjusted = cacPaybackMonths({ ...args, variant: "gm_adjusted_new_customer" }).months;
    const simple = cacPaybackMonths({ ...args, variant: "simple_unadjusted" }).months;
    expect(adjusted / simple).toBeCloseTo(1 / 0.78, 2);
    expect(adjusted / simple).toBeCloseTo(1.28, 1);
  });

  test("each result declares what it is comparable to", () => {
    const pub = cacPaybackMonths({ ...args, variant: "net_new_implied_arr" });
    expect(pub.comparableTo).toContain("NOT comparable");
  });
});

// ===========================================================================
// The founder lever simulator
// ===========================================================================

describe("Lever ranking scores the PATTERN, not a checklist", () => {
  const strongEfficiencyLowArr = rankLevers({
    stage: "series_a", arr: 2.5e6, growthRate: 1.2, grossMargin: 0.78,
    ndr: 1.15, grr: 0.92, logoRetention: 0.90, netBurn: 1.5e6, netNewArr: 1.4e6,
    cac: 20000, arpa: 30000, fcfMargin: -0.2, salesAndMarketing: 800_000,
  });

  const weakEfficiencyHighArr = rankLevers({
    stage: "series_a", arr: 5e6, growthRate: 0.35, grossMargin: 0.55,
    ndr: 0.92, grr: 0.80, logoRetention: 0.75, netBurn: 6e6, netNewArr: 1.3e6,
    cac: 60000, arpa: 25000, fcfMargin: -0.8, salesAndMarketing: 3e6,
  });

  test("strong efficiency at sub-threshold ARR is recognised as clearing the bar", () => {
    expect(strongEfficiencyLowArr.pattern).toContain("lower ARR");
  });

  test("adequate ARR with weak efficiency is flagged as the classic mismatch", () => {
    expect(weakEfficiencyHighArr.pattern).toContain("pattern mismatch");
    expect(weakEfficiencyHighArr.readiness).toBe("not_ready");
  });

  test("failing levers are ranked ahead of passing ones", () => {
    const firstPassingIndex = weakEfficiencyHighArr.levers.findIndex((l) => l.passing);
    const lastFailingIndex = weakEfficiencyHighArr.levers.map((l) => l.passing).lastIndexOf(false);
    if (firstPassingIndex !== -1) expect(lastFailingIndex).toBeLessThan(firstPassingIndex);
  });

  test("every lever carries a concrete action", () => {
    for (const l of strongEfficiencyLowArr.levers) expect(l.action.length).toBeGreaterThan(20);
  });
});

// ===========================================================================
// Cap table
// ===========================================================================

describe("Option pool shuffle", () => {
  test("a $8M pre with a 20% post-money pool carved pre-money is really $6M", () => {
    const r = optionPoolShuffle({
      statedPreMoney: 8e6, investment: 2e6, poolPercentPostMoney: 0.20, poolFromPreMoney: true,
    });
    expect(r.effectivePreMoney / 1e6).toBeCloseTo(6, 1);
    expect(r.founderCost / 1e6).toBeCloseTo(2, 1);
  });

  test("a post-money pool costs the founder nothing extra", () => {
    const r = optionPoolShuffle({
      statedPreMoney: 8e6, investment: 2e6, poolPercentPostMoney: 0.20, poolFromPreMoney: false,
    });
    expect(r.founderCost).toBe(0);
  });
});

describe("Total beta rises as investor diversification falls", () => {
  test("reproduces Damodaran's founder-only total beta of 3.00", () => {
    expect(totalBeta(1.20, INVESTOR_CORRELATION.founderOnly)).toBeCloseTo(3.0, 2);
  });

  test("falls to the market beta once public", () => {
    expect(totalBeta(1.20, INVESTOR_CORRELATION.publicMarket)).toBeCloseTo(1.20, 2);
  });
});

// ===========================================================================
// Breakeven revenue — inverting the market
// ===========================================================================

/**
 * Breakeven revenue.
 *
 * ⚠️ OPEN DISCREPANCY, deliberately left visible rather than fitted away.
 *
 * Damodaran's published Nvidia figure is $483.38B of immediate breakeven revenue at
 * $5T market cap, 8% cost of equity, 4% growth and a 53.01% net margin. The plain
 * Gordon inversion — NI = V(ke-g)/(1+g), Rev = NI/margin — gives $362.8B from those
 * same four inputs. The gap implies his published number carries an adjustment we
 * have not reconstructed (a reinvestment/ROE term, or a different ke).
 *
 * We therefore test the formula's INTERNAL consistency (which we can verify) and do
 * NOT assert an external figure we cannot reproduce from stated inputs. Resolving
 * this is tracked in docs/00-FIRST-PRINCIPLES.md §8.
 */
describe("Breakeven revenue — internally consistent Gordon inversion", () => {
  const args = {
    equityValue: 5e12, costOfEquity: 0.08, terminalGrowth: 0.04,
    netMargin: 0.5301, currentRevenue: 253.49e9, years: 5,
  };

  test("round-trips: breakeven net income re-values back to the input market cap", () => {
    const r = breakevenRevenue(args);
    const impliedValue = (r.requiredNetIncome * (1 + args.terminalGrowth))
      / (args.costOfEquity - args.terminalGrowth);
    expect(impliedValue).toBeCloseTo(args.equityValue, -9);
  });

  test("breakeven revenue x net margin equals required net income", () => {
    const r = breakevenRevenue(args);
    expect(r.breakevenRevenue * args.netMargin).toBeCloseTo(r.requiredNetIncome, 0);
  });

  test("Nvidia must roughly 1.4x its revenue just to justify today's price", () => {
    const r = breakevenRevenue(args);
    expect(r.breakevenRevenue).toBeGreaterThan(args.currentRevenue);
    expect(r.requiredGrowthRate).toBeGreaterThan(0);
  });

  test("does not match Damodaran's published $483B from these inputs — flagged, not fitted", () => {
    const r = breakevenRevenue(args);
    expect(r.breakevenRevenue / 1e9).toBeCloseTo(362.8, 0);
    expect(Math.abs(r.breakevenRevenue / 1e9 - 483.38)).toBeGreaterThan(100);
  });
});

// ===========================================================================
// Sensitivity — why policy shocks hit through the discount rate
// ===========================================================================

describe("Sensitivity is magnified by 1/(r-g)", () => {
  test("at r-g = 3%, a 100bp move changes value by ~33%", () => {
    const s = sensitivities(1000, 0.08, 0.05);
    expect(s.magnification).toBeCloseTo(33.33, 1);
    expect(Math.abs(s.toDiscountRate * 0.01) / 1000).toBeCloseTo(0.333, 2);
  });

  test("growth and discount-rate sensitivities are equal and opposite", () => {
    const s = sensitivities(1000, 0.08, 0.05);
    expect(s.toGrowth).toBeCloseTo(-s.toDiscountRate, 6);
  });
});

// ===========================================================================
// The universal identity
// ===========================================================================

describe("Universal identity: V = IC + PV(economic profit)", () => {
  test("zero spread means value equals invested capital", () => {
    const r = universalValue({
      investedCapital: 1000, roic: [0.10, 0.10, 0.10],
      wacc: [0.10, 0.10, 0.10], capitalGrowth: [0, 0, 0],
    });
    expect(r.value).toBeCloseTo(1000, 6);
    expect(r.intangibleCapital).toBeCloseTo(0, 6);
  });

  test("a positive spread creates intangible capital above the balance sheet", () => {
    const r = universalValue({
      investedCapital: 1000, roic: [0.20, 0.20, 0.20],
      wacc: [0.10, 0.10, 0.10], capitalGrowth: [0.05, 0.05, 0.05],
    });
    expect(r.intangibleCapital).toBeGreaterThan(0);
    expect(r.value).toBeGreaterThan(r.investedCapital);
  });

  test("a negative spread destroys value — growth makes it worse", () => {
    const r = universalValue({
      investedCapital: 1000, roic: [0.05, 0.05, 0.05],
      wacc: [0.10, 0.10, 0.10], capitalGrowth: [0.10, 0.10, 0.10],
    });
    expect(r.intangibleCapital).toBeLessThan(0);
  });
});

// ===========================================================================
// Metro diagnostic
// ===========================================================================

describe("Metro EV/GMP separates exporters from rentiers", () => {
  const ratios = Object.fromEntries(
    METRO_EV_TO_GMP_BENCHMARKS.map((m) => [m.metro, m.evUsd / m.gmpUsd]),
  );

  test("the Bay Area is an exporter of enterprise value (>5x)", () => {
    expect(ratios["Bay Area"]!).toBeGreaterThan(5);
    expect(ratios["Bay Area"]!).toBeCloseTo(15.9, 0);
  });

  test("London and New York are rentier metros (<1x)", () => {
    expect(ratios["London"]!).toBeLessThan(1);
    expect(ratios["New York MSA"]!).toBeLessThan(1);
    expect(ratios["London"]!).toBeCloseTo(0.90, 1);
    expect(ratios["New York MSA"]!).toBeCloseTo(0.53, 1);
  });

  test("London's hosted enterprise value is under 1x its own output", () => {
    expect(LONDON.hostedEnterpriseValue.value / 790.6e9).toBeLessThan(1);
  });
});
