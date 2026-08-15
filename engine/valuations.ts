/**
 * The publishable layer: valuations that carry their complete working.
 *
 * Separation of concerns, deliberately:
 *   engine/country.ts   — pure maths, unit-tested in isolation (105 tests)
 *   engine/valuations.ts — composes that maths with provenance into something publishable
 *
 * The pure functions stay pure and their tests stay untouched. Nothing here re-implements
 * a formula; it records which formula ran, on what inputs, and why.
 *
 * EVERY formula, input and step carries plain English. The promise is that anyone can
 * check these numbers — if only an economist can read them, that promise is a lie.
 * Plain text is not hashed (see engine/trace.ts): the maths is pinned, the wording can
 * keep improving.
 */

import {
  trace, observed, assumption, derived, step, assertPublishable, formatValue,
  type Traced, type TraceNode,
} from "./trace.ts";
import { nationalNetWorth, debtDynamics, CLAIM_QUESTION, type CountryClaim } from "./country.ts";
import {
  UK_BALANCE_SHEET_2025, UK_HUMAN_CAPITAL, UK_FISCAL, UK_POPULATION, UK_LISTED_EQUITY,
  type Datum,
} from "../data/uk.ts";

const FP = "docs/00-FIRST-PRINCIPLES.md";

/** Turn a sourced datum into an observed node, with a plain-English description. */
const fromDatum = (label: string, d: Datum, plain?: string): TraceNode =>
  observed(label, d.value, {
    unit: d.unit, asOf: d.asOf, source: d.source,
    ...(d.sourceUrl ? { url: d.sourceUrl } : {}),
    ...(d.needsVerification ? { needsVerification: true } : {}),
    ...(plain ? { plain } : {}),
  });

/** Readable arithmetic. "£6.60tn + £6.90tn = £13.50tn" beats "6.6000e+12 + 6.9000e+12". */
const sum = (parts: readonly number[], total: number, unit: string): string =>
  `${parts.map((p) => formatValue(p, unit)).join(" + ")} = ${formatValue(total, unit)}`;

// ---------------------------------------------------------------------------
// Claim 1 — National net worth (the balance-sheet lens)
// ---------------------------------------------------------------------------

export const ukNetWorth = (): Traced<number> => {
  const p = UK_BALANCE_SHEET_2025.producedAssets;
  const np = UK_BALANCE_SHEET_2025.nonProducedAssets;
  const nfw = UK_BALANCE_SHEET_2025.netFinancialWorth;

  const result = nationalNetWorth({
    producedAssets: p.value,
    nonProducedAssets: np.value,
    netFinancialWorth: nfw.value,
  });

  const warnings: string[] = [];
  if (result.landDominated) {
    warnings.push(
      `Land is ${(result.landShare * 100).toFixed(0)}% of this figure. That means the ` +
      `total mostly tracks house prices: it fell 2.0% in 2023 and rose 5.6% in 2024 ` +
      `almost entirely because property prices moved, not because Britain built or ` +
      `lost anything.`,
    );
  }

  return trace({
    formula: "NW = K_produced + K_non-produced + NFW",
    plain:
      "Add up everything the country owns — what's been built, plus the land it sits " +
      "on — then subtract what Britain owes the rest of the world.",
    meaning:
      "This is the number journalists reach for. It counts buildings, land and financial " +
      "assets, but it does not count people — which is why the next answer is nearly " +
      "three times larger. Almost none of it is cash anyone could spend.",
    ref: `${FP} §2.1`,
    question: CLAIM_QUESTION.national_net_worth,
    unit: "GBP",
    inputs: [
      fromDatum("Produced assets", p,
        "Everything Britain has built: homes, offices, factories, roads, railways, " +
        "machinery, aircraft."),
      fromDatum("Non-produced assets (predominantly land)", np,
        "The ground itself, and what's under it — not the buildings on top. In Britain " +
        "this is mostly the land beneath housing, which is why house prices move the total."),
      fromDatum("Net financial worth", nfw,
        "What Britain owns abroad minus what the world owns in Britain. It's negative, " +
        "so on balance we owe more than we're owed."),
    ],
    steps: [
      step("Add produced and non-produced assets",
           sum([p.value, np.value], p.value + np.value, "GBP"),
           p.value + np.value,
           "Everything built, plus the land underneath it."),
      step("Add net financial worth",
           `${formatValue(p.value + np.value, "GBP")} − ${formatValue(Math.abs(nfw.value), "GBP")} = ${formatValue(result.netWorth, "GBP")}`,
           result.netWorth,
           "Then subtract what we owe the rest of the world, on balance."),
    ],
    warnings,
    value: result.netWorth,
  });
};

// ---------------------------------------------------------------------------
// Claim 2 — Comprehensive wealth (adds people)
// ---------------------------------------------------------------------------

/**
 * INVARIANT 10 is honoured structurally here: the human-capital figure is ONS-convention
 * and the assumption node says so, so a CWON figure can never be silently swapped in.
 */
