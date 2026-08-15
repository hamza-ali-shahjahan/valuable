/**
 * The event corpus — INVARIANT 19 and the honesty guarantees around it.
 *
 * The point of these tests: a weak claim must be structurally incapable of
 * masquerading as a strong one.
 */

import { describe, test, expect } from "bun:test";

import {
  effectSize, effectSizeOrNull, OverclaimError, HAS_COUNTERFACTUAL,
  assertIdentificationStated, REFUTED_FIGURES,
  type MeasuredEffect, type NarrativeClaim,
} from "./events.ts";
import { UK_EVENTS, UK_LEADERS, NARRATIVE_ONLY_EXAMPLES } from "../data/uk-events.ts";

const meta = { asOf: "2026-08-14", source: "test" };

describe("INVARIANT 19: a narrative claim can never be rendered as a measured effect", () => {
  const narrative: NarrativeClaim = {
    kind: "narrative", direction: "increase",
    mechanism: "Leader X's reforms drove growth",
    whyNotIdentified: "No counterfactual exists at national level.",
    citation: "Commentary", ...meta,
  };

  test("asking a narrative claim for an effect size throws", () => {
    expect(() => effectSize(narrative)).toThrow(OverclaimError);
    expect(() => effectSize(narrative)).toThrow(/no.*counterfactual/i);
  });

  test("the safe accessor returns null rather than a number", () => {
    expect(effectSizeOrNull(narrative)).toBeNull();
  });

  test("a narrative claim has no estimate field at all — enforced by the type", () => {
    expect("estimate" in narrative).toBe(false);
  });

  test("an official assumption is not an estimate, even from an authoritative body", () => {
    const obr = UK_EVENTS
      .find((e) => e.id === "gbr-2016-06-23-eu-referendum")!
      .claims.find((c) => c.citation.includes("OBR"))!;
    expect(obr.kind).toBe("narrative");
    expect(effectSizeOrNull(obr)).toBeNull();
  });

  test("official_assumption is registered as having no counterfactual", () => {
    expect(HAS_COUNTERFACTUAL.official_assumption).toBe(false);
    expect(HAS_COUNTERFACTUAL.synthetic_control).toBe(true);
  });
});

describe("A measured effect must state what its design exploits", () => {
  test("a thin identification string is rejected", () => {
    const thin: MeasuredEffect = {
      kind: "measured", strategy: "synthetic_control", identification: "synthetic control",
      metric: "GDP", estimate: -0.05, unit: "fraction_of_gdp", citation: "X", ...meta,
    };
    expect(() => assertIdentificationStated(thin)).toThrow(OverclaimError);
  });

  test("every measured claim in the UK corpus states its identification in substance", () => {
    const measured = UK_EVENTS.flatMap((e) => e.claims).filter((c) => c.kind === "measured");
    expect(measured.length).toBeGreaterThan(3);
    for (const c of measured) expect(() => assertIdentificationStated(c)).not.toThrow();
  });

  test("every measured claim carries a citation", () => {
    for (const c of UK_EVENTS.flatMap((e) => e.claims)) {
      expect(c.citation.length).toBeGreaterThan(5);
    }
  });

  test("every narrative claim explains why it is not identified", () => {
    const narrative = UK_EVENTS.flatMap((e) => e.claims).filter((c) => c.kind === "narrative");
    expect(narrative.length).toBeGreaterThan(0);
    for (const c of narrative) expect(c.whyNotIdentified.length).toBeGreaterThan(30);
  });
});

describe("The Brexit corpus reproduces the published estimates", () => {
  const brexit = UK_EVENTS.find((e) => e.id === "gbr-2016-06-23-eu-referendum")!;

  test("Born et al. synthetic control: −2.4% of GDP by end-2018, p = 0.05", () => {
    const c = brexit.claims.find((x) => x.citation.includes("Born"))! as MeasuredEffect;
    expect(effectSize(c)).toBeCloseTo(-0.024, 3);
    expect(c.inference).toContain("0.05");
    expect(c.strategy).toBe("synthetic_control");
  });

  test("CER doppelgänger is larger because the window includes the TCA period", () => {
    const born = brexit.claims.find((x) => x.citation.includes("Born"))! as MeasuredEffect;
    const cer = brexit.claims.find((x) => x.citation.includes("Springford"))! as MeasuredEffect;
    expect(Math.abs(effectSize(cer))).toBeGreaterThan(Math.abs(effectSize(born)));
  });

  test("the trade break is at the TCA, not the vote — no anticipation effect", () => {
    const c = brexit.claims.find((x) => x.citation.includes("Freeman"))! as MeasuredEffect;
    expect(effectSize(c)).toBeCloseTo(-0.25, 2);
    expect(c.identification).toContain("No significant anticipation effect");
  });

  test("FDI is recorded at 16–20%, and the refuted −37% is flagged in the note", () => {
    const c = brexit.claims.find((x) => x.citation.includes("Serwicka"))! as MeasuredEffect;
    expect(effectSize(c)).toBeCloseTo(-0.18, 2);
    expect(c.low).toBe(-0.20);
    expect(c.high).toBe(-0.16);
    expect(c.inference).toContain("37");
  });

  test("sterling fell 7.85% in a single session — a discount-rate shock, not a cash-flow one", () => {
    const fx = brexit.marketResponses!.find((m) => m.instrument === "GBP/USD")!;
    const move = (fx.after - fx.before) / fx.before;
    expect(move).toBeCloseTo(-0.0785, 3);
  });

  test("the FTSE 100 / FTSE 250 split shows the domestic-exposure divergence", () => {
    const ftse250 = brexit.marketResponses!.find((m) => m.instrument === "FTSE 250")!;
    expect((ftse250.after - ftse250.before) / ftse250.before).toBeCloseTo(-0.14, 2);
  });
});

