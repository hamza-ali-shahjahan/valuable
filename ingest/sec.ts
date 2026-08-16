#!/usr/bin/env bun
/**
 * SEC EDGAR ingestion. `bun run ingest:sec`
 *
 * Licence: works of the US federal government are not subject to copyright
 * (17 U.S.C. §105). EDGAR data is public domain — the only condition is the SEC's fair
 * access policy: declare who you are in the User-Agent and stay under 10 requests/sec.
 *
 * WHY WE INGEST FILINGS RATHER THAN A RANKING. Forbes Global 2000 and Fortune 500 are
 * copyright as *compilations*, even though the underlying facts are not (see the refused
 * list on /sources). So we do not copy anyone's ranking. We read the accounts every US
 * public company is legally required to file, and build our own.
 *
 * Everything here is a FILED FACT. No market prices — those may never be stored
 * (docs/01-DATA-SPINE.md §7), which is why the share price is the one number the reader
 * types in themselves.
 *
 * THREE LANDMINES, all found by measurement:
 *
 * 1. THERE IS NO SINGLE REVENUE TAG. Since ASC 606 most filers use
 *    `RevenueFromContractWithCustomerExcludingAssessedTax` (2,961 filers for 2024),
 *    but 2,491 still use plain `Revenues`, and the two sets only partly overlap. Reading
 *    one tag alone silently loses a third of corporate America — including whole sectors,
 *    because tag choice correlates with industry. We try four tags in order.
 *
 * 2. INCOME-STATEMENT AND BALANCE-SHEET FACTS USE DIFFERENT PERIOD KEYS. Flows are
 *    `CY2024`; balances are `CY2024Q4I` ("I" for instant). Asking for `Assets` at `CY2024`
 *    returns *nothing at all* — not an error, just an empty set. Easy to mistake for a
 *    dead concept.
 *
 * 3. NOT EVERY COMPANY'S YEAR ENDS IN DECEMBER. Air Products closes 30 September; the
 *    retailers close in January. Joining `CY2024` revenue to `CY2024Q4I` balances would
 *    have silently paired a September income statement with a December balance sheet — or
 *    dropped those companies entirely. We pull all five instant quarters and match each
 *    company's balance sheet to within 45 days of its own year end.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const API = "https://data.sec.gov/api/xbrl/frames/us-gaap";
// fileURLToPath, NOT .pathname — see ingest/worldbank.ts.
const OUT = fileURLToPath(new URL("../data/sources/", import.meta.url));

/**
 * SEC fair access asks for an identifying User-Agent.
 *
 * A FOURTH LANDMINE, and a genuinely surprising one: their edge returns 403 for ANY
 * User-Agent containing a domain or URL. `Valuable (+https://github.com/…)` — the exact
 * string the World Bank ingest uses, and the normal convention for a bot — is rejected
 * outright. So the usual "point at the repo" contact route is not available here.
 *
 * Set SEC_CONTACT to an email if you are running this yourself; it is deliberately NOT
 * committed. Without it we still identify the project, just without a reply address.
 */
const UA = process.env.SEC_CONTACT
  ? `Valuable open-source valuation project ${process.env.SEC_CONTACT}`
  : "Valuable open-source valuation project";

/** The financial year we publish. Stated on every company page. */
const FY = 2024;

/** How many companies we publish. Ours, ranked by filed revenue. */
const PUBLISH = 250;

/** Landmine 1 — in preference order. First hit wins, and we record which one it was. */
const REVENUE_TAGS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "RevenueFromContractWithCustomerIncludingAssessedTax",
  "SalesRevenueNet",
] as const;

/**
 * Landmine 1 is not confined to revenue. Pre-tax income has two equally common tags
 * depending on whether the filer has equity-method investments — Amazon uses the second
 * and was dropped entirely by the first draft of this file. Debt is worse: some filers
 * split it current/non-current, others report a single total.
 */
const FLOW_TAGS: Record<string, readonly string[]> = {
  operatingIncome: ["OperatingIncomeLoss"],
  taxExpense: ["IncomeTaxExpenseBenefit"],
  pretaxIncome: [
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
  ],
};

const BALANCE_TAGS: Record<string, readonly string[]> = {
  assets: ["Assets"],
  currentLiabilities: ["LiabilitiesCurrent"],
  equity: ["StockholdersEquity"],
  cash: ["CashAndCashEquivalentsAtCarryingValue"],
  debtLongTerm: ["LongTermDebtNoncurrent"],
  debtShortTerm: ["LongTermDebtCurrent"],
  debtTotal: ["LongTermDebt"],
};

