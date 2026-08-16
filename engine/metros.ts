/**
 * Metropolitan regions. docs/00-FIRST-PRINCIPLES.md §3
 *
 * THE MISTAKE THIS AVOIDS. The obvious move is to treat a city's economy like a
 * company's revenue and capitalise it: GMP × (1+g)/(r−g), which at plausible rates gives
 * about 23× a year of city output. That is wrong, and wrong by a factor of three.
 *
 * City output is not free cash flow to any owner. Most of it is wages — a claim held by
 * people who can move away, and who take it with them when they do. Only the capital
 * share is a claim on anything immobile. So we value that share and nothing else.
 *
 * INVARIANT 11 also lives here: agglomeration value and land value are the same quantity
 * measured twice — once as the cause, once as the effect. Adding them double-counts.
 */

import {
  trace, observed, assumption, step, formatValue, type Traced,
} from "./trace.ts";
import snapshot from "../data/sources/eurostat-metros.json" with { type: "json" };

const FP = "docs/00-FIRST-PRINCIPLES.md";

export interface MetroMeta {
  readonly code: string;
  readonly name: string;
  readonly country: string;
  readonly isCapital: boolean;
  readonly gdpEur: number;
  readonly population: number | null;
}

const metros = snapshot.metros as MetroMeta[];

export const METRO_YEAR = snapshot.year;
export const METRO_SOURCE = "Eurostat, GDP and population by metropolitan region";
export const METRO_URL = "https://ec.europa.eu/eurostat/databrowser/view/met_10r_3gdp";
export const METRO_NOTE = snapshot.note;

/**
 * Only the capital share of city output is a claim on immobile assets. The labour share
 * belongs to people who can leave.
 */
export const CAPITAL_SHARE = 0.35;
/** Nominal required return on metro-scale assets. */
export const DISCOUNT_RATE = 0.08;
/** Long-run nominal growth in city output. */
export const GROWTH_RATE = 0.025;

export const impliedMultiple = (): number =>
  (CAPITAL_SHARE * (1 + GROWTH_RATE)) / (DISCOUNT_RATE - GROWTH_RATE);

export const allMetros = (): readonly MetroMeta[] => metros;

export const findMetro = (code: string): MetroMeta | undefined =>
  metros.find((m) => m.code.toLowerCase() === code.toLowerCase());

/**
 * Ireland's national accounts are inflated by intellectual property moved onshore and by
 * aircraft leasing — the reason Ireland publishes GNI* as a separate, smaller measure.
 * The distortion lands on Dublin, which is why it outranks metros with far larger
 * populations and economies.
 */
const isIrishDistorted = (m: MetroMeta): boolean => m.country === "IE";

