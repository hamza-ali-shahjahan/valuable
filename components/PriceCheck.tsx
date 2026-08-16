"use client";

/**
 * The reader brings the price.
 *
 * We may not store market data — redistribution is contractually barred for every free
 * source (docs/01-DATA-SPINE.md §7). That constraint looked like a limitation and turned
 * out to make the better page: instead of showing a company's market value as another
 * fact to read, we invert it. You type the price; we tell you what the business has to
 * deliver to deserve it.
 *
 * Everything here runs in the browser and nothing is sent anywhere — the same promise as
 * the founder tool.
 */

import { useState, useMemo } from "react";
import {
  impliedByPrice, COST_OF_EQUITY, LONG_RUN_GROWTH, displayName,
  type CompanyMeta,
} from "../engine/companies.ts";
import { formatValue } from "../engine/trace.ts";

export default function PriceCheck({
  company, floor, ceiling,
}: {
  company: CompanyMeta;
  floor: number;
  ceiling: number;
}) {
  const [billions, setBillions] = useState("");

  const marketValue = Number(billions) * 1e9;
  const result = useMemo(
    () => (billions.trim() === "" ? null : impliedByPrice(company, marketValue)),
    [billions, company, marketValue],
  );

  const name = displayName(company.name);

  return (
    <div className="sim">
      <div className="sim-form">
        <div className="sim-field">
          <label className="sim-field-label" htmlFor="mv">
            What is the market saying {name} is worth?
          </label>
          <div className="sim-affix">
            <span>$</span>
            <input
              id="mv"
              className="sim-input"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              placeholder="e.g. 250"
              value={billions}
              onChange={(e) => setBillions(e.target.value)}
            />
            <span>billion</span>
          </div>
          <p className="sim-field-hint">
            Look it up anywhere — share price times shares, or any finance site’s market
            cap. We deliberately don’t store market prices, so this number is yours and it
            stays in your browser.
          </p>
        </div>
      </div>

      {result === null && billions.trim() !== "" && (
        <p className="small muted">
          {company.pretaxIncome - company.taxExpense <= 0
            ? `${name} did not make a profit in this year, so there is no profit margin to work back from. This test only works on a profitable business.`
            : "Enter a value above zero."}
        </p>
      )}

      {result && (
        <>
          <div className="sim-verdict">{result.verdict}</div>

          <div className="grid-2">
            <div className="stat">
              <div className="stat-label">Profit that price requires</div>
              <div className="stat-value">{formatValue(result.requiredProfit, "USD")}</div>
              <p className="stat-note">
                every year, for ever, growing at{" "}
                {(LONG_RUN_GROWTH * 100).toFixed(2)}% — to justify paying{" "}
                {formatValue(result.marketValue, "USD")} today
              </p>
            </div>
            <div className="stat">
              <div className="stat-label">Revenue that implies</div>
              <div className="stat-value">{formatValue(result.requiredRevenue, "USD")}</div>
              <p className="stat-note">
                at {name}’s current margin of {(result.netMargin * 100).toFixed(1)}% —
                against {formatValue(result.currentRevenue, "USD")} today
              </p>
            </div>
            <div className="stat">
              <div className="stat-label">Which is</div>
              <div className="stat-value">{result.revenueMultiple.toFixed(2)}×</div>
              <p className="stat-note">today’s revenue</p>
            </div>
            <div className="stat">
              <div className="stat-label">Growth needed to get there</div>
              <div className={`stat-value ${result.requiredGrowth > 0.15 ? "effect-neg" : ""}`}>
                {(result.requiredGrowth * 100).toFixed(1)}%
              </div>
              <p className="stat-note">a year, for five years</p>
            </div>
          </div>

          <div className="warning" style={{ marginTop: 16 }}>
            <span className="warning-mark" aria-hidden>!</span>
            <span>
              {result.marketValue > ceiling
                ? `${formatValue(result.marketValue, "USD")} is above even our optimistic figure of ${formatValue(ceiling, "USD")}, which already assumes today's returns continue for ever. The market is pricing in something our maths does not contain — a new business, a margin expansion, or an acquisition premium. Work out what, before deciding whether you believe it.`
                : result.marketValue < floor
                ? `${formatValue(result.marketValue, "USD")} is below our floor of ${formatValue(floor, "USD")}, which assumes the company never grows again. Either the market expects the current earnings to fall, or something is being missed.`
                : `${formatValue(result.marketValue, "USD")} sits inside our range of ${formatValue(floor, "USD")} to ${formatValue(ceiling, "USD")}. On these figures the price is defensible — which is not the same as saying it is right.`}
            </span>
          </div>

          <p className="small muted" style={{ marginTop: 14, maxWidth: "68ch" }}>
            The three questions to ask next, in order. <strong>Possible:</strong> is the
            market it sells into even that big? <strong>Plausible:</strong> can margins hold
            at that scale? <strong>Probable:</strong> will competitors and its own
            execution allow it? A price can pass the first and fail the third.
          </p>
        </>
      )}

      <details className="detail" style={{ marginTop: 18 }}>
        <summary>How this works</summary>
        <div className="detail-formula">
          <p className="formula-plain">
            A price is a claim about the future. Turn it around: at a{" "}
            {(COST_OF_EQUITY * 100).toFixed(2)}% return that owners expect, and{" "}
            {(LONG_RUN_GROWTH * 100).toFixed(2)}% long-run growth, work out the annual
            profit that price demands. Divide by the margin the business actually earns,
            and you have the revenue it must reach.
          </p>
          <p className="formula">
            Required profit = V × (k<sub>e</sub> − g) ÷ (1 + g) &nbsp;·&nbsp; Required
            revenue = required profit ÷ net margin
          </p>
          <p className="formula-ref">
            docs/00-FIRST-PRINCIPLES.md §4.3. The return owners expect uses the market’s
            own average risk, not this company’s — estimating a company-specific figure
            needs a share-price history, which we do not store.
          </p>
        </div>
      </details>
    </div>
  );
}