/** Landmine 3 — a fiscal year end can land in any of these. */
const INSTANT_FRAMES = [
  `CY${FY}Q1I`, `CY${FY}Q2I`, `CY${FY}Q3I`, `CY${FY}Q4I`, `CY${FY + 1}Q1I`,
] as const;

interface FrameRow {
  readonly cik: number;
  readonly entityName: string;
  readonly loc?: string;
  readonly start?: string;
  readonly end: string;
  readonly accn: string;
  readonly val: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fetchFrame = async (tag: string, frame: string): Promise<FrameRow[]> => {
  const url = `${API}/${tag}/USD/${frame}.json`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 404) return []; // concept genuinely unused in that period
    if (res.ok) {
      const j = (await res.json()) as { data?: FrameRow[] };
      return j.data ?? [];
    }
    await sleep(1000 * (attempt + 1)); // 429s are expected; back off rather than hammer
  }
  throw new Error(`SEC frame failed after 3 attempts: ${url}`);
};

const DAY = 86_400_000;
const daysApart = (a: string, b: string) =>
  Math.abs(new Date(a).getTime() - new Date(b).getTime()) / DAY;

export interface SecCompany {
  readonly cik: number;
  readonly name: string;
  readonly state?: string;
  /** Last day of the company's own financial year — not necessarily 31 December. */
  readonly fiscalYearEnd: string;
  /** Accession number of the filing every figure came from. Links to the document. */
  readonly accession: string;
  readonly revenue: number;
  /** Which of the four tags this company used. Landmine 1, made visible. */
  readonly revenueTag: string;
  readonly operatingIncome: number;
  readonly taxExpense: number;
  readonly pretaxIncome: number;
  readonly assets: number;
  readonly currentLiabilities: number;
  readonly equity: number;
  readonly cash: number;
  /** All interest-bearing borrowing, however the filer chose to tag it. */
  readonly debt: number;
  readonly debtSource: string;
  /** Balance sheet date actually used, so a mismatch cannot hide. */
  readonly balanceDate: string;
}

