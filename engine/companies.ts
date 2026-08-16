/**
 * Companies — the fourth and last entity type, on the same identity as the other three.
 *
 * docs/00-FIRST-PRINCIPLES.md §1 says value is created only when a business earns more
 * on its capital than that capital costs. For a country we measure that badly and slowly.
 * For a public company we can measure it directly, from accounts it is legally obliged to
 * file. That makes companies the cleanest demonstration of the whole method.
 *
 * WHAT WE REFUSE TO DO HERE, and why the pages look the way they do:
 *
 * - **No forecast.** A five-year revenue projection is the analyst's opinion wearing a
 *   spreadsheet's clothes. Everything below uses filed figures plus two clearly marked
 *   judgements (the cost of capital and long-run growth) and nothing else.
 * - **No point estimate.** The value comes out as a range between "worth only what it
 *   earns today" and "today's returns continue". Those two are far apart, and the gap is
 *   the honest answer.
 * - **No market price stored.** We may not redistribute market data
 *   (docs/01-DATA-SPINE.md §7), so the reader supplies the price and we tell them what it
 *   requires. That constraint turned out to make the better page.
 * - **No borrowed ranking.** Forbes and Fortune own their lists. We rank on value
 *   created, which nobody publishes, from filings that belong to everyone.
 */

import {
  trace, observed, assumption, derived, step, formatValue,
  type Traced,
} from "./trace.ts";
import { INDUSTRY_ANCHORS, INDUSTRY_ANCHORS_VINTAGE, RISK_FREE, IMPLIED_ERP } from "./constants.ts";
import snapshot from "../data/sources/sec-companies.json" with { type: "json" };

const FP = "docs/00-FIRST-PRINCIPLES.md";

export interface CompanyMeta {
  readonly cik: number;
  readonly name: string;
  readonly state?: string;
  readonly fiscalYearEnd: string;
  readonly accession: string;
  readonly revenue: number;
  readonly revenueTag: string;
  readonly operatingIncome: number;
  readonly taxExpense: number;
  readonly pretaxIncome: number;
  readonly assets: number;
  readonly currentLiabilities: number;
  readonly equity: number;
  readonly cash: number;
  readonly debt: number;
  readonly debtSource: string;
  readonly balanceDate: string;
}

const raw = snapshot.companies as CompanyMeta[];

export const SEC_YEAR = snapshot.fiscalYear;
export const SEC_SOURCE = "SEC EDGAR — company annual filings";
export const SEC_LICENCE = snapshot.licence;
/** How many companies had a complete set of accounts, before we took the top slice. */
export const SEC_UNIVERSE = snapshot.universe;

/** The filing every figure on a company's page came from. Readers can open it. */
export const filingUrl = (c: CompanyMeta): string =>
  `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${c.cik}&type=10-K&dateb=&owner=include&count=10`;

export const findCompany = (cik: number | string): CompanyMeta | undefined =>
  raw.find((c) => c.cik === Number(cik));

/**
 * Title case, because EDGAR shouts. "WALMART INC." reads as an error, not a name.
 *
 * Two exceptions worth the extra lines: anything with an ampersand is an initialism
 * (PG&E, AT&T, H&R), and ".com" is never capitalised mid-name.
 */
export const displayName = (name: string): string =>
  name
    .split(" ")
    .map((word) =>
      /[a-z]/.test(word) ? word
      : word.includes("&") ? word
      : word.charAt(0) + word.slice(1).toLowerCase(),
    )
    .join(" ")
    .replace(/\.Com\b/g, ".com");

// ---------------------------------------------------------------------------
// The two judgements. Everything else on these pages is a filed fact.
// ---------------------------------------------------------------------------

const MARKET = INDUSTRY_ANCHORS.totalMarketExFinancials!;

