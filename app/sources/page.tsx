import { sourcesInUse, REFUSED } from "../../engine/sources.ts";

export default function SourcesPage() {
  const sources = sourcesInUse();
  const totalFigures = sources.reduce((s, x) => s + x.figures, 0);

  return (
    <main className="wrap">
      <h1>Where every number comes from</h1>
      <p className="lede">
        Nothing here is our own estimate of the world. Every figure is measured by a
        statistics office and published openly — this page lists all of them, what each
        one feeds, and whether we’re allowed to pass it on.
      </p>
      <p className="small muted" style={{ maxWidth: "68ch" }}>
        This list is generated from the figures actually in use, not written by hand — so
        it can’t drift out of date. {sources.length} sources behind {totalFigures}{" "}
        published figures.
      </p>

      <h2>What we use</h2>
      {sources.map((s) => (
        <div className="claim" key={s.name}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "baseline" }}>
            <div>
              <div style={{ fontSize: 19, fontWeight: 600 }}>{s.name}</div>
              <p style={{ fontSize: 15, color: "var(--ink-2)", margin: "6px 0 0", maxWidth: "56ch" }}>
                {s.feeds}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="stat-value" style={{ fontSize: 22 }}>{s.figures}</div>
              <div className="small muted">
                figure{s.figures === 1 ? "" : "s"} depend on it
              </div>
            </div>
          </div>

          <div className="claim-meta" style={{ marginTop: 14 }}>
            <span className={`badge ${s.redistributable ? "badge-ok" : "badge-warn"}`}>
              {s.redistributable ? "✓ we may pass this on" : "signal only"}
            </span>
            <span>
              measured {s.earliest === s.latest ? s.earliest : `${s.earliest} → ${s.latest}`}
            </span>
            {s.unverified > 0 && (
              <span className="badge badge-warn">
                {s.unverified} figure{s.unverified === 1 ? "" : "s"} we haven’t checked
              </span>
            )}
          </div>

          <p className="small" style={{ color: "var(--ink-2)", marginTop: 12, marginBottom: 0, maxWidth: "66ch" }}>
            <strong>Licence:</strong> {s.licence}
          </p>

          <div className="claim-meta" style={{ marginTop: 12 }}>
            {s.url && (
              <a href={s.url} target="_blank" rel="noreferrer">Go to the source →</a>
            )}
            {s.example && (
              <a href={s.example.href}>See it used in {s.example.label} →</a>
            )}
          </div>
        </div>
      ))}

      <h2>What we refuse to use, and why</h2>
      <p style={{ maxWidth: "68ch", marginTop: -6 }}>
        This is the more useful half of the page. Several obvious sources for a project
        like this are barred by their own terms, and using them anyway would put every
        number here on shaky ground.
      </p>
      <table className="plain">
        <thead>
          <tr><th style={{ width: "34%" }}>Source</th><th>Why not</th></tr>
        </thead>
        <tbody>
          {REFUSED.map((r) => (
            <tr key={r.name}>
              <td><strong>{r.name}</strong></td>
              <td style={{ color: "var(--ink-2)" }}>{r.why}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Check any of it yourself</h2>
      <p style={{ maxWidth: "68ch" }}>
        Every published number links to the full list of figures behind it, each showing
        which office measured it and when. Follow it down to the source and back. If a
        figure and its working ever drift apart, one command catches it.
      </p>
      <div className="hash-block">$ bun run verify</div>

      <h2>Found a licence we’ve got wrong?</h2>
      <p style={{ maxWidth: "68ch" }}>
        In either direction — something we refuse that we could use, or something we use
        that we shouldn’t. That’s one of the most useful corrections anyone can send.
      </p>
      <a
        className="challenge"
        href="https://github.com/hamza-ali-shahjahan/valuable/issues/new?template=source.yml"
        target="_blank" rel="noreferrer"
      >
        Tell us about a source →
      </a>

      <footer className="foot">
        Contains information from the World Bank (CC BY 4.0), Eurostat (Commission Decision
        2011/833/EU), and public sector information licensed under the Open Government
        Licence v3.0.
      </footer>
    </main>
  );
}
