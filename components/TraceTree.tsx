/**
 * The recursive audit-trail renderer — the signature component.
 *
 * READING ORDER IS THE DESIGN. Plain English comes first and largest; the notation,
 * source and vintage sit underneath it. Nothing is hidden from an expert, but nobody
 * has to read a symbol to follow the argument.
 *
 *   ●  a figure someone measured        (green)
 *   ▸  another calculation, opens up    (blue)
 *   ◆  a judgement we made              (amber — the contestable part)
 */

import { formatValue, challengeUrl, type Trace, type TraceNode } from "../engine/trace.ts";

const Observed = ({ n }: { n: Extract<TraceNode, { kind: "observed" }> }) => (
  <li className="node node-observed">
    <span className="node-mark" aria-hidden>●</span>
    <span className="node-label">
      <span className="node-name">{n.label}</span>
      {n.plain && <span className="node-plain">{n.plain}</span>}
      <span className="node-sub">
        Measured by{" "}
        {n.url ? <a href={n.url} target="_blank" rel="noreferrer">{n.source}</a> : n.source}
        {" · figure for "}{n.asOf}
        {n.needsVerification && (
          <> · <span className="badge badge-warn">we haven’t checked this yet</span></>
        )}
      </span>
    </span>
    <span className="node-value">{formatValue(n.value, n.unit)}</span>
  </li>
);

const Assumption = ({
  n, trace,
}: { n: Extract<TraceNode, { kind: "assumption" }>; trace: Trace }) => (
  <li className="node node-assumption">
    <span className="node-mark" aria-hidden>◆</span>
    <span className="node-label">
      <span className="node-name">
        {n.label} <span className="badge badge-assume">our judgement, not a measurement</span>
      </span>
      {n.plain && <p className="rationale">{n.plain}</p>}
      <details className="detail">
        <summary>The technical reasoning</summary>
        <p className="rationale" style={{ marginTop: 8 }}>{n.rationale}</p>
        <span className="node-sub">{n.ref}</span>
      </details>
      <a
        className="challenge"
        href={challengeUrl(trace, { kind: "input", label: n.label })}
        target="_blank" rel="noreferrer"
      >
        Think this is wrong? Say so →
      </a>
    </span>
    <span className="node-value">{formatValue(n.value, n.unit)}</span>
  </li>
);

const Derived = ({
  n, depth,
}: { n: Extract<TraceNode, { kind: "derived" }>; depth: number }) => (
  <li className="node node-derived">
    <div className="node-derived-head">
      <span className="node-mark" aria-hidden>▸</span>
      <span className="node-label">
        <span className="node-name">{n.label}</span>
        {n.trace.plain && <span className="node-plain">{n.trace.plain}</span>}
        <span className="node-sub">
          Worked out separately — <a href={`/trace/${n.trace.hash}`}>see that calculation</a>
        </span>
      </span>
      <span className="node-value">{formatValue(n.value, n.trace.unit)}</span>
    </div>
    <div className="child">
      <TraceTree trace={n.trace} depth={depth + 1} />
    </div>
  </li>
);

export default function TraceTree({ trace, depth = 0 }: { trace: Trace; depth?: number }) {
  return (
    <div className={depth === 0 ? "trace" : undefined}>
      {trace.plain && <p className="formula-plain">{trace.plain}</p>}

      <details className="detail detail-formula">
        <summary>Written as a formula</summary>
        <div className="formula">{trace.formula}</div>
        <div className="formula-ref">Defined in {trace.ref}</div>
      </details>

      <p className="section-hint">
        {depth === 0 ? "What goes into it" : "What goes into that"}
      </p>

      <ul className="nodes">
        {trace.inputs.map((n, i) => {
          switch (n.kind) {
            case "observed": return <Observed key={i} n={n} />;
            case "assumption": return <Assumption key={i} n={n} trace={trace} />;
            case "derived": return <Derived key={i} n={n} depth={depth} />;
          }
        })}
      </ul>

      {trace.steps.length > 0 && (
        <div className="steps">
          <p className="section-hint">The arithmetic</p>
          {trace.steps.map((s, i) => (
            <div className="step" key={i}>
              {s.plain && <span className="step-plain">{s.plain}</span>}
              <span className="step-sum">{s.expression}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