/**
 * Cost of capital. One market-wide figure applied to every company.
 *
 * A per-company cost of capital would be more precise and less honest: it needs a beta,
 * which needs a price history, which we may not store. Using one number everywhere makes
 * companies comparable with each other in exactly the way one convention makes countries
 * comparable — and it is the number the reader is most likely to want to argue with, so
 * it sits on the page as a judgement rather than hiding inside the maths.
 */
export const COST_OF_CAPITAL = MARKET.wacc;

/**
 * Long-run growth, capped at the risk-free rate.
 *
 * INVARIANT 1. A company growing faster than the economy forever eventually becomes the
 * economy. The risk-free rate is the market's own estimate of long-run nominal growth,
 * which is why it is the ceiling rather than an arbitrary 2%.
 */
export const LONG_RUN_GROWTH = RISK_FREE.aug2026.value;

/** US federal 21% plus a typical state charge — used only when the filing's own rate is unusable. */
const MARGINAL_TAX = 0.25;

const capitalAssumption = () =>
  assumption(
    "What the money costs",
    COST_OF_CAPITAL, "ratio",
    `${(MARKET.wacc * 100).toFixed(2)}% — the cost of capital across ${MARKET.n.toLocaleString("en-GB")} ` +
    `US companies excluding banks and insurers (Damodaran, NYU Stern, ${INDUSTRY_ANCHORS_VINTAGE}). ` +
    `We apply one market-wide figure to every company rather than estimating a separate ` +
    `one per company, because a company-specific cost of capital requires a beta, a beta ` +
    `requires a price history, and market data may not be stored here. A capital-heavy ` +
    `utility genuinely costs less than a semiconductor firm, so treat this as the market ` +
    `average it is. It is the single number on this page most worth disagreeing with.`,
    `${FP} §4.2`,
    "Investors could put their money somewhere else. This is roughly what they expect to " +
    "earn for taking the risk of owning a US company — the bar this business has to clear.",
  );

const growthAssumption = () =>
  assumption(
    "How fast it grows forever",
    LONG_RUN_GROWTH, "ratio",
    `${(LONG_RUN_GROWTH * 100).toFixed(2)}% — the US 10-year Treasury yield at ` +
    `${RISK_FREE.aug2026.asOf}, used as the ceiling on long-run growth. INVARIANT 1: no ` +
    `company may be assumed to grow faster than the economy forever, because it would ` +
    `eventually become the economy. This is the most common error in a founder-built or ` +
    `analyst-built model, and it is the reason terminal values run away.`,
    `${FP} §4.1`,
    "Nothing grows faster than the whole economy for ever. We cap growth at the rate " +
    "long-term government bonds pay, which is the market's own guess at how fast the " +
    "economy grows in cash terms.",
  );

// ---------------------------------------------------------------------------
// Tax actually paid
// ---------------------------------------------------------------------------

export interface TaxRate {
  readonly rate: number;
  readonly measured: boolean;
  readonly why: string;
}

export const taxRateOf = (c: CompanyMeta): TaxRate => {
  if (c.pretaxIncome > 0) {
    const eff = c.taxExpense / c.pretaxIncome;
    if (eff >= 0 && eff <= 0.5) {
      return {
        rate: eff, measured: true,
        why: `Tax actually charged in the accounts, ${formatValue(c.taxExpense, "USD")} on ` +
          `${formatValue(c.pretaxIncome, "USD")} of pre-tax profit.`,
      };
    }
    return {
      rate: MARGINAL_TAX, measured: false,
      why: `The filed tax charge works out at ${(eff * 100).toFixed(0)}% of pre-tax profit, ` +
        `which is outside the plausible range — usually a one-off settlement, a repatriation ` +
        `charge or a valuation-allowance release. We use the ${MARGINAL_TAX * 100}% marginal ` +
        `rate instead rather than let a one-off distort the return on capital.`,
    };
  }
  return {
    rate: MARGINAL_TAX, measured: false,
    why: `This company made no pre-tax profit in ${SEC_YEAR}, so there is no meaningful ` +
      `effective rate to read off. We use the ${MARGINAL_TAX * 100}% marginal rate.`,
  };
};

