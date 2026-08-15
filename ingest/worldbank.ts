#!/usr/bin/env bun
/**
 * World Bank ingestion. `bun run ingest`
 *
 * Licence: CC BY 4.0 — commercial redistribution permitted with attribution. This is the
 * single most product-viable dataset in the field (docs/01-DATA-SPINE.md §1).
 *
 * Results are cached to data/sources/ and committed, so builds are reproducible offline
 * and a published fingerprint never depends on an API being up.
 *
 * TWO LANDMINES, both found by measurement rather than by reading docs:
 *
 * 1. Comprehensive wealth is published as a CHAINED VOLUME INDEX in the "real chained
 *    2019 US$" series — and chained indices are NOT ADDITIVE. Summing the components of
 *    that series overshoots the total by ~0.2%. We therefore use the CURRENT US$ series
 *    (`.CD`) throughout, which does reconcile.
 *
 * 2. `NW.NFA.TO` is GROSS foreign assets (UK: +$17tn), not net. Net foreign assets is
 *    total minus domestic wealth (UK: −$0.53tn, which matches the sign of the ONS
 *    figure). Using the gross series would have inflated every country enormously.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const API = "https://api.worldbank.org/v2";
const CWON_SOURCE = 59; // "Wealth Accounts"
const CWON_YEAR = 2020; // CWON 2024 edition ends here. Stated on every page.
// fileURLToPath, NOT .pathname — a URL percent-encodes spaces, so on a path like
// "Valuation - Valuable" .pathname silently writes to "Valuation%20-%20Valuable".
const OUT = fileURLToPath(new URL("../data/sources/", import.meta.url));

/** Current US$ series only — see landmine 1. */
const CWON = {
  total: "NW.TOW.TO.CD",
  domestic: "NW.DOW.TO.CD",
  produced: "NW.PCA.TO.IN.CD",
  human: "NW.HCA.TO.CD",
  naturalRenewable: "NW.NCA.TOTL.TO.CD",
} as const;

const WDI = {
  gdp: "NY.GDP.MKTP.CD",
  population: "SP.POP.TOTL",
  gdpGrowth: "NY.GDP.MKTP.KD.ZG",
  debtToGdp: "GC.DOD.TOTL.GD.ZS",
} as const;

const UA = "Valuable/0.2 (+https://github.com/hamza-ali-shahjahan/valuable)";

interface WbRow {
  countryiso3code: string;
  date: string;
  value: number | null;
}

const fetchJson = async (url: string): Promise<unknown> => {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  const type = res.headers.get("content-type") ?? "";
  // Guard learned from BEA: a 200 with an HTML body is a 404 wearing a disguise.
  if (!type.includes("json")) {
    throw new Error(`Expected JSON, got "${type}" — ${url}`);
  }
  return res.json();
};

/** One indicator, every country, one call. */
const fetchIndicator = async (
  code: string, opts: { source?: number; date: string },
): Promise<Map<string, number>> => {
  const src = opts.source ? `&source=${opts.source}` : "";
  const url = `${API}/country/all/indicator/${code}?format=json&date=${opts.date}${src}&per_page=20000`;
  const body = await fetchJson(url);

  if (!Array.isArray(body) || body.length < 2 || !Array.isArray(body[1])) {
    const msg = (body as { message?: { key: string; value: string }[] })?.message?.[0];
    throw new Error(`No data for ${code}${msg ? ` — ${msg.value}` : ""}`);
  }

  const out = new Map<string, number>();
  for (const row of body[1] as WbRow[]) {
    if (row.value === null || !row.countryiso3code) continue;
    // Keep the most recent non-null observation per country.
    const existing = out.get(row.countryiso3code);
    if (existing === undefined) out.set(row.countryiso3code, row.value);
  }
  if (out.size === 0) throw new Error(`${code} returned zero observations`);
  return out;
};

interface CountryMeta {
  iso3: string;
  name: string;
  region: string;
  incomeLevel: string;
}

const fetchCountries = async (): Promise<CountryMeta[]> => {
  const body = await fetchJson(`${API}/country?format=json&per_page=400`) as [
    unknown,
    Array<{
      id: string; name: string;
      region: { id: string; value: string };
      incomeLevel: { value: string };
    }>,
  ];
  return body[1]
    // region id "NA" marks aggregates like "World" and "Euro area" — not countries.
    .filter((c) => c.region.id !== "NA")
    .map((c) => ({
      iso3: c.id, name: c.name,
      region: c.region.value, incomeLevel: c.incomeLevel.value,
    }));
};

const main = async () => {
  console.log("Valuable — World Bank ingestion\n");

  const countries = await fetchCountries();
  console.log(`  countries (aggregates excluded)  ${countries.length}`);

  const series: Record<string, Record<string, number>> = {};

  for (const [key, code] of Object.entries(CWON)) {
    const m = await fetchIndicator(code, { source: CWON_SOURCE, date: String(CWON_YEAR) });
    series[key] = Object.fromEntries(m);
    console.log(`  ${key.padEnd(18)} ${code.padEnd(20)} ${String(m.size).padStart(4)} countries`);
  }

  for (const [key, code] of Object.entries(WDI)) {
    // Recent window, most recent non-null per country.
    const m = await fetchIndicator(code, { date: "2020:2025" });
    series[key] = Object.fromEntries(m);
    console.log(`  ${key.padEnd(18)} ${code.padEnd(20)} ${String(m.size).padStart(4)} countries`);
  }

  // Reconciliation check — refuse to write a snapshot whose components don't add up.
  let checked = 0, failed = 0;
  for (const iso of Object.keys(series.total ?? {})) {
    const t = series.total?.[iso], d = series.domestic?.[iso];
    const p = series.produced?.[iso], h = series.human?.[iso], n = series.naturalRenewable?.[iso];
    if ([t, d, p, h, n].some((x) => x === undefined)) continue;
    checked++;
    // Domestic must be at least the sum of the components we can see; the remainder is
    // nonrenewable natural capital, which is never negative.
    const nonRenewable = d! - (p! + h! + n!);
    if (nonRenewable < -Math.abs(d!) * 0.02) {
      failed++;
      console.error(`  ✗ ${iso}: implied nonrenewable capital is negative (${(nonRenewable / 1e9).toFixed(1)}bn)`);
    }
  }
  console.log(`\n  reconciled ${checked - failed}/${checked} countries`);
  if (failed > checked * 0.05) throw new Error("Too many countries fail reconciliation — not writing.");

  await mkdir(OUT, { recursive: true });
  const snapshot = {
    source: "World Bank Open Data",
    licence: "CC BY 4.0",
    attribution: "World Bank, World Development Indicators and the Changing Wealth of Nations",
    url: "https://data.worldbank.org",
    cwonYear: CWON_YEAR,
    cwonEdition: "Changing Wealth of Nations 2024",
    codes: { ...CWON, ...WDI },
    countries,
    series,
  };
  await writeFile(`${OUT}worldbank.json`, JSON.stringify(snapshot, null, 1));

  const withWealth = Object.keys(series.total ?? {}).length;
  console.log(`\n  wrote data/sources/worldbank.json`);
  console.log(`  ${withWealth} countries have comprehensive wealth · CWON ${CWON_YEAR}\n`);
};

await main();
