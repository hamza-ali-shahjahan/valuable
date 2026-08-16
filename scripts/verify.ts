#!/usr/bin/env bun
/**
 * `bun run verify` — recompute every published number from its recorded inputs and
 * assert the hash matches.
 *
 * This is the command a sceptic runs. It is also a CI gate: exit code 1 on any drift.
 *
 * SPEC.md §3, §6.
 */

import { ukValuation } from "../engine/valuations.ts";
import { valuableCountries, countryWealth, countryWealthPerCapita } from "../engine/countries.ts";
import { allMetros, metroValue } from "../engine/metros.ts";
import {
  verify, leaves, sources, assumptions, allWarnings, depth, challengeUrl,
  formatValue, ENGINE_VERSION, type Trace, type Traced,
} from "../engine/trace.ts";

const BOLD = "\x1b[1m", DIM = "\x1b[2m", RESET = "\x1b[0m";
const GREEN = "\x1b[32m", RED = "\x1b[31m", YELLOW = "\x1b[33m", CYAN = "\x1b[36m";



const printTrail = (t: Trace, indent = "  "): void => {
  console.log(`${indent}${DIM}${t.formula}${RESET}  ${DIM}(${t.ref})${RESET}`);
  for (const n of t.inputs) {
    switch (n.kind) {
      case "observed":
        console.log(
          `${indent}  ${GREEN}●${RESET} ${n.label.padEnd(44)} ${formatValue(n.value, n.unit).padStart(11)}` +
          `  ${DIM}${n.source} · ${n.asOf}${RESET}` +
          (n.needsVerification ? `  ${YELLOW}[unverified]${RESET}` : ""),
        );
        break;
      case "assumption":
        console.log(
          `${indent}  ${YELLOW}◆${RESET} ${n.label.padEnd(44)} ${formatValue(n.value, n.unit).padStart(11)}` +
          `  ${DIM}assumption${RESET}`,
        );
        break;
      case "derived":
        console.log(
          `${indent}  ${CYAN}▸${RESET} ${n.label.padEnd(44)} ${formatValue(n.value, n.trace.unit).padStart(11)}` +
          `  ${DIM}${n.trace.hash.slice(0, 8)}…${RESET}`,
        );
        printTrail(n.trace, `${indent}    `);
        break;
    }
  }
  for (const s of t.steps) {
    console.log(`${indent}  ${DIM}= ${s.label}: ${s.expression}${RESET}`);
  }
};

let failures = 0;
let checked = 0;

console.log(`\n${BOLD}Valuable — verification${RESET}  ${DIM}engine ${ENGINE_VERSION}${RESET}\n`);

const v = ukValuation();
const items: ReadonlyArray<{ name: string; traced: Traced<number>; publishable: boolean; blockedBecause?: string }> = [
  ...v.claims.map((c) => ({
    name: c.question, traced: c.traced,
    publishable: c.publishable, blockedBecause: c.blockedBecause,
  })),
  { name: "r − g (the master variable)", traced: v.rMinusG, publishable: true },
  { name: v.perCapita.question + " [per capita]", traced: v.perCapita.traced,
    publishable: v.perCapita.publishable, blockedBecause: v.perCapita.blockedBecause },
];

for (const item of items) {
  checked++;
  const { trace: t, value } = item.traced;
  const result = verify(t, value);

  const mark = result.ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  const gate = item.publishable ? "" : `  ${YELLOW}[withheld]${RESET}`;

  console.log(`${mark} ${BOLD}${item.name}${RESET}${gate}`);
  console.log(`  ${BOLD}${formatValue(value, t.unit)}${RESET}   ${DIM}${t.hash.slice(0, 16)}…${RESET}`);

  printTrail(t);

  const warns = allWarnings(t);
  for (const w of warns) console.log(`  ${YELLOW}!${RESET} ${DIM}${w}${RESET}`);

  console.log(
    `  ${DIM}${leaves(t).length} inputs · ${sources(t).length} source(s) · ` +
    `${assumptions(t).length} assumption(s) · depth ${depth(t)}${RESET}`,
  );

  if (!item.publishable) {
    console.log(`  ${YELLOW}withheld:${RESET} ${DIM}${item.blockedBecause?.split(".")[0]}.${RESET}`);
  }

  if (!result.ok) {
    failures++;
    for (const p of result.problems) console.log(`  ${RED}${p}${RESET}`);
  }

  console.log(`  ${DIM}challenge: ${challengeUrl(t)}${RESET}`);
  console.log();
}

// --- every country, summarised (detail would be 300 pages of output) ------------
console.log(`${BOLD}Every other country${RESET}  ${DIM}World Bank, one method applied identically${RESET}\n`);

let cOk = 0, cBad: string[] = [];
for (const c of valuableCountries()) {
  for (const t of [countryWealth(c), countryWealthPerCapita(c)]) {
    if (!t) continue;
    checked++;
    if (verify(t.trace, t.value).ok) cOk++;
    else { cBad.push(c.iso3); failures++; }
  }
}
console.log(`  ${cOk === checked - items.length ? GREEN + "✓" + RESET : RED + "✗" + RESET} ` +
  `${cOk} country calculations verified across ${valuableCountries().length} countries`);
if (cBad.length) console.log(`  ${RED}failed: ${[...new Set(cBad)].join(", ")}${RESET}`);
console.log();

// --- European metros, summarised -----------------------------------------------
console.log(`${BOLD}Europe's cities${RESET}  ${DIM}Eurostat, capital share of city output${RESET}\n`);

let mOk = 0; const mBad: string[] = [];
for (const m of allMetros()) {
  const v = metroValue(m);
  if (!v) continue;
  checked++;
  if (verify(v.trace, v.value).ok) mOk++;
  else { mBad.push(m.code); failures++; }
}
console.log(`  ${mBad.length === 0 ? GREEN + "✓" + RESET : RED + "✗" + RESET} ` +
  `${mOk} city calculations verified across ${allMetros().length} metropolitan regions`);
if (mBad.length) console.log(`  ${RED}failed: ${mBad.join(", ")}${RESET}`);
console.log();

// Country calculations all publish; only the UK per-capita figure is held back.
const withheld = items.filter((i) => !i.publishable).length;
const published = checked - withheld;

if (failures === 0) {
  console.log(
    `${GREEN}${BOLD}✓ ${checked} computations verified${RESET} — every hash recomputed from ` +
    `its recorded inputs and matched.`,
  );
  console.log(`${DIM}  ${published} published · ${withheld} withheld pending source verification.${RESET}\n`);
  process.exit(0);
} else {
  console.log(`${RED}${BOLD}✗ ${failures} of ${checked} computations failed verification.${RESET}\n`);
  process.exit(1);
}