// ---------------------------------------------------------------------------
// Invested capital — the money tied up in the business
// ---------------------------------------------------------------------------

export const investedCapital = (c: CompanyMeta): Traced<number> | null => {
  const ic = c.equity + c.debt - c.cash;
  // Buybacks can drive book equity negative — Home Depot, McDonald's, Starbucks and
  // others have returned more to shareholders than the accounts ever recorded as paid in.
  // Book capital then stops describing anything real, and every ratio built on it is
  // meaningless rather than merely imprecise. We decline instead of printing a number.
  if (ic <= 0) return null;

  return trace({
    formula: "IC = Equity + Debt − Cash",
    plain:
      "Add what shareholders have put in and left in, plus what the company has borrowed, " +
      "then take off the cash sitting in the bank — because cash isn't working in the business.",
    meaning:
      `${displayName(c.name)} has ${formatValue(ic, "USD")} of money tied up in actually ` +
      `running the business. Everything below asks one question about that figure: does it ` +
      `earn more than it costs?`,
    ref: `${FP} §1`,
    question: `How much money is tied up in ${displayName(c.name)}?`,
    unit: "USD",
    inputs: [
      observed("Shareholders' equity", c.equity, {
        unit: "USD", asOf: c.balanceDate, source: SEC_SOURCE, url: filingUrl(c),
        plain: "What owners have put in plus every profit kept in the business rather than paid out.",
      }),
      observed("Borrowing", c.debt, {
        unit: "USD", asOf: c.balanceDate, source: `${SEC_SOURCE} (${c.debtSource})`, url: filingUrl(c),
        plain: "Money lent to the company that it has to pay back with interest.",
      }),
      observed("Cash", c.cash, {
        unit: "USD", asOf: c.balanceDate, source: SEC_SOURCE, url: filingUrl(c),
        plain: "Cash and near-cash. Taken off, because money in the bank isn't invested in anything.",
      }),
    ],
    steps: [
      step("Add what owners and lenders have put in",
        `${formatValue(c.equity, "USD")} + ${formatValue(c.debt, "USD")} = ${formatValue(c.equity + c.debt, "USD")}`,
        c.equity + c.debt,
        "The total money the business has been given to work with."),
      step("Take off the cash pile",
        `${formatValue(c.equity + c.debt, "USD")} − ${formatValue(c.cash, "USD")} = ${formatValue(ic, "USD")}`,
        ic,
        "What is left is the money genuinely at work."),
    ],
    warnings: [
      `These are book figures from the ${SEC_YEAR} accounts, dated ${c.balanceDate}. If the ` +
      `company has bought other companies, the price paid sits in here as goodwill, which ` +
      `makes the capital look larger and the return on it look smaller than for a business ` +
      `that built the same position itself.`,
    ],
    value: ic,
  });
};

// ---------------------------------------------------------------------------
// What it earns on that money
// ---------------------------------------------------------------------------

