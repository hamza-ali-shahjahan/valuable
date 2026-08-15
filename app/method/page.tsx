import { REFUTED_FIGURES } from "../../engine/events.ts";
import { ENGINE_VERSION, CANONICAL_PRECISION } from "../../engine/trace.ts";

export default function MethodPage() {
  return (
    <main className="wrap">
      <h1>Method</h1>
      <p className="lede">
        Every number here is derived from a written formula, computed from sourced inputs,
        and published with a fingerprint you can recompute. This page is the short version;
        the long version is in the repository.
      </p>

      <h2>Three things we refuse to do</h2>

      <div className="claim">
        <div className="node-name" style={{ fontWeight: 600, marginBottom: 6 }}>
          Publish one number for a country
        </div>
        <p className="small" style={{ color: "var(--ink-2)", maxWidth: "68ch", margin: 0 }}>
          “How much is the UK worth” has four defensible answers spanning an order of
          magnitude — £2.74tn of listed equity, £13.31tn on the national balance sheet,
          roughly £38.8tn including human capital, and a sovereign fiscal capacity near
          zero. They answer different questions about different claims. Averaging them is
          a category error, so we publish them separately.
        </p>
      </div>

      <div className="claim">
        <div className="node-name" style={{ fontWeight: 600, marginBottom: 6 }}>
          Give a point estimate where the uncertainty is bigger than the signal
        </div>
        <p className="small" style={{ color: "var(--ink-2)", maxWidth: "68ch", margin: 0 }}>
          Human capital moves close to 1:1 with the discount rate. Natural capital roughly
          doubles when that rate goes from 4% to 2%. Both swings are larger than the
          year-on-year change a tracker would report. Country and startup valuations are
          returned as ranges — enforced by the type system, not by discipline.
        </p>
      </div>

      <div className="claim">
        <div className="node-name" style={{ fontWeight: 600, marginBottom: 6 }}>
          Fit our maths to someone else’s published figure
        </div>
        <p className="small" style={{ color: "var(--ink-2)", maxWidth: "68ch", margin: 0 }}>
          One disagreement is live right now. Damodaran’s published breakeven revenue for
          Nvidia is $483.38bn; the plain Gordon inversion of his four stated inputs gives
          $362.8bn. We could not reconstruct the gap, so our test suite asserts{" "}
          <em>that the gap exists</em> rather than tuning a coefficient until it vanishes.
        </p>
      </div>

      <h2>How the fingerprint works</h2>
      <p className="small" style={{ maxWidth: "70ch" }}>
        Each working is hashed over its formula, its reference, the question it answers,
        its unit, every input, every step, and the engine version. Numbers are rounded to{" "}
        {CANONICAL_PRECISION} significant figures first — enough to absorb floating-point
        noise from equivalent-but-reordered arithmetic, far more than any valuation could
        justify. Object keys are sorted. No wall-clock time is used anywhere in the
        engine, so a re-run in a year reproduces the same result.
      </p>
      <div className="hash-block">
        hash = sha256( canonical(&#123; formula, ref, question, unit, inputs, steps, engineVersion, value &#125;) )
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        Current engine: <code>{ENGINE_VERSION}</code>. A method change bumps the version,
        which changes every hash — old ones stay resolvable rather than being rewritten.
      </p>

      <h2>Figures we refuse to repeat</h2>
      <p className="small" style={{ maxWidth: "70ch" }}>
        These are widely circulated and wrong. They are stored in the codebase precisely{" "}
        <em>because</em> they are plausible and repeated, so they cannot creep back in. The
        pattern across all of them is vintage and basis error, not fabrication — a figure
        correct on publication becomes wrong when the series is revised, and keeps
        circulating anyway.
      </p>
      <table className="plain">
        <thead>
          <tr><th>Circulating claim</th><th>What it should be</th></tr>
        </thead>
        <tbody>
          {REFUTED_FIGURES.map((r) => (
            <tr key={r.claim}>
              <td>{r.claim}</td>
              <td className="small" style={{ color: "var(--ink-2)" }}>
                {r.correction}
                <div className="muted" style={{ marginTop: 3 }}>{r.note}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Evidence tiers</h2>
      <p className="small" style={{ maxWidth: "70ch" }}>
        When we say a policy moved a country’s value, the claim carries how it was
        identified. A <strong>measured</strong> effect has a counterfactual behind it — a
        synthetic control, a difference-in-differences, a discontinuity. A{" "}
        <strong>narrative</strong> claim does not, and structurally cannot carry a number:
        the type has no field for one.
      </p>
      <p className="small" style={{ maxWidth: "70ch" }}>
        This matters more than it sounds. Of thirteen well-known policy episodes we
        researched, only six have a genuine counterfactual. Singapore, Saudi Vision 2030,
        Rwanda and Ireland’s 12.5% rate have none — and Rwanda’s underlying poverty data is
        actively disputed. An authoritative body’s published assumption is also not an
        estimate: the OBR’s 15% trade-intensity and 4% productivity figures are stored as
        narrative, because authority is not identification.
      </p>

      <footer className="foot">
        Full method: <code>docs/00-FIRST-PRINCIPLES.md</code> ·{" "}
        <code>docs/01-DATA-SPINE.md</code> · <code>docs/02-EVENT-CORPUS.md</code>
      </footer>
    </main>
  );
}
