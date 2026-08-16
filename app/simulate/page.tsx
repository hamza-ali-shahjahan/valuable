import FounderSimulator from "../../components/FounderSimulator.tsx";

export const metadata = {
  title: "What's my startup worth — and what should I fix first? | Valuable",
  description:
    "Put in your own numbers and get a valuation range, plus a ranked list of which " +
    "single thing to fix before you raise. Nothing is stored.",
};

export default function SimulatePage() {
  return (
    <main className="wrap">
      <h1>What is your startup worth — and what would move it?</h1>
      <p className="lede">
        Put in eight numbers you already know. You get a range, not a fantasy figure, and
        a ranked list of what to fix before an investor finds it.
      </p>

      <FounderSimulator />

      <h2>Three things this refuses to do</h2>

      <div className="claim">
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Give you one number</div>
        <p className="small" style={{ color: "var(--ink-2)", margin: 0, maxWidth: "68ch" }}>
          At your stage almost everything that sets a valuation is unknowable — when you
          exit, what multiple you get, whether you survive. A single figure would be a
          guess wearing a suit. The code that produces this literally cannot return one.
        </p>
      </div>

      <div className="claim">
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Accept a top-down market size</div>
        <p className="small" style={{ color: "var(--ink-2)", margin: 0, maxWidth: "68ch" }}>
          “The market is $50 billion and we only need 2%” is the single most common way to
          lose a room. It tells an investor you have no idea who your customers are or what
          they will pay. The only market size worth stating is the number of accounts you
          can actually reach, times what each one pays.
        </p>
      </div>

      <div className="claim">
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Flatter you</div>
        <p className="small" style={{ color: "var(--ink-2)", margin: 0, maxWidth: "68ch" }}>
          Growth is assumed to slow, because it always does. Failure odds come from real
          survival data and are applied openly rather than buried inside a scary discount
          rate. If the answer looks small, that is the answer — and better to see it here
          than infer it from a room going quiet.
        </p>
      </div>

      <h2>Why the pattern beats the checklist</h2>
      <p style={{ maxWidth: "68ch" }}>
        Companies are not turned down for one bad number. They are turned down for a
        <em> shape</em> — decent revenue with slow growth, thin margins and weak
        efficiency reads as a business that will not compound, whatever the headline
        figure says.
      </p>
      <p style={{ maxWidth: "68ch" }}>
        The reverse is also true, and it is the more useful half: strong retention and
        strong efficiency clear the bar at a <strong>lower</strong> revenue than the
        benchmarks suggest. That is why this ranks your gaps rather than scoring you out
        of ten.
      </p>

      <footer className="foot">
        Benchmarks by stage from private B2B software data. Failure rates from US business
        survival statistics for the information sector. Every figure and threshold used
        here is listed on the <a href="/sources">sources page</a>.
      </footer>
    </main>
  );
}