export const returnOnCapital = (c: CompanyMeta): Traced<number> | null => {
  const ic = investedCapital(c);
  if (!ic) return null;
  const tax = taxRateOf(c);
  const nopat = c.operatingIncome * (1 - tax.rate);
  const roic = nopat / ic.value;

  const gap = roic - COST_OF_CAPITAL;
  const meaning =
    roic < 0
      ? `${displayName(c.name)} lost money on its operations in ${SEC_YEAR}, so the return ` +
        `on capital is negative. Every pound tied up in the business shrank.`
      : gap > 0
      ? `${displayName(c.name)} earns ${(roic * 100).toFixed(1)}% on the money invested in ` +
        `it, against a cost of about ${(COST_OF_CAPITAL * 100).toFixed(1)}%. It clears the ` +
        `bar by ${(gap * 100).toFixed(1)} percentage points — so growth here creates value.`
      : `${displayName(c.name)} earns ${(roic * 100).toFixed(1)}% on the money invested in ` +
        `it, against a cost of about ${(COST_OF_CAPITAL * 100).toFixed(1)}%. It falls short ` +
        `by ${(-gap * 100).toFixed(1)} percentage points — so growth here destroys value, ` +
        `and getting bigger makes it worse rather than better.`;

  const warnings = [
    `This is one year. A single good or bad year moves this figure a long way, and a ` +
    `company mid-way through a big investment programme will look worse than it is, ` +
    `because the spending lands before the earnings do.`,
  ];
  if (!tax.measured) warnings.push(tax.why);
  if (roic > COST_OF_CAPITAL * 3) {
    warnings.push(
      `A return this far above the cost of capital is rare and usually temporary. High ` +
      `returns attract competition, which is what pulls them back down. Anything below ` +
      `that assumes this level continues should be read sceptically — including our own ` +
      `upper figure.`,
    );
  }

  return trace({
    formula: "ROIC = EBIT × (1 − t) / IC",
    plain:
      "Take the profit from running the business, take off tax, and divide by the money " +
      "tied up in it. That is the return the business earns on what it uses.",
    meaning,
    ref: `${FP} §4.1`,
    question: `What does ${displayName(c.name)} earn on the money invested in it?`,
    unit: "ratio",
    inputs: [
      observed("Operating profit", c.operatingIncome, {
        unit: "USD", asOf: c.fiscalYearEnd, source: SEC_SOURCE, url: filingUrl(c),
        plain: "Profit from trading, before interest and tax — what the business itself earns.",
      }),
      tax.measured
        ? observed("Tax rate actually paid", tax.rate, {
            unit: "ratio", asOf: c.fiscalYearEnd, source: SEC_SOURCE, url: filingUrl(c),
            plain: "The share of pre-tax profit that went to tax, taken from the accounts.",
          })
        : assumption(
            "Tax rate", tax.rate, "ratio", tax.why, `${FP} §4.1`,
            "The share of profit that goes to tax. This company's own figure could not be " +
            "used, so we use the standard US rate.",
          ),
      derived("Money tied up in the business", ic),
      capitalAssumption(),
    ],
    steps: [
      step("Take tax off the operating profit",
        `${formatValue(c.operatingIncome, "USD")} × (1 − ${(tax.rate * 100).toFixed(1)}%) = ${formatValue(nopat, "USD")}`,
        nopat,
        "What the business keeps from trading, after tax and before paying lenders."),
      step("Divide by the money tied up",
        `${formatValue(nopat, "USD")} ÷ ${formatValue(ic.value, "USD")} = ${(roic * 100).toFixed(2)}%`,
        roic,
        "The return earned on every pound at work in the business."),
    ],
    warnings,
    value: roic,
  });
};

// ---------------------------------------------------------------------------
// Value created or destroyed — the headline, and the whole thesis of the site
// ---------------------------------------------------------------------------

