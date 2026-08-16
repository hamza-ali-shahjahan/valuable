/**
 * Every European metro we can value.
 *
 * The gaps are stated as prominently as the figures, because "cities of Europe" is a
 * much smaller claim than "cities", and pretending otherwise would misrepresent what
 * anyone actually publishes.
 */

import {
  allMetros, metroValue, impliedMultiple, metroCoverage, METRO_YEAR,
} from "../../engine/metros.ts";
import { formatValue } from "../../engine/trace.ts";

export default function MetrosPage() {
  const rows = allMetros()
    .map((m) => ({ m, v: metroValue(m) }))
    .filter((r): r is { m: typeof r.m; v: NonNullable<typeof r.v> } => r.v !== null)
    .sort((a, b) => b.v.value - a.v.value);

  const cov = metroCoverage();
  const total = rows.reduce((s, r) => s + r.v.value, 0);

  return (
    <main className="wrap">
      <h1>What are Europe’s cities worth?</h1>
      <p className="lede">
        {cov.metros} metropolitan regions across {cov.countries} countries — valued on
        what their buildings, land and infrastructure are worth, not on the wages of the
        people who live there.
      </p>

      <div className="notice">
        <strong>Why Europe, and not the world.</strong> Only Europe, the United States and
        China publish official figures for city economies at all. India, most of Africa,
        most of South-East Asia and Latin America publish nothing at city level — anyone
        showing you a worldwide city ranking is using a commercial model, not measurements.
        We ship what exists.
      </div>

      <h2>The mistake this avoids</h2>
      <p style={{ maxWidth: "68ch" }}>
        The obvious way to value a city is to treat what it produces like a company’s
        revenue and capitalise it. That gives about <strong>23 times</strong> a year of
        city output — and it is wrong by a factor of three.
      </p>
      <p style={{ maxWidth: "68ch" }}>
        Most of what a city produces is <em>wages</em>. Wages belong to people, and people
        can move away and take them along. Only the part that belongs to things which
        can’t move — buildings, land, infrastructure — is a claim on the city itself. That
        is roughly a third of output, and valuing only that share gives{" "}
        <strong>{impliedMultiple().toFixed(1)} times</strong> a year of output instead.
      </p>

      <h2>Ranked by what they hold</h2>
      <p className="small muted" style={{ maxWidth: "68ch", marginTop: -6, marginBottom: 12 }}>
        Together these come to {formatValue(total, "EUR")}. Every figure links to its full
        working.
      </p>
      <table className="plain">
        <thead>
          <tr>
            <th style={{ width: "2.5rem" }}>#</th>
            <th>Metropolitan region</th>
            <th style={{ textAlign: "right" }}>Worth</th>
            <th style={{ textAlign: "right" }}>Output a year</th>
            <th style={{ textAlign: "right" }}>People</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 60).map((r, i) => (
            <tr key={r.m.code}>
              <td className="num muted small">{i + 1}</td>
              <td>
                <a href={`/metro/${r.m.code.toLowerCase()}`}>{r.m.name}</a>
                {r.m.isCapital && <span className="small muted"> · capital</span>}
              </td>
              <td className="num">{formatValue(r.v.value, "EUR")}</td>
              <td className="num muted">{formatValue(r.m.gdpEur, "EUR")}</td>
              <td className="num muted">
                {r.m.population ? formatValue(r.m.population, "people") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted" style={{ marginTop: 10 }}>
        Showing the largest 60 of {rows.length}.
      </p>

      <h2>What this list is missing</h2>
      <ul style={{ paddingLeft: 18, color: "var(--ink-2)", maxWidth: "70ch" }}>
        {cov.missing.map((m) => <li key={m} style={{ marginBottom: 8 }}>{m}</li>)}
      </ul>

      <footer className="foot">
        Source: Eurostat, GDP and population by metropolitan region, {METRO_YEAR}. Reuse
        authorised under Commission Decision 2011/833/EU with attribution. Eurostat
        stopped updating this series in early 2024.
      </footer>
    </main>
  );
}
