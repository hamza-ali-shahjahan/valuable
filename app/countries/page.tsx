/**
 * Every country, ranked. The megaphone page.
 *
 * One method applied identically to every country, which is the only honest basis for
 * comparing them.
 */

import {
  valuableCountries, countryWealth, countryWealthPerCapita, CWON_YEAR,
  allCompositions, compositionExtremes,
} from "../../engine/countries.ts";
import { formatValue } from "../../engine/trace.ts";
import CompositionBar from "../../components/CompositionBar.tsx";

export default function CountriesPage() {
  const rows = valuableCountries().map((c) => {
    const w = countryWealth(c)!;
    const pc = countryWealthPerCapita(c);
    return { c, wealth: w.value, hash: w.trace.hash, perCapita: pc?.value ?? null };
  });

  const total = rows.reduce((s, r) => s + r.wealth, 0);

  return (
    <main className="wrap">
      <h1>Every country we can value</h1>
      <p className="lede">
        {rows.length} countries, measured the same way: what each has built, what its
        people will earn over their working lives, and what its land and resources hold.
      </p>
      <p className="lede" style={{ fontSize: 15 }}>
        Every figure links to its complete working, and every working can be checked and
        challenged. Together they come to{" "}
        <strong>{formatValue(total, "USD")}</strong>.
      </p>

      <div className="notice" style={{ background: "var(--bg)", borderColor: "var(--border-strong)", color: "var(--ink-2)" }}>
        These are all on the World Bank’s method for {CWON_YEAR} — one convention applied
        identically everywhere, which is what makes comparing them fair.{" "}
        <strong>They are not comparable with the United Kingdom’s page</strong>, which uses
        richer national statistics on a different convention and produces a much larger
        number for the same country. That is not an error; it is what happens when two
        statistics offices make different reasonable choices, and we’d rather show you
        both than quietly pick one. <a href="/country/uk">See the UK →</a>
      </div>

      <h2>Same size, built completely differently</h2>
      <p style={{ maxWidth: "68ch", marginTop: -6, marginBottom: 4 }}>
        The total tells you how much. It tells you nothing about what kind of country it
        is. Switch between these and watch the bar re-shape — one is almost entirely
        people, another is mostly what is buried under it.
      </p>
      <CompositionBar
        compositions={allCompositions()}
        extremes={compositionExtremes()}
      />

      <h2>Ranked by total wealth</h2>
      <table className="plain">
        <thead>
          <tr>
            <th style={{ width: "2.5rem" }}>#</th>
            <th>Country</th>
            <th style={{ textAlign: "right" }}>Total</th>
            <th style={{ textAlign: "right" }}>Per person</th>
            <th>Region</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.c.iso3}>
              <td className="num muted small">{i + 1}</td>
              <td>
                <a href={r.c.iso3 === "GBR" ? "/country/uk" : `/country/${r.c.iso3.toLowerCase()}`}>
                  {r.c.name}
                </a>
              </td>
              <td className="num">{formatValue(r.wealth, "USD")}</td>
              <td className="num muted">
                {r.perCapita ? formatValue(r.perCapita, "USD") : "—"}
              </td>
              <td className="small muted">{r.c.region}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>What this list does not include</h2>
      <ul style={{ paddingLeft: 18, color: "var(--ink-2)", maxWidth: "70ch" }}>
        <li style={{ marginBottom: 6 }}>
          Countries the World Bank doesn’t publish wealth accounts for — roughly 65 of the
          217 economies it tracks, mostly very small states and those with disrupted
          statistics.
        </li>
        <li style={{ marginBottom: 6 }}>
          Anything after {CWON_YEAR}. This is the most recent year published, so no
          inflation shock, rate cycle or recovery since then is reflected.
        </li>
        <li style={{ marginBottom: 6 }}>
          The events that moved each number. We’ve researched those for the United Kingdom
          only — every other timeline is empty, and filling one in is the single most
          useful contribution anyone could make.
        </li>
      </ul>

      <footer className="foot">
        Source: World Bank, Changing Wealth of Nations ({CWON_YEAR}) and World Development
        Indicators, used under CC BY 4.0.
      </footer>
    </main>
  );
}
