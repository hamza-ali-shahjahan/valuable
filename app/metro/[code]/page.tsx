import { notFound } from "next/navigation";
import TraceTree from "../../../components/TraceTree.tsx";
import {
  allMetros, findMetro, metroValue, impliedMultiple, METRO_YEAR,
} from "../../../engine/metros.ts";
import { formatValue, allWarnings, assumptions, challengeUrl } from "../../../engine/trace.ts";

export const dynamicParams = false;

export function generateStaticParams() {
  return allMetros().map((m) => ({ code: m.code.toLowerCase() }));
}

export default async function MetroPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const m = findMetro(code);
  if (!m) notFound();
  const v = metroValue(m);
  if (!v) notFound();

  const warnings = allWarnings(v.trace);
  const judgements = assumptions(v.trace).length;
  const perPerson = m.population ? v.value / m.population : null;

  return (
    <main className="wrap">
      <p className="small muted" style={{ marginBottom: 10 }}>
        <a href="/metros">Europe’s cities</a> / {m.country}
        {m.isCapital && " · capital"}
      </p>

      <h1>What is {m.name} worth?</h1>
      <p className="lede">
        Its buildings, land and infrastructure — not the wages of the people who live
        there, which belong to them and leave when they do.
      </p>

      <div className="claim">
        <div className="claim-q">{v.trace.question}</div>
        <span className="claim-value">{formatValue(v.value, "EUR")}</span>
        <p style={{ fontSize: 16, margin: "0 0 10px", maxWidth: "60ch" }}>{v.trace.plain}</p>
        <p className="small" style={{ color: "var(--ink-2)", margin: "0 0 14px", maxWidth: "66ch" }}>
          {v.trace.meaning}
        </p>
        <div className="claim-meta">
          <a href={`/trace/${v.trace.hash}`}>See how we got there →</a>
          <span className="badge badge-ok">✓ the maths checks out</span>
          <span className="badge badge-assume">
            {judgements} judgement call{judgements === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="grid-2">
        <div className="stat">
          <div className="stat-label">Produced each year</div>
          <div className="stat-value">{formatValue(m.gdpEur, "EUR")}</div>
          <p className="stat-note">
            Everything made in the region in {METRO_YEAR}, at market prices
          </p>
        </div>
        <div className="stat">
          <div className="stat-label">People</div>
          <div className="stat-value">
            {m.population ? formatValue(m.population, "people") : "—"}
          </div>
          <p className="stat-note">
            {perPerson
              ? `${formatValue(perPerson, "EUR")} of buildings and land behind each of them`
              : "population not published for this region"}
          </p>
        </div>
      </div>

      <h2>How we got there</h2>
      <p className="small muted" style={{ maxWidth: "66ch", marginTop: -6, marginBottom: 14 }}>
        Every figure below is either something{" "}
        <span style={{ color: "var(--observed)" }}>● someone measured</span> or a{" "}
        <span style={{ color: "var(--assumption)" }}>◆ judgement we made</span>. Three of
        the four inputs here are judgements — which is why this number is an order of
        magnitude rather than a price.
      </p>
      <TraceTree trace={v.trace} />

      <h2>What to watch out for</h2>
      {warnings.map((w, i) => (
        <div className="warning" key={i}>
          <span className="warning-mark" aria-hidden>!</span>
          <span>{w}</span>
        </div>
      ))}

      <h2>Think we’ve got this wrong?</h2>
      <p style={{ maxWidth: "66ch" }}>
        The multiple is the obvious thing to argue with — reasonable people put it
        anywhere between four and eight times a year of output, and we use{" "}
        {impliedMultiple().toFixed(1)}. Say which step.
      </p>
      <a className="challenge" href={challengeUrl(v.trace)} target="_blank" rel="noreferrer">
        Challenge this calculation →
      </a>

      <footer className="foot">
        Source: Eurostat, GDP and population by metropolitan region, {METRO_YEAR}, under
        Commission Decision 2011/833/EU. The same method is applied to all{" "}
        {allMetros().length} European metros so they can be compared with each other.
      </footer>
    </main>
  );
}