export const metroValue = (m: MetroMeta): Traced<number> | null => {
  if (!m.gdpEur || m.gdpEur <= 0) return null;

  const capitalIncome = m.gdpEur * CAPITAL_SHARE;
  const multiple = impliedMultiple();
  const value = m.gdpEur * multiple;
  const perPerson = m.population ? value / m.population : null;

  const warnings: string[] = [
    "This values only the part of the city's economy that belongs to things that can't " +
    "move — buildings, land, infrastructure. The larger part is wages, which belong to " +
    "people who can leave and take it with them. A city is not a company, and its output " +
    "is not profit.",
    `Defensible answers for this sit anywhere between four and eight times a year of city ` +
    `output. We use ${multiple.toFixed(1)}×. That is a range of roughly two to one, which ` +
    `is far wider than any difference between one year and the next — treat this as an ` +
    `order of magnitude, not a price.`,
    `The figures are for ${METRO_YEAR}. Eurostat stopped updating this series in early ` +
    `2024, so nothing since is reflected.`,
  ];

  if (isIrishDistorted(m)) {
    warnings.push(
      "Ireland's economic figures are inflated by intellectual property that multinationals " +
      "moved onshore and by aircraft leasing — so much so that Ireland publishes a second, " +
      "smaller measure of its own economy for domestic use. That distortion lands here. " +
      "Dublin outranks far larger cities for accounting reasons, not because more is " +
      "produced there.",
    );
  }

  const meaning = m.population
    ? `That works out at about ${formatValue(value / m.population, "EUR")} of buildings, ` +
      `land and infrastructure behind every person who lives here.`
    : `${m.name} produces ${formatValue(m.gdpEur, "EUR")} of output a year.`;

  return trace({
    formula: "V = α · GMP · (1+g)/(r−g)",
    plain:
      "Take the share of the city's yearly output that belongs to things which can't be " +
      "moved — its buildings, land and infrastructure — and work out what a permanent " +
      "claim on that stream is worth today.",
    meaning,
    ref: `${FP} §3.2`,
    question: `What are ${m.name}'s buildings, land and infrastructure worth?`,
    unit: "EUR",
    inputs: [
      observed(`${m.name} yearly output`, m.gdpEur, {
        unit: "EUR", asOf: `${METRO_YEAR}-12-31`, source: METRO_SOURCE, url: METRO_URL,
        plain: "Everything produced in the metropolitan region in a year, at market prices.",
      }),
      assumption(
        "Share belonging to immobile things", CAPITAL_SHARE, "ratio",
        "Only the capital share of output is a claim on assets that cannot relocate. The " +
        "labour share is held by mobile people. Applying the full GMP would treat a city " +
        "like a company and overstate it roughly threefold. 0.35 is the conventional " +
        "capital share of output in advanced economies.",
        `${FP} §3.2`,
        "Roughly a third of what a city produces goes to whoever owns the buildings, land " +
        "and machinery; the rest is wages. Only the first part stays put if people move.",
      ),
      assumption(
        "Required return", DISCOUNT_RATE, "ratio",
        "Nominal required return on metro-scale immobile assets. Together with growth this " +
        "sets the multiple; the defensible band is 4-8x GMP and 8x is a ceiling, not a " +
        "central case.",
        `${FP} §3.2`,
        "What an investor would need to earn each year to justify owning something this " +
        "large and this illiquid.",
      ),
      assumption(
        "Long-run growth", GROWTH_RATE, "ratio",
        "Long-run nominal growth in city output. The gap between this and the required " +
        "return is what sets the multiple — the same r-g relationship that governs " +
        "sovereign debt.",
        `${FP} §3.2`,
        "How fast the city's economy is assumed to grow forever. The gap between this and " +
        "the required return decides almost everything.",
      ),
    ],
    steps: [
      step("Take the share that belongs to immobile things",
        `${formatValue(m.gdpEur, "EUR")} × ${CAPITAL_SHARE} = ${formatValue(capitalIncome, "EUR")}`,
        capitalIncome,
        "About a third of what the city produces each year."),
      step("Value a permanent claim on that stream",
        `${formatValue(capitalIncome, "EUR")} × ${((1 + GROWTH_RATE) / (DISCOUNT_RATE - GROWTH_RATE)).toFixed(1)} = ${formatValue(value, "EUR")}`,
        value,
        `Worth ${multiple.toFixed(1)} times a year of the city's total output.`),
    ],
    warnings,
    value,
  });
};

// ---------------------------------------------------------------------------
// INVARIANT 11 — the double-count this section exists to prevent
// ---------------------------------------------------------------------------

export class DoubleCountedMetroError extends Error {}

/**
 * Agglomeration value and land value are the SAME QUANTITY measured twice — once from
 * the cause side (cities make people more productive) and once from the effect side
 * (that productivity is bid into what land costs). In long-run equilibrium they are
 * equal by construction. Summing them is not conservative; it is wrong.
 */
export const addAgglomerationToLandValue = (): never => {
  throw new DoubleCountedMetroError(
    "INVARIANT 11 violated: agglomeration value and land value are the same thing counted " +
    "twice. A city makes people more productive; that extra productivity is capitalised " +
    "into what land there costs. Adding them double-counts. See docs §3.1.",
  );
};

// ---------------------------------------------------------------------------
// Coverage — stated, not hidden
// ---------------------------------------------------------------------------

export const metroCoverage = () => ({
  metros: metros.length,
  countries: new Set(metros.map((m) => m.country)).size,
  year: METRO_YEAR,
  missing: [
    "London, and every other UK city. The United Kingdom left the EU and Eurostat no " +
    "longer publishes it — which is a real gap on a site that started with a question " +
    "about Britain.",
    "Every city outside Europe. The United States publishes county figures we could " +
    "aggregate, and China publishes city figures; India, most of Africa, most of " +
    "South-East Asia and Latin America publish nothing official at city level. Anyone " +
    "showing you a worldwide city ranking is using a commercial model, not measurements.",
    "What each city owns — its buildings, land and infrastructure counted directly. We " +
    "work back from what the city produces instead, because no one publishes a city " +
    "balance sheet.",
    "The companies headquartered in each city, and what they are worth.",
  ],
});
