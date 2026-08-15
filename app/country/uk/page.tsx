/**
 * The UK page.
 *
 * The governing idea (docs/00-FIRST-PRINCIPLES.md §2.0): "How much is the UK worth" has
 * four different right answers spanning an order of magnitude. The hard part isn't the
 * maths, it's making a reader understand *why* there are four — hence the analogy up top.
 */

import { ukValuation } from "../../../lib/registry.ts";
import { formatValue, allWarnings, assumptions, challengeUrl } from "../../../engine/trace.ts";
import { UK_EVENTS, UK_LEADERS } from "../../../data/uk-events.ts";
import {
  effectSizeOrNull, STRATEGY_PLAIN, NO_COUNTERFACTUAL_PLAIN,
} from "../../../engine/events.ts";
import { findCountry, countryWealth, CWON_YEAR } from "../../../engine/countries.ts";

/** "2016-06-23" -> "23 June 2016". Nobody reads ISO dates for pleasure. */
const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const readableDate = (iso: string): string => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`;
};

export default function UkPage() {
  const v = ukValuation();
  const rg = v.rMinusG;
  const pbStep = rg.trace.steps.find((s) => s.label.includes("surplus"))!;
  const gbr = findCountry("GBR");
  const wbUk = gbr ? countryWealth(gbr) : null;

  return (
    <main className="wrap">
      <h1>What is the United Kingdom worth?</h1>
      <p className="lede">
        There are four honest answers, and the smallest is a fifth the size of the
        largest. They aren’t rival guesses — they answer different questions.
      </p>
      <p className="lede" style={{ fontSize: 15 }}>
        It’s the same as asking what a company is worth. Its buildings and machines? What
        its shares trade for? What its staff will produce over their careers? Every one of
        those is a real answer, and they’re all different numbers.
      </p>

      <div className="notice" style={{ background: "var(--bg)", borderColor: "var(--border-strong)", color: "var(--ink-2)" }}>
        On 12 August 2026, asked what it would cost to buy the country, journalists
        published <strong>£13.31 trillion</strong> within hours — straight from a free
        government bulletin. Getting the headline number is easy. What follows is where it
        comes from, what it leaves out, and which parts are judgement calls.
      </div>

      <h2>The four answers</h2>

      {v.claims.map((c) => {
        const t = c.traced.trace;
        const warns = allWarnings(t);
        const judgements = assumptions(t).length;
        return (
          <div className={`claim${c.publishable ? "" : " withheld"}`} key={t.hash}>
            <div className="claim-q">{c.question}</div>
            <span className="claim-value">{formatValue(c.traced.value, t.unit)}</span>
            {t.plain && (
              <p style={{ fontSize: 16, margin: "0 0 10px", maxWidth: "60ch" }}>{t.plain}</p>
            )}
            {t.meaning && (
              <p className="small" style={{ color: "var(--ink-2)", margin: "0 0 14px", maxWidth: "64ch" }}>
                {t.meaning}
              </p>
            )}
            <div className="claim-meta">
              <a href={`/trace/${t.hash}`}>See how we got there →</a>
              <span className="badge badge-ok">✓ the maths checks out</span>
              {judgements > 0 && (
                <span className="badge badge-assume">
                  {judgements} judgement call{judgements === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {warns.slice(0, 1).map((w, i) => (
              <div className="warning" style={{ marginTop: 14, marginBottom: 0 }} key={i}>
                <span className="warning-mark" aria-hidden>!</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        );
      })}

      <div className={`claim${v.perCapita.publishable ? "" : " withheld"}`}>
        <div className="claim-q">And per person?</div>
        <span className="claim-value">
          {v.perCapita.publishable
            ? formatValue(v.perCapita.traced.value, v.perCapita.traced.trace.unit)
            : "held back"}
        </span>
        <p style={{ fontSize: 16, margin: "0 0 10px", maxWidth: "60ch" }}>
          We’re not publishing this one yet.
        </p>
        <p className="small" style={{ color: "var(--ink-2)", margin: "0 0 14px", maxWidth: "64ch" }}>
          The sum itself is simple — the country’s total divided by how many people live
          here. But we haven’t confirmed our population figure against an official source,
          and we’d rather show nothing than something unchecked. You can still see the
          working.{" "}
          <a href="https://github.com/hamza-ali-shahjahan/valuable/issues/new?template=source.yml" target="_blank" rel="noreferrer">
            Know the right source? Tell us →
          </a>
        </p>
        <div className="claim-meta">
          <a href={`/trace/${v.perCapita.traced.trace.hash}`}>See how we got there →</a>
          <span className="badge badge-warn">we haven’t checked one figure</span>
        </div>
      </div>

      <h2>The same country, measured two ways</h2>
      <p style={{ maxWidth: "68ch", marginTop: -6 }}>
        The World Bank also values the UK — and gets a very different answer. Both are
        right. This is the clearest example on the site of why a single number for a
        country should always make you ask <em>measured how?</em>
      </p>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="stat">
          <div className="stat-label">UK statistics office, plus people</div>
          <div className="stat-value">{formatValue(v.claims[1]!.traced.value, "GBP")}</div>
          <p className="stat-note">
            Values future earnings at 3.5% a year, and assumes wages keep rising by 2%.
            Ages 16–65. Figures for 2022–2025.
          </p>
        </div>
        <div className="stat">
          <div className="stat-label">World Bank, same country</div>
          <div className="stat-value">
            {wbUk ? formatValue(wbUk.value, "USD") : "—"}
          </div>
          <p className="stat-note">
            Values future earnings at 4% a year with <em>no</em> allowance for wages
            rising. Ages 15–65. Figures for {CWON_YEAR}.{" "}
            {wbUk && <a href={`/trace/${wbUk.trace.hash}`}>working →</a>}
          </p>
        </div>
      </div>

      <div className="warning" style={{ marginTop: 14 }}>
        <span className="warning-mark" aria-hidden>!</span>
        <span>
          Never add these together, and never treat one as a correction of the other. They
          are two reasonable answers to the same question, and the gap between them is
          almost entirely one judgement call: how much a pound earned decades from now is
          worth today. Our software refuses to combine them.
        </span>
      </div>

      <h2>The number that decides Britain’s finances</h2>
      <div className="claim">
        <div className="claim-q">
          Does government debt grow faster than the economy that has to pay for it?
        </div>
        <span className="claim-value">{formatValue(rg.value, rg.trace.unit)}</span>
        <p style={{ fontSize: 16, margin: "0 0 10px", maxWidth: "62ch" }}>{rg.trace.plain}</p>
        <p className="small" style={{ color: "var(--ink-2)", margin: "0 0 14px", maxWidth: "66ch" }}>
          {rg.trace.meaning}
        </p>
        <div className="grid-2" style={{ marginBottom: 14 }}>
          <div className="stat">
            <div className="stat-label">Surplus needed to stand still</div>
            <div className="stat-value">{(pbStep.value * 100).toFixed(2)}%</div>
            <p className="stat-note">of everything the country earns, today</p>
          </div>
          <div className="stat">
            <div className="stat-label">If borrowing hit 5%</div>
            <div className="stat-value">1.83%</div>
            <p className="stat-note">
              about £50 billion a year more — from a rate move that happens routinely
            </p>
          </div>
        </div>
        <div className="claim-meta">
          <a href={`/trace/${rg.trace.hash}`}>See how we got there →</a>
        </div>
      </div>

      <h2>What moved the number, and who moved it</h2>
      <p style={{ maxWidth: "68ch", marginTop: -6 }}>
        Big political decisions hit a country’s value through the cost of borrowing, not
        through what it produces — which is why markets reprice in hours while the
        economic data takes years to catch up.
      </p>
      <p className="small" style={{ maxWidth: "68ch", color: "var(--ink-2)" }}>
        For each one we say how confident anyone can honestly be. Some effects were
        measured against a proper comparison. Others simply can’t be — and where that’s
        true we give no number at all, rather than guessing and calling it a finding.
      </p>

      <div style={{ marginTop: 24 }}>
        {[...UK_EVENTS].reverse().map((e) => (
          <div className="event" key={e.id}>
            <div className="event-date">
              {readableDate(e.date)}
              {e.leader && <> · {e.leader} ({e.party})</>}
            </div>
            <div className="event-title">{e.title}</div>
            <p className="event-body">{e.description}</p>
            <div className="event-claims">
              {e.claims.map((c, i) => {
                const effect = effectSizeOrNull(c);
                const plain = c.kind === "measured"
                  ? STRATEGY_PLAIN[c.strategy]
                  : NO_COUNTERFACTUAL_PLAIN;
                return (
                  <details className="detail event-detail" key={i}>
                    <summary>
                      {effect !== null ? (
                        <>
                          <span className={`effect ${effect < 0 ? "effect-neg" : "effect-pos"}`}>
                            {effect > 0 ? "+" : ""}{(effect * 100).toFixed(1)}%
                          </span>
                          <span>{c.kind === "measured" ? c.metric : ""}</span>
                          <span className="badge badge-ok">{plain.short}</span>
                        </>
                      ) : (
                        <>
                          <span className="badge badge-plain">{plain.short}</span>
                          <span className="muted">
                            {c.kind === "narrative" ? c.mechanism.split(".")[0] + "." : ""}
                          </span>
                        </>
                      )}
                    </summary>
                    <div className="event-expand">
                      <p style={{ margin: "8px 0", maxWidth: "66ch" }}>{plain.how}</p>
                      {c.kind === "narrative" && (
                        <>
                          <p className="small" style={{ color: "var(--ink-2)", maxWidth: "66ch" }}>
                            {c.mechanism}
                          </p>
                          <p className="small" style={{ color: "var(--ink-3)", maxWidth: "66ch" }}>
                            <strong>Why we can’t put a number on it:</strong> {c.whyNotIdentified}
                          </p>
                        </>
                      )}
                      {c.kind === "measured" && c.inference && (
                        <p className="small" style={{ color: "var(--ink-2)", maxWidth: "66ch" }}>
                          {c.inference}
                        </p>
                      )}
                      <p className="small muted" style={{ marginTop: 6 }}>
                        Source: {c.citation}
                        {c.url && <> · <a href={c.url} target="_blank" rel="noreferrer">read it</a></>}
                      </p>
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <h2>Who was in charge</h2>
      <table className="plain">
        <thead>
          <tr><th>Prime Minister</th><th>Party</th><th>From</th><th>Until</th></tr>
        </thead>
        <tbody>
          {[...UK_LEADERS].reverse().map((l) => (
            <tr key={l.name}>
              <td>
                {l.name}
                {l.note && (
                  <div className="small muted" style={{ marginTop: 2 }}>{l.note}</div>
                )}
              </td>
              <td>{l.party}</td>
              <td className="small">{readableDate(l.from)}</td>
              <td className="small">{l.to ? readableDate(l.to) : "still in office"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Think any of this is wrong?</h2>
      <p style={{ maxWidth: "68ch" }}>
        Every number here links to its full working, and every line of that working can be
        challenged on its own. That’s more useful to us than agreement.
      </p>
      <a className="challenge" href={challengeUrl(v.claims[0]!.traced.trace)} target="_blank" rel="noreferrer">
        Challenge a calculation →
      </a>

      <footer className="foot">
        Figures from the Office for National Statistics (national balance sheet 2026, human
        capital 2004–2022), the Office for Budget Responsibility (March 2026) and the FTSE
        All-Share. Each number shows its own date on its working page.
      </footer>
    </main>
  );
}
