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
  const countries = valuableCountries();

  // --- biggest is not richest ------------------------------------------------
  const byTotal = countries;
  const byPerson = countries
    .map((c) => ({ c, pc: countryWealthPerCapita(c) }))
    .filter((x) => x.pc !== null)
    .sort((a, b) => b.pc!.value - a.pc!.value);

  const india = countries.find((c) => c.iso3 === "IND");
  if (india) {
    const rankTotal = byTotal.findIndex((c) => c.iso3 === "IND") + 1;
    const rankPerson = byPerson.findIndex((x) => x.c.iso3 === "IND") + 1;
    const chinaTotal = byTotal.findIndex((c) => c.iso3 === "CHN") + 1;
    const chinaPerson = byPerson.findIndex((x) => x.c.iso3 === "CHN") + 1;
    out.push({
      headline: `India is the ${ordinal(rankTotal)} wealthiest country and the ${ordinal(rankPerson)} wealthiest per person.`,
      body:
        `The same figures, divided by how many people share them, produce a completely ` +
        `different world. China moves from ${ordinal(chinaTotal)} to ${ordinal(chinaPerson)}. ` +
        `Ranking by total tells you about power; ranking per person tells you about the ` +
        `country you would actually live in.`,
      action: "See both rankings",
      href: "/countries",
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

  // --- whose wealth is a commodity bet --------------------------------------
  const exposed = countries
    .map((c) => ({ c, k: countryComposition(c) }))
    .filter((x) => x.k !== null && x.k.total > 3e11)
    .sort((a, b) => b.k!.natural - a.k!.natural);
  const top = exposed[0];
  if (top) {
    out.push({
      headline: `${pct(top.k!.natural)} of ${top.c.name}'s wealth is what is under the ground.`,
      body:
        `For a handful of countries, most of what they are worth is oil, gas and minerals ` +
        `priced at one moment in time. It depletes as it is pulled out, and the total moves ` +
        `with markets nobody there controls. That is a very different thing to own than a ` +
        `skilled workforce.`,
      action: `See what ${top.c.name} is made of`,
      href: `/country/${top.c.iso3.toLowerCase()}`,
    });
  }

  // --- the lever with the most force, framed universally --------------------
  const anchor = countries.find((c) => c.iso3 === "IND") ?? countries[0];
  const anchorWealth = anchor ? countryWealth(anchor) : null;
  if (anchor && anchorWealth) {
    out.push({
      headline: "One number nobody measured decides about a quarter of any country's wealth.",
      body:
        `Most of what a country is worth is its people — and valuing people means choosing ` +
        `what future earnings are worth today. Nobody measures that number; every ` +
        `statistics office picks one. Move it a single percentage point and the answer ` +
        `moves by roughly a quarter.`,
      action: "Drag it yourself",
      href: `/trace/${anchorWealth.trace.hash}`,
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

  // --- the same country, measured twice -------------------------------------
  const ons = ukComprehensiveWealth();
  const gbr = findCountry("GBR");
  const wbUk = gbr ? countryWealth(gbr) : null;
  if (wbUk) {
    out.push({
      headline: "Measure one country twice, by two official bodies, and get answers £20 trillion apart.",
      body:
        `Britain happens to be measured by both its own statisticians and the World Bank, ` +
        `so the gap is visible: ${formatValue(ons.value, "GBP")} against ` +
        `${formatValue(wbUk.value, "USD")}. Neither is wrong. Every country's figure rests ` +
        `on choices like these — most just never get a second opinion.`,
      action: "See both, and what separates them",
      href: "/country/uk",
    });
  }

  return out;
};

const ordinal = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
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
