/**
 * Every source behind every number — computed from what is actually in use.
 *
 * A hand-maintained sources page rots the moment someone adds a dataset. This one asks
 * the engine which sources the published figures actually depend on, and counts them.
 * If a source stops being used it disappears from the page by itself.
 */

import { ukValuation } from "./valuations.ts";
import { valuableCountries, countryWealth, countryWealthPerCapita } from "./countries.ts";
import { allMetros, metroValue } from "./metros.ts";
import { leaves, type Trace } from "./trace.ts";

export interface SourceUsage {
  readonly name: string;
  readonly url?: string;
  /** How many published figures depend on this source. */
  readonly figures: number;
  /** Earliest and latest observation dates in use. */
  readonly earliest: string;
  readonly latest: string;
  /** Whether anything from this source is still unconfirmed. */
  readonly unverified: number;
  readonly licence: string;
  readonly redistributable: boolean;
  readonly feeds: string;
  /** A published figure that uses it, so a reader can go and check. */
  readonly example?: { label: string; href: string };
}

/** Licence facts live here because they are not properties of a number. */
const LICENCES: Record<string, { licence: string; redistributable: boolean; feeds: string; url?: string }> = {
  "World Bank": {
    licence: "CC BY 4.0 — reuse and commercial use permitted with attribution",
    redistributable: true,
    feeds: "What every country owns, what its people will earn, and what its land holds",
    url: "https://data.worldbank.org",
  },
  "Eurostat": {
    licence: "Commission Decision 2011/833/EU — commercial reuse authorised with attribution",
    redistributable: true,
    feeds: "What each European city produces, and how many people live there",
    url: "https://ec.europa.eu/eurostat/databrowser/view/met_10r_3gdp",
  },
  "ONS": {
    licence: "Open Government Licence v3.0 — commercial exploitation permitted",
    redistributable: true,
    feeds: "Britain's national balance sheet and the value of its people",
    url: "https://www.ons.gov.uk",
  },
  "OBR": {
    licence: "Open Government Licence v3.0 — commercial exploitation permitted",
    redistributable: true,
    feeds: "Britain's debt, borrowing costs and growth",
    url: "https://obr.uk",
  },
  "FTSE": {
    licence: "Shown as a signal only, never summed into a total",
    redistributable: false,
    feeds: "The stock-market value of London-listed companies",
  },
};

const family = (source: string): string => {
  if (/world bank|changing wealth/i.test(source)) return "World Bank";
  if (/eurostat/i.test(source)) return "Eurostat";
  if (/^ons |office for national/i.test(source)) return "ONS";
  if (/obr|budget responsibility/i.test(source)) return "OBR";
  if (/ftse/i.test(source)) return "FTSE";
  return source;
};

const publishedTraces = (): { trace: Trace; label: string; href: string }[] => {
  const out: { trace: Trace; label: string; href: string }[] = [];
  const v = ukValuation();
  for (const c of v.claims) {
    out.push({ trace: c.traced.trace, label: `United Kingdom`, href: "/country/uk" });
  }
  out.push({ trace: v.rMinusG.trace, label: "United Kingdom", href: "/country/uk" });
  // Include the figure we are HOLDING BACK. Its unconfirmed input is exactly what this
  // page should surface — an unchecked source is the most useful thing to report.
  out.push({ trace: v.perCapita.traced.trace, label: "United Kingdom", href: "/country/uk" });

  for (const c of valuableCountries()) {
    const w = countryWealth(c);
    if (w) out.push({
      trace: w.trace, label: c.name,
      href: c.iso3 === "GBR" ? "/country/uk" : `/country/${c.iso3.toLowerCase()}`,
    });
    const pc = countryWealthPerCapita(c);
    if (pc) out.push({
      trace: pc.trace, label: c.name,
      href: c.iso3 === "GBR" ? "/country/uk" : `/country/${c.iso3.toLowerCase()}`,
    });
  }

  for (const m of allMetros()) {
    const mv = metroValue(m);
    if (mv) out.push({
      trace: mv.trace, label: m.name, href: `/metro/${m.code.toLowerCase()}`,
    });
  }
  return out;
};

export const sourcesInUse = (): readonly SourceUsage[] => {
  const acc = new Map<string, {
    figures: number; dates: string[]; unverified: number; url?: string;
    example?: { label: string; href: string };
  }>();

  for (const { trace, label, href } of publishedTraces()) {
    // Count each source once per published figure, not once per input.
    const seenHere = new Set<string>();
    for (const leaf of leaves(trace)) {
      if (leaf.kind !== "observed") continue;
      const key = family(leaf.source);
      const rec = acc.get(key) ?? { figures: 0, dates: [], unverified: 0 };
      if (!seenHere.has(key)) { rec.figures++; seenHere.add(key); }
      rec.dates.push(leaf.asOf);
      if (leaf.needsVerification) rec.unverified++;
      if (!rec.url && leaf.url) rec.url = leaf.url;
      if (!rec.example) rec.example = { label, href };
      acc.set(key, rec);
    }
  }

  return [...acc.entries()]
    .map(([name, rec]) => {
      const meta = LICENCES[name];
      const dates = [...rec.dates].sort();
      return {
        name,
        url: meta?.url ?? rec.url,
        figures: rec.figures,
        earliest: dates[0] ?? "—",
        latest: dates[dates.length - 1] ?? "—",
        unverified: rec.unverified,
        licence: meta?.licence ?? "Licence not recorded — do not redistribute until checked",
        redistributable: meta?.redistributable ?? false,
        feeds: meta?.feeds ?? "—",
        example: rec.example,
      };
    })
    .sort((a, b) => b.figures - a.figures);
};

/**
 * What we refuse to use, and why.
 *
 * The more persuasive half of the page: a list of what we turned down is stronger
 * evidence of care than a list of what we used.
 */
export const REFUSED: ReadonlyArray<{ name: string; why: string }> = [
  { name: "BIS statistics",
    why: "Their terms require that commercial use bring no additional charge to users. Any paid tier would breach that." },
  { name: "Transparency International's corruption index",
    why: "Published under a no-derivatives licence, which forbids building a blended score — exactly what a valuation does." },
  { name: "Forbes Global 2000, Fortune 500",
    why: "The ranking itself is copyright, even though the underlying facts are not. We build our own ranking instead." },
  { name: "Yahoo Finance and the retail market-data APIs",
    why: "All carry personal-use or internal-use clauses. Market data has to be called live, never stored." },
  { name: "Crunchbase, PitchBook, CB Insights, Dealroom",
    why: "Contractual no-redistribution at every tier, at any price we would pay." },
  { name: "Credit ratings and default-swap spreads",
    why: "Licensed intellectual property. No free route exists." },
  { name: "OpenStreetMap",
    why: "Its share-alike licence could compel us to open our whole derived database." },
  { name: "V-Dem",
    why: "Their licence page returns an error. Unread means unused." },
  { name: "Oxford Economics, Numbeo, Mercer",
    why: "Paid and copyrighted — and Oxford Economics sits underneath most 'global city GDP' figures in circulation." },
];