export const valueCreated = (c: CompanyMeta): Traced<number> | null => {
  const ic = investedCapital(c);
  const roicT = returnOnCapital(c);
  if (!ic || !roicT) return null;

  const roic = roicT.value;
  const ep = (roic - COST_OF_CAPITAL) * ic.value;

  return trace({
    formula: "Economic profit = (ROIC − WACC) × IC",
    plain:
      "Take what the business earns on its money, take off what that money costs, and " +
      "multiply by how much money there is. Anything left over is value created out of nothing.",
    meaning:
      ep > 0
        ? `${displayName(c.name)} creates about ${formatValue(ep, "USD")} of value a year ` +
          `beyond what its investors could have earned elsewhere. That surplus — not revenue, ` +
          `not profit — is what a business is fundamentally for.`
        : c.operatingIncome < 0
        ? `${displayName(c.name)} destroys about ${formatValue(-ep, "USD")} of value a year. ` +
          `This one is not subtle: it lost money running the business in ${SEC_YEAR}, so the ` +
          `${formatValue(ic.value, "USD")} tied up inside it shrank rather than grew.`
        : `${displayName(c.name)} destroys about ${formatValue(-ep, "USD")} of value a year — ` +
          `while being profitable. That is the point of this measure. The accounts show a ` +
          `profit, and the money that produced it could still have earned more somewhere ` +
          `else. This is the most common form of failure at large companies and it never ` +
          `shows up in the profit line.`,
    ref: `${FP} §1`,
    question: `Does ${displayName(c.name)} create value, or consume it?`,
    unit: "USD",
    inputs: [
      derived("What it earns on its money", roicT),
      derived("Money tied up in the business", ic),
      capitalAssumption(),
    ],
    steps: [
      step("How far it clears the bar",
        `${(roic * 100).toFixed(2)}% − ${(COST_OF_CAPITAL * 100).toFixed(2)}% = ${((roic - COST_OF_CAPITAL) * 100).toFixed(2)}%`,
        roic - COST_OF_CAPITAL,
        "The gap between what the business earns and what its money costs."),
      step("Applied to the money at work",
        `${((roic - COST_OF_CAPITAL) * 100).toFixed(2)}% × ${formatValue(ic.value, "USD")} = ${formatValue(ep, "USD")}`,
        ep,
        ep > 0 ? "Value created in the year." : "Value destroyed in the year."),
    ],
    warnings: [
      `Accounting profit and value creation are different things. A company can report a ` +
      `record profit and still be on this list as a destroyer, because the profit was too ` +
      `small for the amount of money it took to produce it.`,
    ],
    value: ep,
  });
};

// ---------------------------------------------------------------------------
// What the business is worth — a range, never a number
// ---------------------------------------------------------------------------

export interface CompanyValue {
  /** Worth of the current earnings alone, with no growth at all. */
  readonly floor: Traced<number>;
  /** Worth if today's returns and long-run growth both continue. */
  readonly ceiling: Traced<number>;
}

