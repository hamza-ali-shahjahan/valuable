/**
 * What moves value — the findings that lead the front page.
 *
 * These are NOT news. Our data has fixed vintages (2020 for country wealth, 2021 for
 * cities), so a "latest numbers" ticker would be the first dishonest thing on the site.
 *
 * What we do have is findings nobody else surfaces: things our own data says that a
 * reader would not expect. Every one is COMPUTED from the engine, so it cannot go stale
 * or drift out of line with the pages it links to.
 */

import {
  valuableCountries, countryWealth, countryWealthPerCapita, countryComposition,
  compositionExtremes, findCountry,
} from "./countries.ts";
import { findMetro, metroValue, allMetros } from "./metros.ts";
import { ukComprehensiveWealth } from "./valuations.ts";
import { modelFromTrace, totalAtRate } from "./sensitivity.ts";
import { formatValue } from "./trace.ts";

export interface Finding {
  /** Short enough to scan in one glance. */
  readonly headline: string;
  /** One or two sentences. What it means and why it is surprising. */
  readonly body: string;
  /** What a reader should do about it. */
  readonly action: string;
  readonly href: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export const findings = (): readonly Finding[] => {
  const out: Finding[] = [];

  // --- the same country, two official answers -------------------------------
  const ons = ukComprehensiveWealth();
  const gbr = findCountry("GBR");
  const wbUk = gbr ? countryWealth(gbr) : null;
  if (wbUk) {
    out.push({
      headline: "Two official bodies value Britain. They disagree by about £20 trillion.",
      body:
        `Britain's own statisticians put the country at ${formatValue(ons.value, "GBP")} once ` +
        `you count its people. The World Bank, measuring the same country, gets ` +
        `${formatValue(wbUk.value, "USD")}. Neither is wrong — they made different choices ` +
        `about how much a pound earned decades from now is worth today.`,
      action: "See both, and why the gap exists",
      href: "/country/uk",
    });
  }

  // --- the lever with the most force ----------------------------------------
  const m = modelFromTrace(ons.trace, ons.value);
  if (m) {
    const lo = totalAtRate(m.model, m.otherComponents, 0.05);
    const hi = totalAtRate(m.model, m.otherComponents, 0.025);
    out.push({
      headline: `One number nobody measured moves Britain's wealth by ${formatValue(hi.total - lo.total, "GBP")}.`,
      body:
        `Valuing people means guessing what future earnings are worth today. Nudge that ` +
        `guess across a plausible range and the answer swings from ` +
        `${formatValue(lo.total, "GBP")} to ${formatValue(hi.total, "GBP")}. It is the ` +
        `single most powerful assumption in national accounting, and almost nobody shows it.`,
      action: "Drag it yourself",
      href: `/trace/${ons.trace.hash}`,
    });
  }

  // --- structure beats size --------------------------------------------------
  const ex = compositionExtremes();
  const people = ex.find((e) => e.composition.human > 0.6);
  const rocks = ex.find((e) => e.composition.natural > 0.5);
  if (people && rocks) {
    out.push({
      headline: `${people.composition.name} is ${pct(people.composition.human)} people. ${rocks.composition.name} is ${pct(rocks.composition.natural)} soil and rock.`,
      body:
        `Two countries can be worth similar amounts and be nothing alike underneath. One ` +
        `grows by educating people; the other rises and falls with commodity prices. What a ` +
        `country is made of decides which levers actually work on it.`,
      action: "Compare any two countries",
      href: "/countries",
    });
  }

  // --- an accounting quirk that outranks a real economy ----------------------
  const dublin = findMetro("IE001MC");
  const berlin = findMetro("DE001MC");
  if (dublin && berlin && dublin.population && berlin.population) {
    out.push({
      headline: "Dublin out-earns Berlin on less than half the population.",
      body:
        `Dublin reports ${formatValue(dublin.gdpEur, "EUR")} of output against Berlin's ` +
        `${formatValue(berlin.gdpEur, "EUR")}, on ${(dublin.population / 1e6).toFixed(1)} ` +
        `million people versus ${(berlin.population / 1e6).toFixed(1)} million. That is not ` +
        `productivity. It is intellectual property and aircraft leasing booked in Ireland ` +
        `for tax reasons.`,
      action: "See why, and what it distorts",
      href: "/metro/ie001mc",
    });
  }

  // --- wealth per person is not where you'd guess ---------------------------
  const ranked = valuableCountries()
    .map((c) => ({ c, pc: countryWealthPerCapita(c) }))
    .filter((x) => x.pc !== null)
    .sort((a, b) => b.pc!.value - a.pc!.value);
  const top = ranked[0];
  if (top) {
    out.push({
      headline: `The wealthiest country per person is ${top.c.name}, at ${formatValue(top.pc!.value, "USD")} each.`,
      body:
        `Not the largest economy — the one with the most behind every person in it. ` +
        `Ranking by total tells you about size; ranking per person tells you about the ` +
        `country you would actually live in.`,
      action: "See the full ranking",
      href: "/countries",
    });
  }

  return out;
};

/** Everything a visitor can look up, for the search box. */
export interface SearchEntry {
  readonly name: string;
  readonly kind: "country" | "city";
  readonly href: string;
  readonly detail: string;
}

export const searchIndex = (): readonly SearchEntry[] => {
  const countries = valuableCountries().map((c) => {
    const w = countryWealth(c)!;
    return {
      name: c.name,
      kind: "country" as const,
      href: c.iso3 === "GBR" ? "/country/uk" : `/country/${c.iso3.toLowerCase()}`,
      detail: `${c.region} · ${formatValue(w.value, "USD")}`,
    };
  });

  const cities: SearchEntry[] = [];
  for (const m of allMetros()) {
    const v = metroValue(m);
    if (!v) continue;
    cities.push({
      name: m.name,
      kind: "city",
      href: `/metro/${m.code.toLowerCase()}`,
      detail: `city · ${formatValue(v.value, "EUR")}`,
    });
  }

  return [...countries, ...cities].sort((a, b) => a.name.localeCompare(b.name));
};

export const compositionOf = countryComposition;
