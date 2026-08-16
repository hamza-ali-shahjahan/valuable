/**
 * The company index — our own ranking, and deliberately not a ranking of size.
 *
 * Every list of big companies already exists. What nobody publishes is which of them
 * actually earn more than their money costs, because that number is uncomfortable: it
 * puts household names in the bottom half. That list is the reason this page exists.
 */

import {
  rankedCompanies, companyCoverage, unmeasurable, displayName,
  COST_OF_CAPITAL, SEC_YEAR, SEC_UNIVERSE,
} from "../../engine/companies.ts";
import { formatValue } from "../../engine/trace.ts";

export default function CompaniesPage() {
  const rows = rankedCompanies();
  const cov = companyCoverage();
  const excluded = unmeasurable();

  const creators = rows.filter((r) => r.valueCreated > 0);
  const destroyers = rows.filter((r) => r.valueCreated <= 0);
  const createdTotal = creators.reduce((s, r) => s + r.valueCreated, 0);
  const destroyedTotal = destroyers.reduce((s, r) => s + r.valueCreated, 0);

  const Row = ({ r, i }: { r: (typeof rows)[number]; i: number }) => (
    <tr key={r.company.cik}>
      <td className="num muted small">{i}</td>
      <td>
        <a href={`/company/${r.company.cik}`}>{displayName(r.company.name)}</a>
      </td>
      <td className="num">{(r.roic * 100).toFixed(1)}%</td>
      <td className={`num ${r.roic > COST_OF_CAPITAL ? "effect-pos" : "effect-neg"}`}>
        {r.roic > COST_OF_CAPITAL ? "+" : "−"}
        {(Math.abs(r.roic - COST_OF_CAPITAL) * 100).toFixed(1)}
      </td>
      <td className="num">{formatValue(r.valueCreated, "USD")}</td>
      <td className="num muted">{formatValue(r.company.revenue, "USD")}</td>
    </tr>
  );

  const Head = () => (
    <thead>
      <tr>
        <th style={{ width: "2.5rem" }}>#</th>
        <th>Company</th>
        <th style={{ textAlign: "right" }}>Earns</th>
        <th style={{ textAlign: "right" }}>vs cost</th>
        <th style={{ textAlign: "right" }}>Value a year</th>
        <th style={{ textAlign: "right" }}>Revenue</th>
      </tr>
    </thead>
  );

  return (
    <main className="wrap">
      <h1>Which companies actually create value?</h1>
      <p className="lede">
        {cov.published} of the largest US public companies, ranked on whether they earn
        more than their money costs — not on how big they are.
      </p>

      <div className="notice">
        <strong>This ranking is ours.</strong> The Forbes and Fortune lists are copyright,
        so we do not reproduce them. The accounts underneath are not: every US public
        company must file them, and those filings belong to everyone. We read{" "}
        {SEC_UNIVERSE.toLocaleString("en-GB")} complete sets of {SEC_YEAR} accounts and
        ranked the largest {cov.published} on something nobody publishes.
      </div>

      <h2>The uncomfortable part</h2>
      <p style={{ maxWidth: "68ch" }}>
        A company can report record profits and still be destroying value. Profit only
        asks whether money came in. Value creation asks a harder question:{" "}
        <strong>did the money tied up in this business earn more than it would have
        earned somewhere else?</strong> If not, the business would serve its owners better
        by shrinking.
      </p>
      <p style={{ maxWidth: "68ch" }}>
        On that test, <strong>{cov.destroyers} of these {cov.published} companies fall
        short</strong> — including some of the best-known names in the world.
      </p>

      <div className="grid-2">
        <div className="stat">
          <div className="stat-label">Created between them</div>
          <div className="stat-value effect-pos">{formatValue(createdTotal, "USD")}</div>
          <p className="stat-note">a year, by {cov.creators} companies clearing the bar</p>
        </div>
        <div className="stat">
          <div className="stat-label">Destroyed between them</div>
          <div className="stat-value effect-neg">{formatValue(destroyedTotal, "USD")}</div>
          <p className="stat-note">a year, by {cov.destroyers} companies falling short</p>
        </div>
      </div>

      <h2>Creating the most value</h2>
      <p className="small muted" style={{ maxWidth: "68ch", marginTop: -6, marginBottom: 12 }}>
        “Earns” is the return on every dollar tied up in the business. “vs cost” is how
        many percentage points that beats the {(COST_OF_CAPITAL * 100).toFixed(2)}% those
        dollars cost. Every figure links to its full working.
      </p>
      <table className="plain">
        <Head />
        <tbody>{creators.slice(0, 40).map((r, i) => <Row r={r} i={i + 1} key={r.company.cik} />)}</tbody>
      </table>
      <p className="small muted" style={{ marginTop: 10 }}>
        Showing 40 of {cov.creators}.
      </p>

      <h2>Destroying the most</h2>
      <p className="small muted" style={{ maxWidth: "68ch", marginTop: -6, marginBottom: 12 }}>
        These are not small or failing companies. They are large, famous, mostly
        profitable — and in {SEC_YEAR} the money inside them earned less than it cost.
      </p>
      <table className="plain">
        <Head />
        <tbody>
          {[...destroyers].reverse().slice(0, 25).map((r, i) => (
            <Row r={r} i={i + 1} key={r.company.cik} />
          ))}
        </tbody>
      </table>
      <p className="small muted" style={{ marginTop: 10 }}>
        Showing 25 of {cov.destroyers}.
      </p>

      <h2>What this list is missing</h2>
      <ul style={{ paddingLeft: 18, color: "var(--ink-2)", maxWidth: "70ch" }}>
        <li style={{ marginBottom: 8 }}>
          <strong>US companies only.</strong> The US regulator publishes machine-readable
          accounts for every listed company and does not charge for them. No other country
          does this at the same quality, so a global company ranking on this basis is not
          currently possible from free sources.
        </li>
        <li style={{ marginBottom: 8 }}>
          <strong>Banks and insurers are absent.</strong> They do not split their balance
          sheets into current and non-current, because for a bank borrowing <em>is</em> the
          business. They need a different method — the return on tangible equity — not this one.
        </li>
        <li style={{ marginBottom: 8 }}>
          <strong>{excluded.length} companies are excluded for having negative book
          capital</strong> — {excluded.map((c) => displayName(c.name)).join(", ")}. Years of
          buybacks have returned more to shareholders than the accounts ever recorded going
          in. Their book capital is negative, so every ratio built on it is meaningless
          rather than merely imprecise, and we decline rather than print a number.
        </li>
        <li style={{ marginBottom: 8 }}>
          <strong>One year, {SEC_YEAR}.</strong> A company halfway through a large
          investment programme looks worse than it is, because the spending lands years
          before the earnings do. Intel is the clearest example on this page.
        </li>
        <li style={{ marginBottom: 8 }}>
          <strong>One cost of capital for everyone.</strong> A utility genuinely costs
          less than a chip designer. Estimating it per company needs a share-price history,
          and we may not store market data — so we use the market average and say so.
        </li>
      </ul>

      <footer className="foot">
        Source: SEC EDGAR company filings, financial year {SEC_YEAR}. Public domain — works
        of the US federal government carry no copyright (17 U.S.C. §105). Each company page
        links to that company’s own filings so you can check the figures at source.
      </footer>
    </main>
  );
}
