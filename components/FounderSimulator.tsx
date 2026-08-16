"use client";

/**
 * The founder tool — the "what would move it" half of the promise.
 *
 * DESIGN INTENT: the levers are the product, not the valuation. Any spreadsheet can
 * produce a number. What a founder cannot get anywhere is an honest ranking of which
 * single thing to fix first, and why an investor will care about that one.
 *
 * Nothing is sent anywhere. It all runs in the browser and is forgotten when you close
 * the tab — which is also why there is no account and nothing to sign up for.
 */

import { useState, useMemo } from "react";
import {
  rankLevers, founderValuation, rateBurnMultiple, burnMultiple,
  STAGE_THRESHOLDS, type Stage, type FounderInputs,
} from "../engine/startup.ts";

const STAGES: { key: Stage; label: string; hint: string }[] = [
  { key: "pre_seed", label: "Pre-seed", hint: "before real revenue" },
  { key: "seed", label: "Seed", hint: "first paying customers" },
  { key: "series_a", label: "Series A", hint: "repeatable sales" },
  { key: "series_b", label: "Series B", hint: "scaling what works" },
];

const money = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(1)}m` : `$${Math.round(n).toLocaleString("en-GB")}`;

interface Field {
  key: keyof FounderInputs;
  label: string;
  hint: string;
  kind: "money" | "percent" | "multiple";
}

const FIELDS: Field[] = [
  { key: "arr", label: "Yearly recurring revenue", hint: "What your customers pay you over a year, at today's run rate", kind: "money" },
  { key: "growthRate", label: "Growth over the last year", hint: "200% means you tripled", kind: "percent" },
  { key: "grossMargin", label: "Gross margin", hint: "What's left of revenue after the cost of delivering it", kind: "percent" },
  { key: "ndr", label: "Revenue kept from existing customers", hint: "Over 100% means they grow without you selling again", kind: "percent" },
  { key: "logoRetention", label: "Customers kept", hint: "The share still with you a year later", kind: "percent" },
  { key: "netNewArr", label: "New recurring revenue added", hint: "Over the last year, after losses", kind: "money" },
  { key: "netBurn", label: "Cash burned", hint: "Over the same year", kind: "money" },
  { key: "salesAndMarketing", label: "Spent on sales and marketing", hint: "Over the same year", kind: "money" },
];

const DEFAULTS: FounderInputs = {
  stage: "seed",
  arr: 1_200_000,
  growthRate: 1.8,
  grossMargin: 0.72,
  ndr: 0.96,
  grr: 0.88,
  logoRetention: 0.83,
  netBurn: 2_400_000,
  netNewArr: 800_000,
  cac: 18_000,
  arpa: 24_000,
  fcfMargin: -1.2,
  salesAndMarketing: 900_000,
};

export default function FounderSimulator() {
  const [inputs, setInputs] = useState<FounderInputs>(DEFAULTS);

  const result = useMemo(() => {
    const ranked = rankLevers(inputs);
    const valuation = founderValuation({ inputs });
    const bm = burnMultiple(inputs.netBurn, inputs.netNewArr);
    return { ranked, valuation, bm, band: rateBurnMultiple(bm, "saas") };
  }, [inputs]);

  const { ranked, valuation } = result;
  const set = (k: keyof FounderInputs, v: number) =>
    setInputs((p) => ({ ...p, [k]: v }));

  const display = (f: Field) => {
    const raw = inputs[f.key] as number;
    return f.kind === "percent" ? Math.round(raw * 100) : Math.round(raw);
  };
  const parse = (f: Field, v: string) => {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(n)) return;
    set(f.key, f.kind === "percent" ? n / 100 : n);
  };

  const verdict = {
    ready: { label: "This pattern raises", tone: "badge-ok" },
    borderline: { label: "This pattern raises with a good story", tone: "badge-assume" },
    not_ready: { label: "This pattern gets passed on", tone: "badge-warn" },
  }[ranked.readiness];

  const failing = ranked.levers.filter((l) => !l.passing);
  const t = STAGE_THRESHOLDS[inputs.stage];

  return (
    <div className="sim">
      {/* ------------------------------------------------------ your numbers */}
      <div className="sim-form">
        <div className="sim-stage">
          <div className="dial-label">Where you are</div>
          <div className="sim-stage-row">
            {STAGES.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`sim-stage-btn${inputs.stage === s.key ? " on" : ""}`}
                onClick={() => setInputs((p) => ({ ...p, stage: s.key }))}
              >
                <span>{s.label}</span>
                <span className="sim-stage-hint">{s.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sim-fields">
          {FIELDS.map((f) => (
            <label className="sim-field" key={f.key}>
              <span className="sim-field-label">{f.label}</span>
              <span className="sim-input">
                {f.kind === "money" && <span className="sim-affix">$</span>}
                <input
                  type="text"
                  inputMode="numeric"
                  value={display(f)}
                  onChange={(e) => parse(f, e.target.value)}
                  aria-label={f.label}
                />
                {f.kind === "percent" && <span className="sim-affix">%</span>}
              </span>
              <span className="sim-field-hint">{f.hint}</span>
            </label>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 4 }}>
          Nothing is sent anywhere. This runs in your browser and is gone when you close
          the tab.
        </p>
      </div>

      {/* -------------------------------------------------- what to fix first */}
      <h2>What to fix first</h2>
      <p style={{ maxWidth: "68ch", marginTop: -6 }}>
        Ordered by what is broken, then by how much it moves your valuation. Investors
        turn companies down on the <em>pattern</em>, not on any single number — so the
        top of this list is where the pattern breaks.
      </p>

      <div className={`sim-verdict ${ranked.readiness}`}>
        <span className={`badge ${verdict.tone}`}>{verdict.label}</span>
        <p>{ranked.pattern}</p>
      </div>

      <ol className="sim-levers">
        {ranked.levers.map((l, i) => (
          <li className={`sim-lever${l.passing ? " ok" : " gap"}`} key={l.metric}>
            <span className="sim-lever-rank">{i + 1}</span>
            <span className="sim-lever-body">
              <span className="sim-lever-head">
                <strong>{l.metric}</strong>
                <span className={`badge ${l.passing ? "badge-ok" : "badge-warn"}`}>
                  {l.passing ? "clears the bar" : "below the bar"}
                </span>
              </span>
              <span className="sim-lever-nums">
                you <strong>{fmt(l.metric, l.current)}</strong>
                {"  ·  "}
                needed at {STAGES.find((s) => s.key === inputs.stage)!.label.toLowerCase()}{" "}
                <strong>{fmt(l.metric, l.threshold)}</strong>
              </span>
              <span className="sim-lever-action">{l.action}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* -------------------------------------------------------- the number */}
      <h2>What that's worth today</h2>
      <div className="claim">
        <div className="claim-q">
          What an investor could pay now and still hit the return they need
        </div>
        <span className="claim-value">
          {money(valuation.range.low)} – {money(valuation.range.high)}
        </span>
        <p style={{ fontSize: 16, margin: "0 0 10px", maxWidth: "62ch" }}>
          A range, never a single figure. Anyone quoting one number for a company at your
          stage is guessing with more confidence than the maths allows.
        </p>
        <p className="small" style={{ color: "var(--ink-2)", maxWidth: "66ch", margin: 0 }}>
          At this growth your revenue reaches about {money(valuation.exitRevenue)} in eight
          years, worth roughly {money(valuation.exitValue)} on sale. To make their return
          an investor needs about{" "}
          <strong>{(valuation.ownershipRequired * 100).toFixed(1)}%</strong> of you — and{" "}
          <strong>that</strong> is what sets the price. They negotiate ownership; the
          valuation is what falls out of it.
        </p>
      </div>

      <details className="detail" style={{ marginTop: 8 }}>
        <summary>The six things we had to assume, and why they matter</summary>
        <table className="plain" style={{ marginTop: 12 }}>
          <thead><tr><th>Assumption</th><th>Used</th><th>Why it matters</th></tr></thead>
          <tbody>
            {valuation.assumptions.map((a) => (
              <tr key={a.label}>
                <td>{a.label}</td>
                <td className="num">{a.value}</td>
                <td className="small" style={{ color: "var(--ink-2)" }}>{a.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      {failing.length > 0 && (
        <div className="warning" style={{ marginTop: 18 }}>
          <span className="warning-mark" aria-hidden>!</span>
          <span>
            {failing.length === 1
              ? `One thing is below the bar for ${STAGES.find((s) => s.key === inputs.stage)!.label}: ${failing[0]!.metric.toLowerCase()}.`
              : `${failing.length} things are below the bar for ${STAGES.find((s) => s.key === inputs.stage)!.label}.`}{" "}
            Fixing the top one moves your valuation further than anything else on the
            list — and it is the first thing an investor will find.
          </span>
        </div>
      )}

      <div className="warning" style={{ marginTop: 10 }}>
        <span className="warning-mark" aria-hidden>!</span>
        <span>
          A burn multiple of <strong>{result.bm.toFixed(1)}×</strong> is “{result.band.label}”
          on the scale this is measured against ({result.band.denominator}). Note the
          signal is the <em>direction</em> — a burn multiple getting worse as you scale
          reads as broken economics however fast you are growing. At your stage the bar is{" "}
          {t.burnMultiple.toFixed(1)}×.
        </span>
      </div>
    </div>
  );
}

/** Format a lever's value in the unit a founder actually thinks in. */
function fmt(metric: string, v: number): string {
  if (metric === "ARR") return money(v);
  if (metric === "CAC payback") return `${v.toFixed(0)} months`;
  if (metric === "Burn multiple") return `${v.toFixed(1)}×`;
  if (metric === "Growth rate") return `${Math.round(v * 100)}%`;
  return `${Math.round(v * 100)}%`;
}
