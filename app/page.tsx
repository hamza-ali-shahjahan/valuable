import { ukValuation, allEntries } from "../lib/registry.ts";
import { formatValue } from "../engine/trace.ts";
import { valuableCountries } from "../engine/countries.ts";

export default function Home() {
  const v = ukValuation();
  const netWorth = v.claims[0]!;
  const entries = allEntries();
  const withheld = entries.filter((e) => !e.publishable).length;

  return (
    <main className="wrap">
      <h1 style={{ maxWidth: "18ch" }}>Valuations you can check.</h1>
      <p className="lede">
        What a country, a city, a company or your startup is worth — published with the
        complete working, so anyone can recompute it and prove we didn’t cheat.
      </p>
      <p className="lede" style={{ fontSize: 15 }}>
        Most valuation tools ask you to trust a number. This one shows you every input,
        every step, and every judgement call behind it — then hands you a fingerprint so
        you can verify nothing drifted, and a link to argue with any single step.
      </p>

      <h2>Start here</h2>
      <div className="claim">
        <div className="claim-q">Every country we can value, ranked and checkable</div>
        <span className="claim-value">{valuableCountries().length}</span>
        <p style={{ fontSize: 16, margin: "0 0 10px", maxWidth: "60ch" }}>
          Measured the same way everywhere, so they can honestly be compared.
        </p>
        <div className="claim-meta">
          <a href="/countries">See all countries →</a>
        </div>
      </div>
      <div className="claim">
        <div className="claim-q">{netWorth.question}</div>
        <span className="claim-value">
          {formatValue(netWorth.traced.value, netWorth.traced.trace.unit)}
        </span>
        <div className="claim-meta">
          <a href="/country/uk">United Kingdom →</a>
          <a href={`/trace/${netWorth.traced.trace.hash}`}>see the working →</a>
          <span className="badge badge-ok">✓ verified</span>
        </div>
      </div>

      <h2>How it works</h2>
      <div className="grid-2">
        <div className="stat">
          <div className="stat-label">Three kinds of input</div>
          <p className="stat-note" style={{ marginTop: 8 }}>
            <span style={{ color: "var(--observed)" }}>●</span> figures read from a
            primary source, with their vintage.{" "}
            <span style={{ color: "var(--derived)" }}>▸</span> other computations, which
            you can drill into.{" "}
            <span style={{ color: "var(--assumption)" }}>◆</span> judgements we made — the
            contestable part, always marked as such.
          </p>
        </div>
        <div className="stat">
          <div className="stat-label">Verifiable, not just transparent</div>
          <p className="stat-note" style={{ marginTop: 8 }}>
            Each working carries a fingerprint computed from its inputs, its formula and
            the engine version. Recompute it; if it matches, the number and its working
            have not drifted apart.
          </p>
        </div>
        <div className="stat">
          <div className="stat-label">Nothing published on faith</div>
          <p className="stat-note" style={{ marginTop: 8 }}>
            {withheld > 0
              ? `${withheld} figure${withheld === 1 ? " is" : "s are"} currently withheld because an input has not been confirmed against a primary source. The maths is fine; the provenance isn’t.`
              : "Every figure’s inputs are confirmed against a primary source."}
          </p>
        </div>
        <div className="stat">
          <div className="stat-label">Peer reviewed, genuinely</div>
          <p className="stat-note" style={{ marginTop: 8 }}>
            Methods, data and sources are public. A challenge is an issue against a
            specific step; an improvement is a pull request. We seeded it with our own
            unresolved disagreements.
          </p>
        </div>
      </div>

      <h2>What isn’t built yet</h2>
      <p className="small" style={{ maxWidth: "70ch", color: "var(--ink-2)" }}>
        Only the United Kingdom has a researched history of what moved its number — every
        other country’s timeline is empty. Cities, companies and the founder tool run on
        the same engine but aren’t published. And the newest wealth figures any statistics
        office publishes are from 2020, so nothing here reflects the last five years.
      </p>

      <footer className="foot">
        Built in the open. Every figure carries its source and vintage; where our maths
        disagrees with a published figure we flag it rather than fitting to it.
      </footer>
    </main>
  );
}