export const ukComprehensiveWealth = (): Traced<number> => {
  const nw = ukNetWorth();
  const hc = UK_HUMAN_CAPITAL;
  const total = nw.value + hc.value;

  return trace({
    formula: "W = NW + K_human",
    plain:
      "Take everything the country owns, then add what its people are worth — the " +
      "earnings everyone in work will bring in over the rest of their careers.",
    meaning:
      "People are the biggest thing Britain has, by a wide margin: they are worth nearly " +
      "twice all the land and buildings combined. This is also the least certain number " +
      "on the page, because valuing future earnings means guessing how much tomorrow's " +
      "money is worth today.",
    ref: `${FP} §2.2`,
    question: CLAIM_QUESTION.comprehensive_wealth,
    unit: "GBP",
    inputs: [
      derived("National net worth", nw),
      fromDatum("Human capital stock", hc,
        "What Britain's workers will earn over the rest of their working lives, in " +
        "today's money. Everyone aged 16 to 65, in work or looking for work — about " +
        "£606,000 each."),
      assumption(
        "Human-capital convention: ONS",
        0.035,
        "ratio",
        "ONS computes human capital at a 3.5% discount rate WITH 2% labour productivity " +
        "growth (effective net discount ~1.5%), ages 16-65. World Bank CWON 2024 uses 4% " +
        "with ZERO growth, ages 15-65. The two are not interchangeable and must never be " +
        "blended (INVARIANT 10). This figure is on the ONS convention throughout.",
        `${FP} §2.2`,
        "£1 earned in 30 years is worth less than £1 today, and this is the rate we " +
        "shrink it by — 3.5% a year. It is a judgement, not a measurement. Nudge it by " +
        "one percentage point and this whole answer moves by about a quarter.",
      ),
    ],
    steps: [
      step("Add human capital to the balance sheet",
           sum([nw.value, hc.value], total, "GBP"), total,
           "What the country owns, plus what its people will earn."),
    ],
    warnings: [
      "This is the least certain figure here. Human capital moves almost one-for-one " +
      "with the discount rate: shift that rate by a single percentage point and the " +
      "answer moves roughly 25-30% — far more than it changes from one year to the next. " +
      "Treat it as an order of magnitude, not a precise total.",
      "The two halves are from different years. The people figure is from 2022; the " +
      "assets figure is from 2025. Each input shows its own date.",
    ],
    value: total,
  });
};

// ---------------------------------------------------------------------------
// The master variable — r − g
// ---------------------------------------------------------------------------

export const ukRMinusG = (): Traced<number> => {
  const d = UK_FISCAL.debtToGdp;
  const r = UK_FISCAL.effectiveRate;
  const g = UK_FISCAL.nominalGdpGrowth;
  const dyn = debtDynamics({
    debtToGdp: d.value, r: r.value, g: g.value, primaryBalance: 0,
  });

  const pbPct = (dyn.debtStabilisingPrimaryBalance * 100).toFixed(2);

  return trace({
    formula: "r − g",
    plain:
      "The gap between what the government pays to borrow and how fast the economy " +
      "grows. If borrowing costs more than the economy grows, debt climbs on its own.",
    meaning:
      `Right now Britain pays about ${(r.value * 100).toFixed(1)}% on its debt while the ` +
      `economy grows about ${(g.value * 100).toFixed(1)}% — a gap of just ` +
      `${(dyn.rMinusG * 100).toFixed(1)}%. Small, but it means the government needs a ` +
      `surplus of ${pbPct}% of everything the country earns simply to stop debt rising. ` +
      `This one gap is the most important number on the page.`,
    ref: `${FP} §2.3`,
    question:
      "What is the master variable? It sets the multiple 1/(r−g), the debt snowball, " +
      "and the debt-stabilising primary balance simultaneously.",
    unit: "pp",
    inputs: [
      fromDatum("Effective nominal interest rate on debt", r,
        "The average rate Britain actually pays on the money it has borrowed."),
      fromDatum("Nominal GDP growth", g,
        "How fast the economy is growing in cash terms, before adjusting for inflation."),
      fromDatum("Public sector net debt (% GDP)", d,
        "Total government debt, measured against a year of national income. At 94.5%, " +
        "Britain owes nearly one full year of everything it earns."),
    ],
    steps: [
      step("Subtract growth from the borrowing rate",
           `${(r.value * 100).toFixed(1)}% − ${(g.value * 100).toFixed(1)}% = ${(dyn.rMinusG * 100).toFixed(1)}%`,
           dyn.rMinusG,
           "Borrowing costs slightly more than the economy grows."),
      step("Work out the surplus needed to hold debt flat",
           `${(d.value * 100).toFixed(1)}% × ${(dyn.rMinusG * 100).toFixed(1)}% ÷ ${(1 + g.value).toFixed(3)} = ${pbPct}%`,
           dyn.debtStabilisingPrimaryBalance,
           `Because debt is that large, even a tiny gap means the government must run a ` +
           `${pbPct}% surplus just to stand still.`),
    ],
    warnings: [
      `The gap is only ${(dyn.rMinusG * 100).toFixed(1)}%, and that is what makes it ` +
      `dangerous. If borrowing got more expensive — 5% instead of ` +
      `${(r.value * 100).toFixed(1)}% — while growth slowed to 3%, the surplus needed ` +
      `to hold debt flat would jump from ${pbPct}% to 1.83%. That is roughly £50 billion ` +
      `a year, from a rate move that happens routinely.`,
      ...(dyn.distressed ? ["Debt dynamics are distressed (INVARIANT 8)."] : []),
      ...(dyn.beyondFiscalFatigue
        ? ["Debt is above the level — roughly one year of national income — where governments historically start struggling to raise taxes further (Ghosh et al. 2013)."]
        : []),
    ],
    value: dyn.rMinusG,
  });
};

