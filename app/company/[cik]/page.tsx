import { notFound } from "next/navigation";
import TraceTree from "../../../components/TraceTree.tsx";
import PriceCheck from "../../../components/PriceCheck.tsx";
import {
  rankedCompanies, findCompany, investedCapital, returnOnCapital, valueCreated,
  companyValue, displayName, filingUrl, taxRateOf,
  COST_OF_CAPITAL, LONG_RUN_GROWTH, SEC_YEAR,
} from "../../../engine/companies.ts";
import { formatValue, allWarnings, assumptions, challengeUrl } from "../../../engine/trace.ts";

export const dynamicParams = false;

export function generateStaticParams() {
  return rankedCompanies().map((r) => ({ cik: String(r.company.cik) }));
}

export default async function CompanyPage({ params }: { params: Promise<{ cik: string }> }) {
  const { cik } = await params;
  const c = findCompany(cik);
  if (!c) notFound();

  const ic = investedCapital(c);
  const roic = returnOnCapital(c);
  const created = valueCreated(c);
  if (!ic || !roic || !created) notFound();

  const value = companyValue(c);
  const name = displayName(c.name);
  const tax = taxRateOf(c);
  const warnings = allWarnings(created.trace);
  const judgements = assumptions(created.trace).length;
  const creates = created.value > 0;
  const gap = roic.value - COST_OF_CAPITAL;

  const ranked = rankedCompanies();
  const rank = ranked.findIndex((r) => r.company.cik === c.cik) + 1;

  return (
    <main className="wrap">
      <p className="small muted" style={{ marginBottom: 10 }}>
        <a href="/companies">Companies</a> / {c.state ? `${c.state.replace("US-", "")} · ` : ""}
        financial year ending {c.fiscalYearEnd}
      </p>

      <h1>Does {name} create value?</h1>
      <p className="lede">
        {c.operatingIncome >= 0
          ? "Not whether it made a profit — it did. Whether the money tied up inside it earned more than that money costs."
          : `A harder question than whether it made a profit, and in ${SEC_YEAR} it did not. Whether the money tied up inside it earned more than that money costs.`}
      </p>

      <div className="claim">
        <div className="claim-q">{created.trace.question}</div>
        <span className={`claim-value ${creates ? "effect-pos" : "effect-neg"}`}>
          {creates ? "+" : "−"}
          {formatValue(Math.abs(created.value), "USD")} a year
        </span>
        <p style={{ fontSize: 16, margin: "0 0 10px", maxWidth: "60ch" }}>
          {created.trace.plain}
        </p>
        <p className="small" style={{ color: "var(--ink-2)", margin: "0 0 14px", maxWidth: "66ch" }}>
          {created.trace.meaning}
        </p>
        <div className="claim-meta">
          <a href={`/trace/${created.trace.hash}`}>See how we got there →</a>
          <span className="badge badge-ok">✓ the maths checks out</span>
          <span className="badge badge-assume">
            {judgements} judgement call{judgements === 1 ? "" : "s"}
          </span>
          <span className="badge badge-plain">
            ranked {rank} of {ranked.length} on value created
          </span>
        </div>
      </div>

      <div className="grid-2">
        <div className="stat">
          <div className="stat-label">Earns on its money</div>
          <div className={`stat-value ${gap > 0 ? "effect-pos" : "effect-neg"}`}>
            {(roic.value * 100).toFixed(1)}%
          </div>
          <p className="stat-note">
            against {(COST_OF_CAPITAL * 100).toFixed(2)}% that the money costs —{" "}
            {gap > 0 ? "clears the bar by " : "falls short by "}
            {Math.abs(gap * 100).toFixed(1)} points.{" "}
            <a href={`/trace/${roic.trace.hash}`}>Working →</a>
          </p>
        </div>
        <div className="stat">
          <div className="stat-label">Money tied up in it</div>
          <div className="stat-value">{formatValue(ic.value, "USD")}</div>
          <p className="stat-note">
            what owners and lenders have put in, less the cash pile.{" "}
            <a href={`/trace/${ic.trace.hash}`}>Working →</a>
          </p>
        </div>
        <div className="stat">
          <div className="stat-label">Revenue</div>
          <div className="stat-value">{formatValue(c.revenue, "USD")}</div>
          <p className="stat-note">
            in the year to {c.fiscalYearEnd}, as filed
          </p>
        </div>
        <div className="stat">
          <div className="stat-label">Tax it actually paid</div>
          <div className="stat-value">{(tax.rate * 100).toFixed(1)}%</div>
          <p className="stat-note">{tax.measured ? "from its own accounts" : "standard rate — see below"}</p>
        </div>
      </div>

      <h2>What is it worth?</h2>
      {value ? (
        <>
          <p style={{ maxWidth: "68ch" }}>
            A range, not a number — and the width of it is the honest part. The two ends
            differ only in what you assume about the future, and nothing else.
          </p>
          <div className="grid-2">
            <div className="stat">
              <div className="stat-label">If it never grows again</div>
              <div className="stat-value">{formatValue(value.floor.value, "USD")}</div>
              <p className="stat-note">
                today’s earnings, running on for ever, and nothing more.{" "}
                <a href={`/trace/${value.floor.trace.hash}`}>Working →</a>
              </p>
            </div>
            <div className="stat">
              <div className="stat-label">If today’s returns continue</div>
              <div className="stat-value">{formatValue(value.ceiling.value, "USD")}</div>
              <p className="stat-note">
                the same {(roic.value * 100).toFixed(0)}% return, growing at{" "}
                {(LONG_RUN_GROWTH * 100).toFixed(2)}% for ever.{" "}
                <a href={`/trace/${value.ceiling.trace.hash}`}>Working →</a>
              </p>
            </div>
          </div>
          <div className="notice">
            <strong>
              {(value.ceiling.value / value.floor.value).toFixed(1)}× between the two ends.
            </strong>{" "}
            Same company, same accounts, same year. The entire difference is one
            assumption: whether {name}’s current advantage lasts. That is what people are
            really arguing about when they argue about a valuation — and it is why we show
            you both rather than splitting the difference and calling it a price target.
          </div>
        </>
      ) : (
        <div className="withheld">
          <strong>We are not putting a value on {name}.</strong> It lost money on its
          operations in {SEC_YEAR}, so there are no earnings to value. The honest way to
          value a loss-making business is to forecast when it stops losing money — and a
          forecast is an opinion, not a measurement. We would rather leave this blank than
          fill it with one.
        </div>
      )}

      <h2>What would a price have to assume?</h2>
      <p style={{ maxWidth: "68ch" }}>
        Turn the question round. Rather than us telling you what {name} is worth, type in
        what the market says it is worth — and we will tell you what the business has to
        deliver to deserve that.
      </p>
      <PriceCheck
        company={c}
        floor={value?.floor.value ?? 0}
        ceiling={value?.ceiling.value ?? 0}
      />

      <h2>How we got there</h2>
      <p className="small muted" style={{ maxWidth: "66ch", marginTop: -6, marginBottom: 14 }}>
        Every figure below is either something{" "}
        <span style={{ color: "var(--observed)" }}>● someone measured</span> — here, filed
        with the US regulator under penalty of law — or a{" "}
        <span style={{ color: "var(--assumption)" }}>◆ judgement we made</span>. There are
        only {judgements} judgements in this whole calculation; everything else is an
        accounting fact.
      </p>
      <TraceTree trace={created.trace} />

      <h2>What to watch out for</h2>
      {warnings.map((w, i) => (
        <div className="warning" key={i}>
          <span className="warning-mark" aria-hidden>!</span>
          <span>{w}</span>
        </div>
      ))}

      <h2>Check it at source</h2>
      <p style={{ maxWidth: "66ch" }}>
        Every figure on this page comes from {name}’s own annual filing for the year ending{" "}
        {c.fiscalYearEnd}, with the balance sheet dated {c.balanceDate}. Nothing here is
        our estimate of what they earned — it is what they told the regulator, and the
        document is public.
      </p>
      <p>
        <a href={filingUrl(c)} target="_blank" rel="noreferrer">
          Open {name}’s filings at the SEC →
        </a>
      </p>

      <h2>Think we’ve got this wrong?</h2>
      <p style={{ maxWidth: "66ch" }}>
        The cost of capital is the obvious thing to argue with. We apply one market-wide{" "}
        {(COST_OF_CAPITAL * 100).toFixed(2)}% to every company, and{" "}
        {name} may genuinely deserve more or less. Say which step.
      </p>
      <a className="challenge" href={challengeUrl(created.trace)} target="_blank" rel="noreferrer">
        Challenge this calculation →
      </a>

      <footer className="foot">
        Source: SEC EDGAR, {name} annual filing, financial year {SEC_YEAR} (accession{" "}
        {c.accession}). Public domain under 17 U.S.C. §105. The same method is applied to
        all {ranked.length} companies here so they can be compared with each other.
      </footer>
    </main>
  );
}
