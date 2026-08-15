/**
 * A country page, generated for every country the World Bank data supports.
 *
 * Deliberately says what it CANNOT answer as well as what it can. Most countries have
 * fewer answers than the UK because most statistics offices don't publish a national
 * balance sheet — hiding that would misrepresent the coverage.
 */

import { notFound } from "next/navigation";
import TraceTree from "../../../components/TraceTree.tsx";
import {
  valuableCountries, findCountry, countryWealth, countryWealthPerCapita,
  coverage, CWON_YEAR,
} from "../../../engine/countries.ts";
import { formatValue, allWarnings, assumptions, challengeUrl } from "../../../engine/trace.ts";

export const dynamicParams = false;

export function generateStaticParams() {
  return valuableCountries()
    // The UK has its own richer page built on ONS data.
    .filter((c) => c.iso3 !== "GBR")
    .map((c) => ({ iso3: c.iso3.toLowerCase() }));
}

export default async function CountryPage({ params }: { params: Promise<{ iso3: string }> }) {
  const { iso3 } = await params;
  const c = findCountry(iso3);
  if (!c) notFound();

  const wealth = countryWealth(c);
  if (!wealth) notFound();
  const perCapita = countryWealthPerCapita(c);
  const cov = coverage(c);
  const warnings = allWarnings(wealth.trace);
  const judgements = assumptions(wealth.trace).length;

  return (
    <main className="wrap">
      <p className="small muted" style={{ marginBottom: 10 }}>
        <a href="/countries">All countries</a> / {c.region}
      </p>

      <h1>What is {c.name} worth?</h1>
      <p className="lede">
        Counting what it has built, what its people will earn, and what its land and
        resources hold — measured the same way for every country on this site.
      </p>

      <div className="claim">
        <div className="claim-q">{wealth.trace.question}</div>
        <span className="claim-value">{formatValue(wealth.value, wealth.trace.unit)}</span>
        <p style={{ fontSize: 16, margin: "0 0 10px", maxWidth: "60ch" }}>
          {wealth.trace.plain}
        </p>
        <p className="small" style={{ color: "var(--ink-2)", margin: "0 0 14px", maxWidth: "66ch" }}>
          {wealth.trace.meaning}
        </p>
        <div className="claim-meta">
          <a href={`/trace/${wealth.trace.hash}`}>See how we got there →</a>
          <span className="badge badge-ok">✓ the maths checks out</span>
          {judgements > 0 && (
            <span className="badge badge-assume">
              {judgements} judgement call{judgements === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      {perCapita && (
        <div className="claim">
          <div className="claim-q">And per person?</div>
          <span className="claim-value">
            {formatValue(perCapita.value, perCapita.trace.unit)}
          </span>
          <p className="small" style={{ color: "var(--ink-2)", margin: "0 0 14px", maxWidth: "66ch" }}>
            {perCapita.trace.meaning}
          </p>
          <div className="claim-meta">
            <a href={`/trace/${perCapita.trace.hash}`}>See how we got there →</a>
          </div>
        </div>
      )}

      <h2>What goes into it</h2>
      <TraceTree trace={wealth.trace} />

      {warnings.length > 0 && (
        <>
          <h2>What to watch out for</h2>
          {warnings.map((w, i) => (
            <div className="warning" key={i}>
              <span className="warning-mark" aria-hidden>!</span>
              <span>{w}</span>
            </div>
          ))}
        </>
      )}

      <h2>What we can’t tell you about {c.name}</h2>
      <p className="small" style={{ maxWidth: "68ch", marginTop: -6 }}>
        Being straight about the gaps matters more than filling them with guesses.
      </p>
      <ul style={{ paddingLeft: 18, color: "var(--ink-2)", maxWidth: "70ch" }}>
        {cov.missing.map((m) => <li key={m} style={{ marginBottom: 6 }}>{m}</li>)}
        <li style={{ marginBottom: 6 }}>
          which decisions moved this number, and who made them. We’ve researched that for
          the United Kingdom only — everywhere else the timeline is empty, and{" "}
          <a href="https://github.com/hamza-ali-shahjahan/valuable/issues/new?template=source.yml" target="_blank" rel="noreferrer">
            filling it in is the most useful thing anyone could contribute
          </a>.
        </li>
      </ul>

      <h2>Think we’ve got this wrong?</h2>
      <p style={{ maxWidth: "66ch" }}>
        Every figure above links to its full working, and any single line of it can be
        challenged on its own.
      </p>
      <a className="challenge" href={challengeUrl(wealth.trace)} target="_blank" rel="noreferrer">
        Challenge this calculation →
      </a>

      <footer className="foot">
        Figures from the World Bank’s Changing Wealth of Nations ({CWON_YEAR}) and World
        Development Indicators, used under CC BY 4.0. The same method is applied to all{" "}
        {valuableCountries().length} countries so they can be compared with each other —
        but not with the United Kingdom’s page, which uses richer national data on a
        different convention.
      </footer>
    </main>
  );
}
