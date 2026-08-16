/**
 * Every country the data supports, on the same engine as the UK.
 *
 * Uses World Bank Changing Wealth of Nations (CWON 2024 edition), current US$, 2020.
 * One convention applied identically to 150 countries — which is exactly why we can
 * compare them, and exactly why these figures must never be mixed with the ONS-based
 * UK numbers (INVARIANT 10).
 *
 * Plain English per input is the same everywhere; what differs per country is the
 * numbers, and the meaning and warnings we COMPUTE from them.
 */

import {
  trace, observed, assumption, derived, step, formatValue,
  type Traced,
} from "./trace.ts";
import snapshot from "../data/sources/worldbank.json" with { type: "json" };

const FP = "docs/00-FIRST-PRINCIPLES.md";

export interface CountryMeta {
  readonly iso3: string;
  readonly name: string;
  readonly region: string;
  readonly incomeLevel: string;
}

type SeriesName =
  | "total" | "domestic" | "produced" | "human" | "naturalRenewable"
  | "gdp" | "population" | "gdpGrowth" | "debtToGdp";

const series = snapshot.series as Record<SeriesName, Record<string, number>>;
const countries = snapshot.countries as CountryMeta[];

const val = (name: SeriesName, iso3: string): number | undefined =>
  series[name]?.[iso3];

export const CWON_YEAR = snapshot.cwonYear;
export const CWON_SOURCE = `World Bank, ${snapshot.cwonEdition}`;
export const CWON_URL = "https://www.worldbank.org/en/publication/the-changing-wealth-of-nations";

/**
 * Countries we can actually value.
 *
 * Filters on whether a valuation genuinely builds — not on whether the headline totals
 * exist. One country reports total and domestic wealth but no produced-capital figure,
 * and checking the totals alone let it through as valuable when it isn't.
 */
export const valuableCountries = (): readonly CountryMeta[] =>
  countries
    .filter((c) => countryWealth(c) !== null)
    .sort((a, b) => (val("total", b.iso3)! - val("total", a.iso3)!));

export const findCountry = (iso3: string): CountryMeta | undefined =>
  countries.find((c) => c.iso3.toLowerCase() === iso3.toLowerCase());

const pct = (x: number): string => `${(x * 100).toFixed(0)}%`;

// ---------------------------------------------------------------------------
// Comprehensive wealth — the one claim we can make for every country
// ---------------------------------------------------------------------------