// ---------------------------------------------------------------------------
// Per capita — the mandatory denominator (§6)
// ---------------------------------------------------------------------------

export const ukNetWorthPerCapita = (): Traced<number> => {
  const nw = ukNetWorth();
  const pop = UK_POPULATION;
  const perCapita = nw.value / pop.value;

  return trace({
    formula: "NW per capita = NW / population",
    plain: "Divide everything the country owns by the number of people living in it.",
    meaning:
      "A useful way to feel the size of the number — but not money anyone can access. " +
      "Most of it is the land under homes people already live in.",
    ref: `${FP} §6`,
    question: "What is that per person?",
    unit: "GBP",
    inputs: [
      derived("National net worth", nw),
      fromDatum("Population", pop, "How many people live in the UK."),
    ],
    steps: [
      step("Divide net worth by population",
           `${formatValue(nw.value, "GBP")} ÷ ${formatValue(pop.value, "people")} people = ${formatValue(perCapita, "GBP")}`,
           perCapita,
           "Everything the country owns, shared out per person."),
    ],
    value: perCapita,
  });
};

// ---------------------------------------------------------------------------
// Listed equity — signal only (INVARIANT 12)
// ---------------------------------------------------------------------------

export const ukListedEquity = (): Traced<number> =>
  trace({
    formula: "MC_listed (signal only — never summed into net worth)",
    plain:
      "What the stock market says every company listed in London is worth, added up.",
    meaning:
      "We show this but never add it to the totals above — those companies are already " +
      "counted inside the national balance sheet, so adding them again would count them " +
      "twice. It is also a poor guide to the British economy: most of the FTSE's earnings " +
      "come from abroad.",
    ref: `${FP} §2.4`,
    question: CLAIM_QUESTION.listed_equity,
    unit: "GBP",
    inputs: [
      fromDatum("FTSE All-Share market capitalisation", UK_LISTED_EQUITY,
        "The combined stock-market value of every company listed on the London exchange."),
    ],
    steps: [],
    warnings: [
      "Never add this to the answers above. These companies are already counted in the " +
      "national balance sheet — as business assets, and again in the pensions and savings " +
      "households hold. Adding their market value on top would count the same thing twice.",
      "It also measures the wrong thing. The London market is dominated by miners, banks, " +
      "energy and drug companies that earn most of their money overseas. It tells you " +
      "about companies listed in Britain, not about Britain.",
    ],
    value: UK_LISTED_EQUITY.value,
  });

// ---------------------------------------------------------------------------
// The composite — three numbers, never one (§2.6)
// ---------------------------------------------------------------------------

export interface ClaimView {
  readonly claim: CountryClaim;
  readonly question: string;
  readonly traced: Traced<number>;
  readonly publishable: boolean;
  readonly blockedBecause?: string;
}

const asClaimView = (claim: CountryClaim, t: Traced<number>): ClaimView => {
  try {
    assertPublishable(t.trace);
    return { claim, question: CLAIM_QUESTION[claim], traced: t, publishable: true };
  } catch (e) {
    return {
      claim, question: CLAIM_QUESTION[claim], traced: t, publishable: false,
      blockedBecause: e instanceof Error ? e.message : String(e),
    };
  }
};

export const ukValuation = (): {
  readonly claims: readonly ClaimView[];
  readonly rMinusG: Traced<number>;
  readonly perCapita: ClaimView;
} => ({
  claims: [
    asClaimView("national_net_worth", ukNetWorth()),
    asClaimView("comprehensive_wealth", ukComprehensiveWealth()),
    asClaimView("listed_equity", ukListedEquity()),
  ],
  rMinusG: ukRMinusG(),
  perCapita: asClaimView("national_net_worth", ukNetWorthPerCapita()),
});

export const ukPublishable = (): readonly ClaimView[] =>
  ukValuation().claims.filter((c) => c.publishable);
