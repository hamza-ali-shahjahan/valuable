"use client";

/**
 * The one piece of motion on this site that earns its place.
 *
 * The product's central honesty claim — that one unmeasurable judgement moves the answer
 * by roughly a quarter — is abstract as a sentence. Dragging it makes it felt, and that
 * is the whole argument for why judgements are marked, challengeable, and never blended
 * into the headline.
 *
 * Motion here increases honesty rather than polish. Every other valuation site hides this
 * sensitivity; we dramatise it.
 */

import { useState } from "react";
import {
  totalAtRate, sensitivityPerPercentagePoint, CONVENTION_MARKS,
  type HumanCapitalModel,
} from "../engine/sensitivity.ts";
import { formatValue } from "../engine/trace.ts";

const MIN = 0.02;
const MAX = 0.06;

export default function SensitivityDial({
  model, otherComponents, unit, publishedTotal,
}: {
  model: HumanCapitalModel;
  otherComponents: number;
  unit: string;
  publishedTotal: number;
}) {
  const [rate, setRate] = useState(model.baselineRate);
  const point = totalAtRate(model, otherComponents, rate);
  const perPp = sensitivityPerPercentagePoint(model);
  const moved = Math.abs(point.changeFromBaseline) > 0.001;
  const pos = ((rate - MIN) / (MAX - MIN)) * 100;

  return (
    <div className="dial">
      <p className="dial-lede">
        We had to choose how much a pound earned decades from now is worth today. Nobody
        measured that number — we picked it. <strong>Drag it and watch what happens.</strong>
      </p>

      <div className="dial-readout">
        <div>
          <div className="dial-label">Discount rate</div>
          <div className="dial-rate">{(rate * 100).toFixed(2)}%</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="dial-label">
            {moved ? "What the answer becomes" : "The published answer"}
          </div>
          <div className={`dial-total${moved ? " dial-total-moved" : ""}`}>
            {formatValue(point.total, unit)}
          </div>
        </div>
      </div>

      <div className="dial-track-wrap">
        <input
          type="range"
          className="dial-range"
          min={MIN} max={MAX} step={0.0005}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          aria-label="Discount rate"
          aria-valuetext={`${(rate * 100).toFixed(2)} percent, giving ${formatValue(point.total, unit)}`}
        />
        <div className="dial-marks" aria-hidden>
          {CONVENTION_MARKS.map((m) => (
            <button
              key={m.label}
              type="button"
              className="dial-mark"
              style={{ left: `${((m.rate - MIN) / (MAX - MIN)) * 100}%` }}
              onClick={() => setRate(m.rate)}
              title={m.note}
            >
              <span className="dial-mark-tick" />
              <span className="dial-mark-label">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="dial-change" style={{ opacity: moved ? 1 : 0.55 }}>
        {moved ? (
          <>
            That is{" "}
            <strong className={point.changeFromBaseline < 0 ? "effect-neg" : "effect-pos"}>
              {point.changeFromBaseline > 0 ? "+" : "−"}
              {Math.abs(point.changeFromBaseline * 100).toFixed(1)}%
            </strong>{" "}
            against the published {formatValue(publishedTotal, unit)} — from moving one
            number that nobody measured.{" "}
            <button type="button" className="dial-reset" onClick={() => setRate(model.baselineRate)}>
              put it back
            </button>
          </>
        ) : (
          <>
            At the published rate this is exactly the figure we publish. Move the slider,
            or jump between the two statistics offices above.
          </>
        )}
      </p>

      <details className="detail" style={{ marginTop: 14 }}>
        <summary>How this is worked out, and why it’s only an approximation</summary>
        <p className="rationale" style={{ marginTop: 8 }}>
          Every {(1).toFixed(0)} percentage point on the rate moves the people figure by
          roughly <strong>{(perPp * 100).toFixed(0)}%</strong> in our model. What matters
          isn’t the rate on its own but the gap between it and assumed wage growth — the UK
          statistics office discounts at 3.5% while assuming wages rise 2%, a net 1.5%. The
          World Bank discounts at 4% and assumes no rise at all. That single difference is
          most of why their two figures for the same country are so far apart.
        </p>
        <p className="rationale">
          The real calculation runs cohort by cohort through age, sex, education and
          survival odds. We model the same shape with a level stream over a{" "}
          {model.years}-year working life, pinned so it reproduces the published figure
          exactly at the published rate. It shows you the mechanism honestly; it is not a
          republication of the official model, and the figures it produces away from the
          baseline are illustrative.
        </p>
        <p className="rationale">
          <strong>Where our version disagrees with theirs, and in which direction.</strong>{" "}
          The UK statistics office's own guidance implies a swing of roughly 25–30% per
          percentage point; our simpler model gives{" "}
          {(perPp * 100).toFixed(0)}%. Real earnings rise through a career rather than
          staying level, which pushes more of the value further into the future and makes
          it more rate-sensitive than we show. So if anything,{" "}
          <strong>this dial understates how much that one choice matters</strong>. We'd
          rather tell you that than quietly tune the model until the numbers matched.
        </p>
      </details>
    </div>
  );
}