export const countryWealth = (c: CountryMeta): Traced<number> | null => {
  const total = val("total", c.iso3);
  const domestic = val("domestic", c.iso3);
  const produced = val("produced", c.iso3);
  const human = val("human", c.iso3);
  const naturalRenewable = val("naturalRenewable", c.iso3);
  if (total === undefined || domestic === undefined || produced === undefined
      || human === undefined || naturalRenewable === undefined) return null;

  // The residual is nonrenewable natural capital — oil, gas, coal, metals. The current
  // US$ series is additive, so this reconciles (the chained series does not).
  const nonRenewable = Math.max(0, domestic - (produced + human + naturalRenewable));
  const netForeign = total - domestic;
  const naturalTotal = naturalRenewable + nonRenewable;

  const humanShare = human / domestic;
  const naturalShare = naturalTotal / domestic;
  const gdp = val("gdp", c.iso3);

  // Meaning is computed, so it is true of THIS country rather than generically true.
  const humanVsBuilt = human / produced;
  const parts: string[] = [];
  parts.push(
    humanVsBuilt >= 1.2
      ? `People are ${c.name}'s biggest asset by a distance — worth ${humanVsBuilt.toFixed(1)} times everything the country has built.`
      : humanVsBuilt >= 0.8
      ? `People and infrastructure are worth roughly the same here.`
      : `Unusually, what ${c.name} has built is worth more than the future earnings of the people in it.`,
  );
  if (naturalShare > 0.2) {
    parts.push(
      `Natural resources are ${pct(naturalShare)} of the total — high enough that this country's wealth moves with commodity prices.`,
    );
  }
  if (gdp) {
    parts.push(`That is about ${(total / gdp).toFixed(0)} times a year of national income.`);
  }

  const warnings: string[] = [
    `These figures are for ${CWON_YEAR}, the most recent year the World Bank publishes. ` +
    `They do not include anything that has happened since — no inflation shock, no rate ` +
    `cycle, no pandemic recovery.`,
    `Human capital is ${pct(humanShare)} of this total and is the least certain part of ` +
    `it. Valuing future earnings means choosing how much tomorrow's money is worth ` +
    `today; move that choice by one percentage point and this figure moves by roughly a quarter.`,
  ];
  if (netForeign < 0) {
    warnings.push(
      `${c.name} owes more to the rest of the world than it owns abroad, by ` +
      `${formatValue(Math.abs(netForeign), "USD")}. That is subtracted above.`,
    );
  }
  if (naturalShare > 0.35) {
    warnings.push(
      `More than a third of this country's measured wealth is natural resources. ` +
      `Resource wealth is counted here at ${CWON_YEAR} prices, and it depletes as it is ` +
      `extracted — treat the total as a snapshot, not an endowment.`,
    );
  }

  return trace({
    formula: "W = K_produced + K_human + K_natural + NFA",
    plain:
      "Add up what the country has built, what its people will earn over their working " +
      "lives, and what its land and resources are worth — then adjust for what it owns " +
      "abroad versus what it owes.",
    meaning: parts.join(" "),
    ref: `${FP} §2.2`,
    question: `What is ${c.name} worth, counting its people and its natural resources?`,
    unit: "USD",
    inputs: [
      observed("Produced capital", produced, {
        unit: "USD", asOf: `${CWON_YEAR}-12-31`, source: CWON_SOURCE, url: CWON_URL,
        plain: "Everything built: homes, offices, factories, roads, machinery — plus the urban land underneath them.",
      }),
      observed("Human capital", human, {
        unit: "USD", asOf: `${CWON_YEAR}-12-31`, source: CWON_SOURCE, url: CWON_URL,
        plain: "What the people of this country will earn over the rest of their working lives, in today's money.",
      }),
      observed("Natural capital, renewable", naturalRenewable, {
        unit: "USD", asOf: `${CWON_YEAR}-12-31`, source: CWON_SOURCE, url: CWON_URL,
        plain: "Farmland, pasture, forests, fisheries and the services they provide — things that regrow if managed.",
      }),
      observed("Natural capital, nonrenewable", nonRenewable, {
        unit: "USD", asOf: `${CWON_YEAR}-12-31`, source: `${CWON_SOURCE} (derived)`, url: CWON_URL,
        plain: "Oil, gas, coal, metals and minerals still in the ground. Once extracted, they are gone.",
      }),
      observed("Net foreign assets", netForeign, {
        unit: "USD", asOf: `${CWON_YEAR}-12-31`, source: `${CWON_SOURCE} (derived)`, url: CWON_URL,
        plain: "What this country owns abroad, minus what the rest of the world owns in it.",
      }),
      assumption(
        "Which convention: World Bank",
        0.04, "ratio",
        "World Bank CWON 2024 values human capital at a 4% discount rate with ZERO wage " +
        "growth, ages 15-65. The UK's own statistics office uses 3.5% WITH 2% productivity " +
        "growth, ages 16-65, and produces a much larger number. The two are not " +
        "interchangeable and must never be blended (INVARIANT 10). Every country on this " +
        "site uses the World Bank convention, which is why they can be compared with each " +
        "other — and why they cannot be compared with the UK's ONS-based figures.",
        `${FP} §2.2`,
        "How much a pound earned decades from now is worth today — here, 4% a year, with " +
        "no allowance for wages rising. Different statistics offices choose differently, " +
        "and the choice changes the answer enormously. We use the same one everywhere so " +
        "countries can be compared fairly.",
      ),
    ],
    steps: [
      step("Add the domestic components",
        `${formatValue(produced, "USD")} + ${formatValue(human, "USD")} + ${formatValue(naturalTotal, "USD")} = ${formatValue(domestic, "USD")}`,
        domestic,
        "What the country has inside its own borders — built, human and natural."),
      step("Adjust for what it owns abroad, net",
        `${formatValue(domestic, "USD")} ${netForeign < 0 ? "−" : "+"} ${formatValue(Math.abs(netForeign), "USD")} = ${formatValue(total, "USD")}`,
        total,
        netForeign < 0
          ? "Then subtract what it owes the rest of the world, on balance."
          : "Then add what it owns abroad, on balance."),
    ],
    warnings,
    value: total,
  });
};

// ---------------------------------------------------------------------------
// Per person
// ---------------------------------------------------------------------------

export const countryWealthPerCapita = (c: CountryMeta): Traced<number> | null => {
  const w = countryWealth(c);
  const pop = val("population", c.iso3);
  if (!w || pop === undefined) return null;

  const perCapita = w.value / pop;
  return trace({
    formula: "W per capita = W / population",
    plain: "Divide the country's total wealth by the number of people living in it.",
    meaning:
      `Every person in ${c.name} is backed by ${formatValue(perCapita, "USD")} of ` +
      `buildings, land, resources and future earnings. It is a way to feel the size of ` +
      `the number, not money anyone can spend.`,
    ref: `${FP} §6`,
    question: `What is that per person in ${c.name}?`,
    unit: "USD",
    inputs: [
      derived("Total wealth", w),
      observed("Population", pop, {
        unit: "people", asOf: "2024-12-31",
        source: "World Bank, World Development Indicators",
        url: "https://data.worldbank.org/indicator/SP.POP.TOTL",
        plain: "How many people live in the country.",
      }),
    ],
    steps: [
      step("Divide total wealth by population",
        `${formatValue(w.value, "USD")} ÷ ${formatValue(pop, "people")} people = ${formatValue(perCapita, "USD")}`,
        perCapita,
        "The country's wealth, shared out per person."),
    ],
    warnings: [
      `The population figure is from 2024 but the wealth figure is from ${CWON_YEAR}. ` +
      `Dividing one by the other mixes two dates — the direction is right, the precision is not.`,
    ],
    value: perCapita,
  });
};