export const companyValue = (c: CompanyMeta): CompanyValue | null => {
  const ic = investedCapital(c);
  const roicT = returnOnCapital(c);
  if (!ic || !roicT) return null;
  const roic = roicT.value;
  // A loss-making business cannot be valued on its earnings at all. Saying so is the
  // honest answer; inventing a recovery forecast to fill the gap is not.
  if (roic <= 0) return null;

  const tax = taxRateOf(c);
  const nopat = c.operatingIncome * (1 - tax.rate);
  const floor = nopat / COST_OF_CAPITAL;
  const ceiling = (ic.value * (roic - LONG_RUN_GROWTH)) / (COST_OF_CAPITAL - LONG_RUN_GROWTH);

  const spread = ceiling / floor;

  const floorTraced = trace({
    formula: "V_floor = NOPAT / WACC",
    plain:
      "If the business never grows again and simply keeps earning what it earns now, what " +
      "is that stream of earnings worth today?",
    meaning:
      `Roughly ${formatValue(floor, "USD")}. This is the pessimistic end: no growth, no new ` +
      `products, no expansion — just today's business running on indefinitely. It is a floor, ` +
      `not a forecast.`,
    ref: `${FP} §4.1`,
    question: `What is ${displayName(c.name)} worth if it never grows again?`,
    unit: "USD",
    inputs: [
      observed("Operating profit", c.operatingIncome, {
        unit: "USD", asOf: c.fiscalYearEnd, source: SEC_SOURCE, url: filingUrl(c),
        plain: "Profit from trading, before interest and tax.",
      }),
      capitalAssumption(),
    ],
    steps: [
      step("Profit after tax",
        `${formatValue(c.operatingIncome, "USD")} × (1 − ${(tax.rate * 100).toFixed(1)}%) = ${formatValue(nopat, "USD")}`,
        nopat, "What the business keeps each year."),
      step("Capitalise it forever, with no growth",
        `${formatValue(nopat, "USD")} ÷ ${(COST_OF_CAPITAL * 100).toFixed(2)}% = ${formatValue(floor, "USD")}`,
        floor, "The same amount, every year, for ever, converted into a value today."),
    ],
    warnings: [
      `No growth is a deliberately harsh assumption. Almost every business grows with ` +
      `inflation at the very least, so treat this as the floor it is.`,
    ],
    value: floor,
  });

  const ceilingTraced = trace({
    formula: "V = IC × (ROIC − g) / (WACC − g)",
    plain:
      "If the business keeps earning what it earns now and keeps growing at the long-run " +
      "rate for ever, its value is the money tied up in it, scaled by how far its returns " +
      "beat its cost of capital.",
    meaning:
      `Roughly ${formatValue(ceiling, "USD")} — about ${spread.toFixed(1)} times the ` +
      `no-growth figure. That multiple is the price of the growth assumption, and it is ` +
      `why two people looking at identical accounts can reach wildly different answers.`,
    ref: `${FP} §1`,
    question: `What is ${displayName(c.name)} worth if today's returns continue?`,
    unit: "USD",
    inputs: [
      derived("Money tied up in the business", ic),
      derived("What it earns on its money", roicT),
      capitalAssumption(),
      growthAssumption(),
    ],
    steps: [
      step("How far returns beat long-run growth",
        `${(roic * 100).toFixed(2)}% − ${(LONG_RUN_GROWTH * 100).toFixed(2)}% = ${((roic - LONG_RUN_GROWTH) * 100).toFixed(2)}%`,
        roic - LONG_RUN_GROWTH,
        "The advantage the business has over simply keeping pace with the economy."),
      step("Against how far its cost beats that growth",
        `${(COST_OF_CAPITAL * 100).toFixed(2)}% − ${(LONG_RUN_GROWTH * 100).toFixed(2)}% = ${((COST_OF_CAPITAL - LONG_RUN_GROWTH) * 100).toFixed(2)}%`,
        COST_OF_CAPITAL - LONG_RUN_GROWTH,
        "The gap that converts a yearly surplus into a value today. A small gap makes a big multiple."),
      step("Scale the money tied up by the two",
        `${formatValue(ic.value, "USD")} × ${((roic - LONG_RUN_GROWTH) / (COST_OF_CAPITAL - LONG_RUN_GROWTH)).toFixed(2)} = ${formatValue(ceiling, "USD")}`,
        ceiling, "The value the current economics support if they hold."),
    ],
    warnings: [
      `This assumes today's returns last for ever, which they almost never do. High returns ` +
      `attract competitors; that is the mechanism that pulls them back to the cost of ` +
      `capital. Read this as the optimistic end of a range, not as a target.`,
      `The gap between the cost of capital and long-run growth is only ` +
      `${((COST_OF_CAPITAL - LONG_RUN_GROWTH) * 100).toFixed(2)} percentage points, and it ` +
      `sits on the bottom of the sum. Move either assumption by half a point and this ` +
      `figure moves enormously. That sensitivity is real, not a modelling artefact — it is ` +
      `why markets lurch when interest-rate expectations change.`,
    ],
    value: ceiling,
  });

  return { floor: floorTraced, ceiling: ceilingTraced };
};

// ---------------------------------------------------------------------------
// What a price would require — the reader brings the price
// ---------------------------------------------------------------------------

/** Cost of equity, for inverting a market price. Market beta, not company beta. */
export const COST_OF_EQUITY =
  RISK_FREE.aug2026.value + MARKET.leveredBeta * IMPLIED_ERP.aug2026.value;

export interface PriceImplication {
  readonly marketValue: number;
  readonly netMargin: number;
  readonly requiredProfit: number;
  readonly requiredRevenue: number;
  readonly currentRevenue: number;
  readonly revenueMultiple: number;
  /** Growth needed over five years to get from today's revenue to the required one. */
  readonly requiredGrowth: number;
  readonly verdict: string;
}

