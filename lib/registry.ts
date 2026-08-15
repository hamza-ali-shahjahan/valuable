/**
 * The trace registry — hash to computation.
 *
 * Every trace in the graph is indexed, including nested ones, so any node a reader sees
 * is itself a linkable page. There is no leaf that is merely rendered rather than
 * addressable.
 */

import { ukValuation, type ClaimView } from "../engine/valuations.ts";
import { valuableCountries, countryWealth, countryWealthPerCapita } from "../engine/countries.ts";
import type { Trace, Traced } from "../engine/trace.ts";

export interface RegistryEntry {
  readonly hash: string;
  readonly trace: Trace;
  readonly value: number;
  readonly label: string;
  readonly isTopLevel: boolean;
  readonly publishable: boolean;
  readonly blockedBecause?: string;
  /** Which country page this belongs to, for the breadcrumb. */
  readonly country?: { iso3: string; name: string; href: string };
}

const index = new Map<string, RegistryEntry>();

const register = (
  t: Trace, value: number, label: string,
  opts: {
    isTopLevel: boolean; publishable: boolean; blockedBecause?: string;
    country?: { iso3: string; name: string; href: string };
  },
): void => {
  if (!index.has(t.hash)) {
    index.set(t.hash, { hash: t.hash, trace: t, value, label, ...opts });
  }
  for (const n of t.inputs) {
    if (n.kind === "derived") {
      register(n.trace, n.value, n.label, {
        isTopLevel: false, publishable: opts.publishable, country: opts.country,
      });
    }
  }
};

const shortLabel = (question: string): string => {
  const q = question.replace(/\?$/, "");
  return q.length > 60 ? `${q.slice(0, 57)}…` : q;
};

let built = false;

const build = (): void => {
  if (built) return;
  built = true;

  // --- the United Kingdom, on its own richer data -------------------------
  const uk = { iso3: "GBR", name: "United Kingdom", href: "/country/uk" };
  const v = ukValuation();

  const addClaim = (c: ClaimView): void =>
    register(c.traced.trace, c.traced.value, shortLabel(c.question), {
      isTopLevel: true, publishable: c.publishable,
      blockedBecause: c.blockedBecause, country: uk,
    });

  for (const c of v.claims) addClaim(c);
  addClaim(v.perCapita);

  const rg: Traced<number> = v.rMinusG;
  register(rg.trace, rg.value, "How debt compares with growth", {
    isTopLevel: true, publishable: true, country: uk,
  });

  // --- every other country, on World Bank data ----------------------------
  for (const c of valuableCountries()) {
    const country = { iso3: c.iso3, name: c.name, href: `/country/${c.iso3.toLowerCase()}` };
    const w = countryWealth(c);
    if (w) register(w.trace, w.value, shortLabel(w.trace.question), {
      isTopLevel: true, publishable: true, country,
    });
    const pc = countryWealthPerCapita(c);
    if (pc) register(pc.trace, pc.value, shortLabel(pc.trace.question), {
      isTopLevel: true, publishable: true, country,
    });
  }
};

export const lookup = (hash: string): RegistryEntry | undefined => {
  build();
  return index.get(hash);
};

export const allEntries = (): readonly RegistryEntry[] => {
  build();
  return [...index.values()];
};

export const allHashes = (): readonly string[] => allEntries().map((e) => e.hash);

export { ukValuation };
