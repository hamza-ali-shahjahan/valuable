#!/usr/bin/env bun
/**
 * Eurostat metropolitan regions. `bun run ingest:metros`
 *
 * Licence: Commission Decision 2011/833/EU — reuse for commercial purposes authorised
 * with attribution. Unambiguous, unlike most things in this field.
 *
 * WHY EUROPE ONLY. Of every economic measure at city level, only Europe, the US and
 * China publish anything official. India, most of Africa, most of South-East Asia and
 * Latin America have no official metro GDP at all — anyone selling "global metro GDP"
 * is reselling a commercial model. We ship what exists and say so.
 *
 * THREE LANDMINES, all found by measurement:
 *
 * 1. The `metroreg` dimension MIXES metro regions with country totals and
 *    "non-metropolitan regions" aggregates. Unfiltered, the largest "metro" in Europe is
 *    Germany. Genuine metros match [A-Z]{2}\d{3}M or MC.
 *
 * 2. Capital cities use the suffix MC, not M. A filter of `\d{3}M` alone silently drops
 *    Paris, Berlin, Madrid, Vienna, Warsaw, Prague, Stockholm and Amsterdam — every
 *    capital in Europe — while still returning 226 plausible-looking rows.
 *
 * 3. The series is FROZEN. Eurostat last updated it 2024-02-28 and 2022 is only
 *    fractionally populated (34 metros vs 255). We use 2021, the last complete year, and
 *    say so on every page.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const EU = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data";
const YEAR = 2021; // last complete year — see landmine 3
const OUT = fileURLToPath(new URL("../data/sources/", import.meta.url));

/** Genuine metro regions only. MC = capital metro, M = other metro. See landmines 1 and 2. */
const METRO_CODE = /^[A-Z]{2}\d{3}MC?$/;

const UA = "Valuable/0.2 (+https://github.com/hamza-ali-shahjahan/valuable)";

interface JsonStat {
  label: string;
  updated: string;
  value: Record<string, number>;
  dimension: {
    metroreg: { category: { label: Record<string, string>; index: Record<string, number> } };
  };
}

const fetchDataset = async (ds: string, query: string): Promise<{
  updated: string; label: string; rows: Map<string, { name: string; value: number }>;
}> => {
  const url = `${EU}/${ds}?format=JSON&lang=EN&${query}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} — ${url}`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("json")) throw new Error(`Expected JSON, got "${type}" — ${url}`);

  const d = (await res.json()) as JsonStat;
  if (!d.dimension?.metroreg) throw new Error(`No metroreg dimension in ${ds}`);

  const { label, index } = d.dimension.metroreg.category;
  const rows = new Map<string, { name: string; value: number }>();
  for (const code of Object.keys(label)) {
    if (!METRO_CODE.test(code)) continue; // drop country and non-metro aggregates
    const v = d.value[String(index[code])];
    if (v === undefined || v === null) continue;
    rows.set(code, { name: label[code]!.trim(), value: v });
  }
  if (rows.size === 0) throw new Error(`${ds} returned zero genuine metros`);
  return { updated: d.updated, label: d.label, rows };
};

const main = async () => {
  console.log("Valuable — Eurostat metropolitan regions\n");

  const gdp = await fetchDataset("met_10r_3gdp", `unit=MIO_EUR&time=${YEAR}`);
  console.log(`  GDP         ${String(gdp.rows.size).padStart(4)} metros · frozen at ${gdp.updated.slice(0, 10)}`);

  const pop = await fetchDataset("met_pjanaggr3", `sex=T&age=TOTAL&time=${YEAR}`);
  console.log(`  population  ${String(pop.rows.size).padStart(4)} metros · updated ${pop.updated.slice(0, 10)}`);

  // Sanity: capitals must be present. A filter that drops every capital in Europe still
  // returns hundreds of plausible rows, so this is checked explicitly (landmine 2).
  const capitals = [...gdp.rows.keys()].filter((k) => k.endsWith("MC"));
  console.log(`  capitals    ${String(capitals.length).padStart(4)} (Paris ${gdp.rows.has("FR001MC") ? "✓" : "✗ MISSING"})`);
  if (capitals.length < 15) {
    throw new Error(`Only ${capitals.length} capital metros — the code filter is wrong.`);
  }

  const metros = [...gdp.rows.entries()]
    .map(([code, g]) => {
      const p = pop.rows.get(code);
      return {
        code,
        name: g.name,
        country: code.slice(0, 2),
        isCapital: code.endsWith("MC"),
        gdpEur: g.value * 1e6, // published in millions
        population: p?.value ?? null,
      };
    })
    .filter((m) => m.population !== null)
    .sort((a, b) => b.gdpEur - a.gdpEur);

  console.log(`\n  ${metros.length} metros with both GDP and population`);
  console.log(`  ${new Set(metros.map((m) => m.country)).size} countries`);
  console.log(`  largest: ${metros.slice(0, 3).map((m) => `${m.name} €${(m.gdpEur / 1e9).toFixed(0)}bn`).join(" · ")}`);
  console.log(`\n  ⚠️  London is absent: the UK left the EU and Eurostat no longer publishes it.`);

  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}eurostat-metros.json`, JSON.stringify({
    source: "Eurostat",
    licence: "Commission Decision 2011/833/EU — commercial reuse authorised with attribution",
    attribution: "Eurostat, GDP and population by metropolitan region",
    url: "https://ec.europa.eu/eurostat/databrowser/view/met_10r_3gdp",
    year: YEAR,
    frozenAt: gdp.updated,
    datasets: { gdp: "met_10r_3gdp", population: "met_pjanaggr3" },
    note:
      "Eurostat's metropolitan GDP series was last updated 2024-02-28 and stops at 2022, " +
      "which is only fractionally populated. 2021 is the last complete year. London is " +
      "absent because the UK left the EU.",
    metros,
  }, null, 1));

  console.log(`\n  wrote data/sources/eurostat-metros.json\n`);
};

await main();
