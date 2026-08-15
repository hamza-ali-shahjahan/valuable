/**
 * Country valuation. docs/00-FIRST-PRINCIPLES.md §2
 *
 * The governing idea (§2.0): "How much is X worth?" has FOUR different right answers
 * spanning an order of magnitude. We never blend them.
 */

import { range, bandFromRateShock, type Range, type Sourced } from "./core.ts";
import {
  MATURE_MARKET_ERP, EQUITY_BOND_VOL_MULTIPLIER, FISCAL_FATIGUE_THRESHOLD_DEBT_GDP,
} from "./constants.ts";

/** Which claim is being valued. These are not interchangeable. */
export type CountryClaim =
  | "national_net_worth"      // SNA balance sheet — what the country owns
  | "comprehensive_wealth"    // + human and natural capital
  | "sovereign_fiscal_capacity" // what the STATE's claim is worth
  | "listed_equity";          // market cap of domiciled listed companies

export const CLAIM_QUESTION: Record<CountryClaim, string> = {
  national_net_worth: "What does the country own today, minus what it owes?",
  comprehensive_wealth: "What is it worth once you count its people too?",
  sovereign_fiscal_capacity: "What is the government's own claim on all that worth?",
  listed_equity: "What are its stock-market listed companies worth?",
};

// ---------------------------------------------------------------------------
// C1 — National balance sheet
// ---------------------------------------------------------------------------

export interface BalanceSheetInputs {
  readonly producedAssets: number;
  readonly nonProducedAssets: number; // predominantly land
  readonly netFinancialWorth: number; // ~ net international investment position
}

export interface BalanceSheetResult {
  readonly netWorth: number;
  /** Land as a share of net worth. Above ~0.4 the "valuation" is a house-price index. */
  readonly landShare: number;
  readonly landDominated: boolean;
}

export const nationalNetWorth = (i: BalanceSheetInputs): BalanceSheetResult => {
  const netWorth = i.producedAssets + i.nonProducedAssets + i.netFinancialWorth;
  const landShare = i.nonProducedAssets / netWorth;
  return { netWorth, landShare, landDominated: landShare > 0.4 };
};

// ---------------------------------------------------------------------------
// C2 — Comprehensive wealth
// ---------------------------------------------------------------------------

/**
 * Which human-capital convention a figure was computed under.
 *
 * INVARIANT 10: ONS and CWON human capital may never be blended. ONS uses r=3.5%
 * WITH 2% productivity growth (effective net discount ~1.5%), ages 16-65. CWON 2024
 * uses r=4% with ZERO growth, ages 15-65.
 *
 * INVARIANT 16: CWON 2024 discontinued the wage-growth factor, so CWON 2021 and
 * CWON 2024 human capital are not comparable either.
 */
export type HumanCapitalConvention = "ONS" | "CWON_2024" | "CWON_2021";

export const HUMAN_CAPITAL_CONVENTIONS: Record<HumanCapitalConvention, {
  discountRate: number; wageGrowth: number; ageRange: [number, number];
}> = {
  ONS:       { discountRate: 0.035, wageGrowth: 0.02, ageRange: [16, 65] },
  CWON_2024: { discountRate: 0.04,  wageGrowth: 0.0,  ageRange: [15, 65] },
  CWON_2021: { discountRate: 0.04,  wageGrowth: 0.02, ageRange: [15, 65] },
};

export interface ComprehensiveWealthInputs {
  readonly producedCapital: number;
  readonly naturalCapital: number;
  readonly humanCapital: number;
  readonly humanCapitalConvention: HumanCapitalConvention;
  readonly netForeignAssets: number;
}

export class ConventionMismatchError extends Error {}

/**
 * Sum of comprehensive wealth components, with the convention carried through so a
 * downstream comparison can refuse to mix.
 */
export const comprehensiveWealth = (i: ComprehensiveWealthInputs) => ({
  total: i.producedCapital + i.naturalCapital + i.humanCapital + i.netForeignAssets,
  convention: i.humanCapitalConvention,
  components: {
    produced: i.producedCapital,
    natural: i.naturalCapital,
    human: i.humanCapital,
    netForeignAssets: i.netForeignAssets,
  },
});

/** INVARIANT 10/16 enforcement: refuse to compare across conventions. */
export const assertSameConvention = (
  a: { convention: HumanCapitalConvention }, b: { convention: HumanCapitalConvention },
): void => {
  if (a.convention !== b.convention) {
    throw new ConventionMismatchError(
      `INVARIANT 10/16 violated: cannot compare human capital computed under ` +
      `${a.convention} with ${b.convention}. Different discount rate, different ` +
      `growth assumption, different age range. See docs §2.2.`,
    );
  }
};

/**
 * Human capital is ~60% of global wealth and moves near 1:1 with the discount rate.
 * ONS: a 1pp change in r produces a similar-magnitude change in the opposite direction.
 */
export const humanCapitalRateSensitivity = (stock: number, deltaRatePp: number): number =>
  stock * -deltaRatePp;

// ---------------------------------------------------------------------------
// C3 — Sovereign fiscal capacity, and the debt dynamics that gate it
// ---------------------------------------------------------------------------

export interface DebtDynamicsInputs {
  /** Debt as a fraction of GDP, e.g. 0.945 */
  readonly debtToGdp: number;
  /** Effective nominal interest rate on the debt stock. */
  readonly r: number;
  /** Nominal GDP growth. */
  readonly g: number;
  /** Primary balance as a fraction of GDP (positive = surplus). */
  readonly primaryBalance: number;
}