const main = async () => {
  console.log(`SEC EDGAR — US public company accounts, financial year ${FY}\n`);

  // --- flows -----------------------------------------------------------------
  // Revenue first, best tag wins per company.
  const revenue = new Map<number, { row: FrameRow; tag: string }>();
  for (const tag of REVENUE_TAGS) {
    const rows = await fetchFrame(tag, `CY${FY}`);
    let added = 0;
    for (const r of rows) if (!revenue.has(r.cik)) { revenue.set(r.cik, { row: r, tag }); added++; }
    console.log(`  ${tag}: ${rows.length} filers, ${added} new`);
    await sleep(200);
  }
  console.log(`  → ${revenue.size} companies with a revenue figure\n`);

  const flows: Record<string, Map<number, FrameRow>> = {};
  for (const [key, tags] of Object.entries(FLOW_TAGS)) {
    const byCik = new Map<number, FrameRow>();
    for (const tag of tags) {
      const rows = await fetchFrame(tag, `CY${FY}`);
      for (const r of rows) if (!byCik.has(r.cik)) byCik.set(r.cik, r);
      await sleep(200);
    }
    flows[key] = byCik;
    console.log(`  ${key}: ${byCik.size}`);
  }

  // --- balances, across every quarter a year end could fall in ---------------
  console.log("");
  const balances: Record<string, Map<number, FrameRow[]>> = {};
  for (const [key, tags] of Object.entries(BALANCE_TAGS)) {
    const byCik = new Map<number, FrameRow[]>();
    let total = 0;
    for (const tag of tags) {
      for (const frame of INSTANT_FRAMES) {
        const rows = await fetchFrame(tag, frame);
        total += rows.length;
        for (const r of rows) {
          const list = byCik.get(r.cik);
          if (list) list.push(r); else byCik.set(r.cik, [r]);
        }
        await sleep(200);
      }
    }
    balances[key] = byCik;
    console.log(`  ${key}: ${total} observations across ${byCik.size} companies`);
  }

  // --- join, matching each balance sheet to its own year end ------------------
  const companies: SecCompany[] = [];
  const dropped = new Map<string, number>();
  const drop = (why: string) => dropped.set(why, (dropped.get(why) ?? 0) + 1);

  for (const [cik, { row, tag }] of revenue) {
    const flow = (key: string): number | null => flows[key]?.get(cik)?.val ?? null;
    // Landmine 3: within 45 days of THIS company's year end, not of 31 December.
    const balance = (key: string): FrameRow | null => {
      const candidates = balances[key]?.get(cik) ?? [];
      let best: FrameRow | null = null;
      let bestGap = Infinity;
      for (const c of candidates) {
        const gap = daysApart(c.end, row.end);
        if (gap < bestGap) { best = c; bestGap = gap; }
      }
      return bestGap <= 45 ? best : null;
    };

    const operatingIncome = flow("operatingIncome");
    const taxExpense = flow("taxExpense");
    const pretaxIncome = flow("pretaxIncome");
    const assets = balance("assets");
    const currentLiabilities = balance("currentLiabilities");
    const equity = balance("equity");
    const cash = balance("cash");
    const debtLongTerm = balance("debtLongTerm");
    const debtShortTerm = balance("debtShortTerm");
    const debtTotal = balance("debtTotal");

    if (operatingIncome === null) { drop("no operating income tagged"); continue; }
    if (taxExpense === null || pretaxIncome === null) { drop("no tax detail tagged"); continue; }
    if (!assets || !equity || !cash) { drop("balance sheet incomplete"); continue; }
    if (!currentLiabilities) { drop("no current liabilities (banks and insurers)"); continue; }

    // Either the split, or a single total. One component alone would silently understate
    // borrowing, which flatters the return on capital — so we drop instead of guessing.
    const split = debtLongTerm !== null && debtShortTerm !== null;
    if (!split && debtTotal === null) { drop("borrowing not tagged completely"); continue; }

    companies.push({
      cik,
      name: row.entityName.trim(),
      state: row.loc,
      fiscalYearEnd: row.end,
      accession: row.accn,
      revenue: row.val,
      revenueTag: tag,
      operatingIncome,
      taxExpense,
      pretaxIncome,
      assets: assets.val,
      currentLiabilities: currentLiabilities.val,
      equity: equity.val,
      cash: cash.val,
      debt: split ? debtLongTerm!.val + debtShortTerm!.val : debtTotal!.val,
      debtSource: split ? "split into current and non-current" : "reported as one total",
      balanceDate: assets.end,
    });
  }

  companies.sort((a, b) => b.revenue - a.revenue);
  const published = companies.slice(0, PUBLISH);

  console.log(`\n  ${companies.length} companies have a complete set of accounts.`);
  console.log("  Dropped:");
  for (const [why, n] of [...dropped].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${n.toString().padStart(5)}  ${why}`);
  }

  // A ranking that lost Walmart or Amazon would be wrong in a way that still looks
  // plausible — exactly the failure mode landmine 3 produces. Fail loudly instead.
  const names = published.map((c) => c.name.toUpperCase()).join(" | ");
  const mustHave = ["WALMART", "AMAZON", "APPLE", "ALPHABET", "MICROSOFT"];
  const missing = mustHave.filter((m) => !names.includes(m));
  if (missing.length > 0) {
    throw new Error(
      `INGEST FAILED: the largest US companies are missing from the top ${PUBLISH} — ` +
      `${missing.join(", ")}. A ranking that loses these is broken, not incomplete.`,
    );
  }

  const nonDecember = published.filter((c) => !c.fiscalYearEnd.endsWith("-12-31")).length;
  console.log(`\n  Publishing the top ${published.length} by revenue.`);
  console.log(`  ${nonDecember} of them do not close on 31 December (landmine 3 was real).`);
  console.log(`  Largest: ${published[0]!.name} — $${(published[0]!.revenue / 1e9).toFixed(1)}bn`);
  console.log(`  Smallest published: ${published.at(-1)!.name} — $${(published.at(-1)!.revenue / 1e9).toFixed(1)}bn`);

  await mkdir(OUT, { recursive: true });
  await writeFile(
    `${OUT}sec-companies.json`,
    JSON.stringify(
      {
        source: "SEC EDGAR XBRL frames API",
        url: "https://data.sec.gov/api/xbrl/frames/",
        licence: "Public domain — 17 U.S.C. §105 (works of the US federal government)",
        fiscalYear: FY,
        note:
          "Our own ranking, built from filed accounts. No third-party ranking was copied " +
          "and no market data is stored.",
        universe: companies.length,
        published: published.length,
        companies: published,
      },
      null,
      1,
    ),
  );
  console.log(`\n  Wrote ${OUT}sec-companies.json`);
};

if (import.meta.main) await main();
