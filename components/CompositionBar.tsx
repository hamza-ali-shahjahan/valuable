"use client";

/**
 * What a country is actually made of.
 *
 * The second and last piece of motion on this site. It animates ONLY when you switch
 * country, never on load — because the re-shaping IS the comparison. Watching the bar
 * snap from Singapore (79% people) to Lao PDR (74% land and resources) tells you these
 * are structurally different economies faster than any sentence could.
 *
 * On a single country page there is nothing to compare, so it renders static.
 */

import { useState, useMemo } from "react";
import type { Composition } from "../engine/countries.ts";
import { formatValue } from "../engine/trace.ts";

const SEGMENTS = [
  { key: "produced", label: "What it has built", colour: "var(--derived)",
    hint: "Homes, offices, factories, roads, machinery" },
  { key: "human", label: "Its people", colour: "var(--observed)",
    hint: "What everyone will earn over the rest of their working lives" },
  { key: "natural", label: "Land and resources", colour: "var(--assumption)",
    hint: "Farmland, forests, fisheries, and oil, gas and minerals in the ground" },
] as const;

const Bar = ({ c }: { c: Composition }) => (
  <>
    <div className="comp-bar" role="img"
      aria-label={SEGMENTS.map((s) => `${s.label} ${(c[s.key] * 100).toFixed(0)}%`).join(", ")}>
      {SEGMENTS.map((s) => (
        <div
          key={s.key}
          className="comp-seg"
          style={{ width: `${c[s.key] * 100}%`, background: s.colour }}
          title={`${s.label}: ${(c[s.key] * 100).toFixed(1)}%`}
        >
          {c[s.key] > 0.11 && (
            <span className="comp-seg-pct">{(c[s.key] * 100).toFixed(0)}%</span>
          )}
        </div>
      ))}
    </div>

    <div className="comp-key">
      {SEGMENTS.map((s) => (
        <div className="comp-key-item" key={s.key}>
          <span className="comp-swatch" style={{ background: s.colour }} />
          <span>
            <strong>{s.label}</strong> — {(c[s.key] * 100).toFixed(0)}%
            <span className="comp-key-hint">{s.hint}</span>
          </span>
        </div>
      ))}
    </div>
  </>
);

export function StaticComposition({ composition }: { composition: Composition }) {
  return (
    <div className="comp">
      <Bar c={composition} />
      <p className="comp-foot">
        Shares of what {composition.name} holds inside its own borders. On top of that it{" "}
        {composition.netForeign < 0 ? "owes the rest of the world" : "is owed by the rest of the world"}{" "}
        a net {formatValue(Math.abs(composition.netForeign), "USD")}, which is{" "}
        {composition.netForeign < 0 ? "subtracted from" : "added to"} the headline total.
      </p>
    </div>
  );
}

export default function CompositionBar({
  compositions, extremes,
}: {
  compositions: readonly Composition[];
  extremes: readonly { composition: Composition; why: string }[];
}) {
  // A to Z. The list arrives sorted by wealth, which is right for a ranking and useless
  // in a picker — India sat at position 8 and Pakistan at 43 among 149 unlabelled rows.
  const alphabetical = useMemo(
    () => [...compositions].sort((a, b) => a.name.localeCompare(b.name)),
    [compositions],
  );
  const [iso3, setIso3] = useState(extremes[0]?.composition.iso3 ?? compositions[0]!.iso3);
  const current = compositions.find((c) => c.iso3 === iso3) ?? compositions[0]!;
  const note = extremes.find((e) => e.composition.iso3 === iso3)?.why;

  return (
    <div className="comp comp-interactive">
      <div className="comp-head">
        <div>
          <div className="comp-name">{current.name}</div>
          <div className="comp-total">{formatValue(current.total, "USD")} in total</div>
        </div>
        <label className="comp-picker">
          <span className="comp-picker-label">Compare</span>
          <select value={iso3} onChange={(e) => setIso3(e.target.value)}>
            {alphabetical.map((c) => (
              <option key={c.iso3} value={c.iso3}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>

      <Bar c={current} />

      <p className="comp-foot" style={{ minHeight: "2.6em" }}>
        {note ?? (
          <>
            Shares of what {current.name} holds inside its own borders. Switch country and
            watch the bar re-shape — two economies with similar totals can be built
            completely differently underneath.
          </>
        )}
      </p>

      {extremes.length > 0 && (
        <div className="comp-presets">
          <span className="comp-presets-label">Try:</span>
          {extremes.map((e) => (
            <button
              key={e.composition.iso3}
              type="button"
              className={`comp-preset${e.composition.iso3 === iso3 ? " comp-preset-on" : ""}`}
              onClick={() => setIso3(e.composition.iso3)}
            >
              {e.composition.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