/**
 * Pure, and therefore safe to run in the browser — which matters, because the price is
 * typed in by the reader and never leaves their machine. This is the only way market
 * data touches the product at all.
 */
export const impliedByPrice = (
  c: CompanyMeta, marketValue: number, years = 5,
): PriceImplication | null => {
  if (!(marketValue > 0) || c.revenue <= 0) return null;
  const netIncome = c.pretaxIncome - c.taxExpense;
  const netMargin = netIncome / c.revenue;
  if (netMargin <= 0) return null;

  const requiredProfit = (marketValue * (COST_OF_EQUITY - LONG_RUN_GROWTH)) / (1 + LONG_RUN_GROWTH);
  const requiredRevenue = requiredProfit / netMargin;
  const requiredGrowth = Math.pow(requiredRevenue / c.revenue, 1 / years) - 1;

  const verdict =
    requiredRevenue <= c.revenue
      ? `At this price the business already earns more than it needs to. The price implies ` +
        `no growth is required at all.`
      : requiredGrowth < 0.05
      ? `The price needs revenue to grow about ${(requiredGrowth * 100).toFixed(1)}% a year ` +
        `for five years. That is roughly economy-wide growth — an undemanding price.`
      : requiredGrowth < 0.15
      ? `The price needs revenue to grow about ${(requiredGrowth * 100).toFixed(1)}% a year ` +
        `for five years. Demanding but not unusual for a good business.`
      : requiredGrowth < 0.30
      ? `The price needs revenue to grow about ${(requiredGrowth * 100).toFixed(1)}% a year ` +
        `for five years — it must roughly ${(requiredRevenue / c.revenue).toFixed(1)}× its ` +
        `revenue. Few companies of this size have ever done that.`
      : `The price needs revenue to grow about ${(requiredGrowth * 100).toFixed(1)}% a year ` +
        `for five years, reaching ${formatValue(requiredRevenue, "USD")}. Ask whether the ` +
        `market it sells into is even that big.`;

  return {
    marketValue, netMargin, requiredProfit, requiredRevenue,
    currentRevenue: c.revenue,
    revenueMultiple: requiredRevenue / c.revenue,
    requiredGrowth, verdict,
  };
};

// ---------------------------------------------------------------------------
// The ranking — ours, on value created
// ---------------------------------------------------------------------------

export interface Ranked {
  readonly company: CompanyMeta;
  readonly investedCapital: number;
  readonly roic: number;
  readonly valueCreated: number;
}

/**
 * Companies we can actually value, ranked by value created rather than by size.
 *
 * Filters on whether the valuation genuinely builds, not on whether the raw figures
 * exist — the same lesson the country list taught, where checking the headline totals
 * let through a country that had no produced-capital figure.
 */
export const rankedCompanies = (): readonly Ranked[] => {
  const out: Ranked[] = [];
  for (const c of raw) {
    const ic = investedCapital(c);
    const roic = returnOnCapital(c);
    const ep = valueCreated(c);
    if (!ic || !roic || !ep) continue;
    out.push({ company: c, investedCapital: ic.value, roic: roic.value, valueCreated: ep.value });
  }
  return out.sort((a, b) => b.valueCreated - a.valueCreated);
};

/** Companies whose book capital has gone negative, and are therefore unrankable. */
export const unmeasurable = (): readonly CompanyMeta[] =>
  raw.filter((c) => investedCapital(c) === null);

export const companyCoverage = () => {
  const ranked = rankedCompanies();
  const creators = ranked.filter((r) => r.valueCreated > 0);
  return {
    published: ranked.length,
    universe: SEC_UNIVERSE,
    excluded: raw.length - ranked.length,
    creators: creators.length,
    destroyers: ranked.length - creators.length,
    year: SEC_YEAR,
  };
};