// ---------------------------------------------------------------------------
// What we can and cannot say, per country — stated rather than hidden
// ---------------------------------------------------------------------------

export interface Coverage {
  readonly wealth: boolean;
  readonly perCapita: boolean;
  readonly debt: boolean;
  readonly missing: readonly string[];
}

export const coverage = (c: CountryMeta): Coverage => {
  const missing: string[] = [];
  const wealth = countryWealth(c) !== null;
  const perCapita = val("population", c.iso3) !== undefined && wealth;
  const debt = val("debtToGdp", c.iso3) !== undefined;

  if (!wealth) missing.push("comprehensive wealth — the World Bank does not publish it for this country");
  if (!debt) {
    missing.push(
      "government debt as a share of the economy — only 61 countries report this to the " +
      "World Bank, so we cannot show the debt-versus-growth comparison here",
    );
  }
  missing.push(
    "a national balance sheet — only a handful of advanced economies publish one, which " +
    "is why the United Kingdom has more answers on this site than anywhere else",
  );

  return { wealth, perCapita, debt, missing };
};

export const countrySummary = (c: CountryMeta) => {
  const w = countryWealth(c);
  const pc = countryWealthPerCapita(c);
  const gdp = val("gdp", c.iso3);
  const pop = val("population", c.iso3);
  return {
    meta: c,
    wealth: w,
    perCapita: pc,
    gdp, population: pop,
    coverage: coverage(c),
  };
};

// ---------------------------------------------------------------------------
// What a country is made of
// ---------------------------------------------------------------------------

export interface Composition {
  readonly iso3: string;
  readonly name: string;
  /** Shares of DOMESTIC wealth, summing to 1. */
  readonly produced: number;
  readonly human: number;
  readonly natural: number;
  readonly domestic: number;
  readonly total: number;
  /**
   * Net foreign assets, kept OUT of the shares deliberately — it can be negative, and a
   * negative slice in a stacked bar is a lie. Reported alongside instead.
   */
  readonly netForeign: number;
}

export const countryComposition = (c: CountryMeta): Composition | null => {
  const total = val("total", c.iso3);
  const domestic = val("domestic", c.iso3);
  const produced = val("produced", c.iso3);
  const human = val("human", c.iso3);
  const naturalRenewable = val("naturalRenewable", c.iso3);
  if (total === undefined || domestic === undefined || produced === undefined
      || human === undefined || naturalRenewable === undefined) return null;

  const natural = Math.max(0, domestic - (produced + human + naturalRenewable)) + naturalRenewable;
  // Normalise against the components we actually have, so the shares always sum to 1
  // even where the published domestic total rounds differently.
  const sum = produced + human + natural;
  if (sum <= 0) return null;

  return {
    iso3: c.iso3, name: c.name,
    produced: produced / sum,
    human: human / sum,
    natural: natural / sum,
    domestic, total,
    netForeign: total - domestic,
  };
};

export const allCompositions = (): readonly Composition[] =>
  valuableCountries()
    .map(countryComposition)
    .filter((x): x is Composition => x !== null);

/**
 * The most striking examples, picked FROM THE DATA rather than hardcoded — so they stay
 * true if the underlying figures are ever revised.
 *
 * Restricted to countries with a meaningful total, because the extremes are otherwise
 * dominated by tiny economies where one mine swings the whole share.
 */
export const compositionExtremes = (): readonly {
  composition: Composition; why: string;
}[] => {
  const big = allCompositions()
    .filter((x) => x.total > 2e11)
    .sort((a, b) => b.total - a.total);
  if (big.length === 0) return [];

  const pick = (
    key: "produced" | "human" | "natural", why: (c: Composition) => string,
  ) => {
    const top = [...big].sort((a, b) => b[key] - a[key])[0]!;
    return { composition: top, why: why(top) };
  };

  const out = [
    pick("natural", (c) => `${(c.natural * 100).toFixed(0)}% of ${c.name}'s wealth is land and resources — its fortunes move with commodity prices.`),
    pick("human", (c) => `${(c.human * 100).toFixed(0)}% of ${c.name}'s wealth is its people. Almost nothing else matters to the total.`),
    pick("produced", (c) => `${(c.produced * 100).toFixed(0)}% of ${c.name}'s wealth is what it has built — an unusually capital-heavy economy.`),
  ];

  // De-duplicate: one country can top two categories.
  const seen = new Set<string>();
  return out.filter((x) => {
    if (seen.has(x.composition.iso3)) return false;
    seen.add(x.composition.iso3);
    return true;
  });
};