export interface DebtDynamicsResult {
  /** d_{t+1} = d_t (1+r)/(1+g) - pb */
  readonly nextDebtToGdp: number;
  /** The snowball term: d(r-g)/(1+g). Negative when r < g. */
  readonly snowball: number;
  /** pb* = d (r-g)/(1+g) — the primary balance that holds debt flat. */
  readonly debtStabilisingPrimaryBalance: number;
  /** r - g, the master variable (INVARIANT 17). */
  readonly rMinusG: number;
  /** Gap between actual and required primary balance. Negative = debt rising. */
  readonly fiscalGap: number;
  /** Ghosh et al. (2013): fatigue empirically sets in around 100% of GDP. */
  readonly beyondFiscalFatigue: boolean;
  readonly distressed: boolean;
}

/**
 * INVARIANT 8: a sovereign valuation must satisfy debt dynamics or be flagged
 * distressed. This is what stops Argentina being valued at UK multiples.
 */
export const debtDynamics = (i: DebtDynamicsInputs): DebtDynamicsResult => {
  const { debtToGdp: d, r, g, primaryBalance: pb } = i;
  const rMinusG = r - g;
  const snowball = (d * rMinusG) / (1 + g);
  const nextDebtToGdp = (d * (1 + r)) / (1 + g) - pb;
  const debtStabilisingPrimaryBalance = snowball;
  const fiscalGap = pb - debtStabilisingPrimaryBalance;
  const beyondFiscalFatigue = d > FISCAL_FATIGUE_THRESHOLD_DEBT_GDP;

  return {
    nextDebtToGdp,
    snowball,
    debtStabilisingPrimaryBalance,
    rMinusG,
    fiscalGap,
    beyondFiscalFatigue,
    // Distressed when debt is rising AND already past the empirical fatigue point.
    distressed: fiscalGap < 0 && beyondFiscalFatigue,
  };
};

/**
 * Sensitivity of the required primary balance to the r-g assumption.
 * For the UK a plausible 1.7pp move in r-g swings pb* by ~1.6pp of GDP (~£50bn/yr).
 */
export const primaryBalanceUnderShock = (
  debtToGdp: number, r: number, g: number,
): number => (debtToGdp * (r - g)) / (1 + g);

// ---------------------------------------------------------------------------
// C4 — Market-based. DEMOTED: signal only (INVARIANT 12).
// ---------------------------------------------------------------------------

export class DoubleCountError extends Error {}

/**
 * INVARIANT 12: listed equity is ALREADY inside the national balance sheet — as
 * corporate assets net of liabilities and in household financial assets. Adding it
 * double-counts. This function exists to be called and to throw.
 */
export const addListedEquityToNetWorth = (): never => {
  throw new DoubleCountError(
    "INVARIANT 12 violated: listed market cap is already inside national net worth " +
    "(as corporate net assets and household financial assets). Adding it double-counts. " +
    "Use listed equity as a momentum signal only. See docs §2.4.",
  );
};

// ---------------------------------------------------------------------------
// The circularity check — INVARIANT: GDP multiple is 1/(r-g) restated
// ---------------------------------------------------------------------------

/**
 * The only defensible "country multiple" is the Gordon identity. Any product
 * publishing "GDP x multiple" is publishing 1/(r-g) with extra steps, so we ship it
 * as a sensitivity axis and label it as such.
 */
export const gdpMultipleAxis = (
  rMinusGCandidates: readonly number[] = [0.01, 0.015, 0.02, 0.03],
): ReadonlyArray<{ rMinusG: number; multiple: number }> =>
  rMinusGCandidates.map((rmg) => ({ rMinusG: rmg, multiple: 1 / rmg }));

// ---------------------------------------------------------------------------
// Country risk premium
// ---------------------------------------------------------------------------

/** CRP = default spread x (sigma_equity / sigma_bond); total ERP = mature + CRP. */
export const countryRiskPremium = (defaultSpread: number): number =>
  defaultSpread * EQUITY_BOND_VOL_MULTIPLIER.value;

export const totalEquityRiskPremium = (defaultSpread: number): number =>
  MATURE_MARKET_ERP.value + countryRiskPremium(defaultSpread);

// ---------------------------------------------------------------------------
// The composite — three numbers, never one (§2.6)
// ---------------------------------------------------------------------------

export interface CountryValuation {
  readonly iso3: string;
  readonly name: string;
  readonly currency: string;
  readonly population: number;
  readonly nominalGdp: number;
  /** Keyed by claim — deliberately separate, never averaged. */
  readonly claims: ReadonlyArray<{
    readonly claim: CountryClaim;
    readonly question: string;
    readonly value: Range;
    /** Per-capita denominator — mandatory on every place page (§6). */
    readonly perCapita: Range;
  }>;
  readonly debt: DebtDynamicsResult;
  /** Institutional capital ratio: flow value / stock value. */
  readonly institutionalCapitalRatio: number | null;
}

const perCapitaOf = (r: Range, population: number): Range =>
  range(r.low / population, r.central / population, r.high / population, {
    asOf: r.asOf, source: r.source, method: "per-capita denominator",
  });

export const buildCountryValuation = (args: {
  iso3: string; name: string; currency: string; population: number; nominalGdp: number;
  claims: ReadonlyArray<{ claim: CountryClaim; value: Range }>;
  debt: DebtDynamicsResult;
}): CountryValuation => {
  const claims = args.claims.map((c) => ({
    claim: c.claim,
    question: CLAIM_QUESTION[c.claim],
    value: c.value,
    perCapita: perCapitaOf(c.value, args.population),
  }));

  const stock = claims.find((c) => c.claim === "national_net_worth")?.value.central;
  const flow = claims.find((c) => c.claim === "comprehensive_wealth")?.value.central;

  return {
    ...args,
    claims,
    institutionalCapitalRatio: stock && flow ? flow / stock : null,
  };
};

export { range, bandFromRateShock, type Range, type Sourced };