describe("The mini-budget is the product's thesis in one event", () => {
  const mb = UK_EVENTS.find((e) => e.id === "gbr-2022-09-23-mini-budget")!;

  test("is recorded as narrative — the market move is observed, the counterfactual is not", () => {
    expect(mb.claims[0]!.kind).toBe("narrative");
    expect(effectSizeOrNull(mb.claims[0]!)).toBeNull();
  });

  test("names the discount-rate mechanism explicitly", () => {
    const c = mb.claims[0]! as NarrativeClaim;
    expect(c.mechanism).toContain("discount-rate");
    expect(c.mechanism).toContain("productive capacity was unchanged");
  });

  test("sterling and gilts both moved hard within days", () => {
    const fx = mb.marketResponses!.find((m) => m.instrument === "GBP/USD")!;
    expect((fx.after - fx.before) / fx.before).toBeLessThan(-0.04);
    const gilt = mb.marketResponses!.find((m) => m.instrument.includes("gilt"))!;
    expect(gilt.after).toBeGreaterThan(gilt.before);
  });
});

describe("Leadership series", () => {
  test("covers 2010 to present with exactly one incumbent", () => {
    expect(UK_LEADERS.filter((l) => l.to === null).length).toBe(1);
    expect(UK_LEADERS.find((l) => l.to === null)!.name).toBe("Keir Starmer");
  });

  test("is contiguous — each leader starts when the last one ends", () => {
    for (let i = 1; i < UK_LEADERS.length; i++) {
      const previousEnd = UK_LEADERS[i - 1]!.to;
      // Only the incumbent may have a null end date, and they are last.
      expect(previousEnd).not.toBeNull();
      expect(UK_LEADERS[i]!.from).toBe(previousEnd!);
    }
  });

  test("records the 49-day premiership", () => {
    const truss = UK_LEADERS.find((l) => l.name === "Liz Truss")!;
    const days = (Date.parse(truss.to!) - Date.parse(truss.from)) / 86_400_000;
    expect(days).toBe(49);
  });

  test("every event is attributed to the leader in office on that date", () => {
    for (const e of UK_EVENTS) {
      if (!e.leader) continue;
      const l = UK_LEADERS.find((x) => x.name === e.leader)!;
      expect(l).toBeDefined();
      expect(e.date >= l.from).toBe(true);
      if (l.to) expect(e.date <= l.to).toBe(true);
    }
  });
});

describe("Refuted figures are encoded so they cannot creep back in", () => {
  test("the list is populated and each entry carries a correction", () => {
    expect(REFUTED_FIGURES.length).toBeGreaterThanOrEqual(8);
    for (const r of REFUTED_FIGURES) {
      expect(r.correction.length).toBeGreaterThan(10);
      expect(r.note.length).toBeGreaterThan(10);
    }
  });

  test("includes the Brexit FDI figure that has no traceable source", () => {
    expect(REFUTED_FIGURES.some((r) => r.claim.includes("37%"))).toBe(true);
  });

  test("includes the Estonia claim its own primary source has dropped", () => {
    const e = REFUTED_FIGURES.find((r) => r.claim.includes("Estonia"))!;
    expect(e.correction).toContain("Absent from every current primary page");
  });

  test("no refuted figure appears as a live estimate in the corpus", () => {
    const estimates = UK_EVENTS.flatMap((e) => e.claims)
      .filter((c): c is MeasuredEffect => c.kind === "measured")
      .map((c) => c.estimate);
    expect(estimates).not.toContain(-0.37);
  });
});

describe("Narrative-only episodes carry their contestation", () => {
  test("Rwanda is stored with its disputes, not as a clean success story", () => {
    const r = NARRATIVE_ONLY_EXAMPLES.find((x) => x.iso3 === "RWA")!;
    expect(r.contestation.length).toBeGreaterThanOrEqual(4);
    expect(r.contestation.some((c) => c.includes("poverty ROSE"))).toBe(true);
    expect(r.contestation.some((c) => c.includes("Doing Business"))).toBe(true);
  });

  test("Singapore carries the unreconciled TFP debate", () => {
    const s = NARRATIVE_ONLY_EXAMPLES.find((x) => x.iso3 === "SGP")!;
    expect(s.whyNotIdentified).toContain("N=1");
    expect(s.contestation.some((c) => c.includes("Young"))).toBe(true);
    expect(s.contestation.some((c) => c.includes("Hsieh"))).toBe(true);
  });
});
