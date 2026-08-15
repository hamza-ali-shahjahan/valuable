/**
 * The signature page: one number, its complete working, and the proof it holds.
 *
 * Reading order is deliberate. A person with no finance background should be able to
 * read this top to bottom and follow every step. The technical detail is all here, but
 * it sits underneath the plain words, never in front of them.
 */

import { notFound } from "next/navigation";
import TraceTree from "../../../components/TraceTree.tsx";
import { lookup, allHashes } from "../../../lib/registry.ts";
import {
  verify, formatValue, challengeUrl, leaves, sources, assumptions, allWarnings, depth,
} from "../../../engine/trace.ts";

export const dynamicParams = false;

export function generateStaticParams() {
  return allHashes().map((hash) => ({ hash }));
}

export default async function TracePage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params;
  const entry = lookup(hash);
  if (!entry) notFound();

  const { trace: t, value } = entry;
  const result = verify(t, value);
  const warnings = allWarnings(t);
  const assumptionList = assumptions(t);
  const srcs = sources(t);
  const measured = leaves(t).filter((n) => n.kind === "observed").length;

  return (
    <main className="wrap">
      <p className="small muted" style={{ marginBottom: 10 }}>
        {entry.country
          ? <><a href="/countries">All countries</a> {" / "}
              <a href={entry.country.href}>{entry.country.name}</a> / one calculation, in full</>
          : <>one calculation, in full</>}
      </p>

      <h1 style={{ fontSize: 26, fontFamily: "var(--sans)", fontWeight: 600, maxWidth: "24ch" }}>
        {t.question}
      </h1>

      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", margin: "20px 0 4px" }}>
        <span className="claim-value" style={{ marginBottom: 0 }}>
          {formatValue(value, t.unit)}
        </span>
        {result.ok
          ? <span className="badge badge-ok">✓ the maths checks out</span>
          : <span className="badge badge-danger">✗ this does not add up</span>}
        {!entry.publishable && <span className="badge badge-warn">held back</span>}
      </div>

      {t.meaning && (
        <p className="lede" style={{ marginTop: 14, marginBottom: 4 }}>{t.meaning}</p>
      )}

      {!entry.publishable && (
        <div className="notice" style={{ marginTop: 18 }}>
          <strong>We’re holding this figure back.</strong>{" "}
          The sums are right and the trail below checks out — but one of the numbers
          going in hasn’t been confirmed against an official source yet, and we’d rather
          show you nothing than show you something we haven’t checked.{" "}
          <a href="https://github.com/hamza-ali-shahjahan/valuable/issues/new?template=source.yml" target="_blank" rel="noreferrer">
            Know the right source? Tell us →
          </a>
        </div>
      )}

      {!result.ok && (
        <div className="notice" style={{ marginTop: 18 }}>
          <strong>Something is wrong here.</strong> {result.problems.join(" · ")}
        </div>
      )}

      <h2>How we got there</h2>
      <p className="small muted" style={{ maxWidth: "66ch", marginTop: -6, marginBottom: 14 }}>
        Every figure below is either something{" "}
        <span style={{ color: "var(--observed)" }}>● someone measured</span>, another{" "}
        <span style={{ color: "var(--derived)" }}>▸ calculation you can open up</span>, or a{" "}
        <span style={{ color: "var(--assumption)" }}>◆ judgement we made</span>. The
        judgements are the parts worth arguing with, so we mark them.
      </p>
      <TraceTree trace={t} />

      {warnings.length > 0 && (
        <>
          <h2>What to watch out for</h2>
          <p className="small muted" style={{ maxWidth: "66ch", marginTop: -6, marginBottom: 12 }}>
            Things that could reasonably make you distrust this number. We’d rather say
            them than have you find them.
          </p>
          {warnings.map((w, i) => (
            <div className="warning" key={i}>
              <span className="warning-mark" aria-hidden>!</span>
              <span>{w}</span>
            </div>
          ))}
        </>
      )}

      {assumptionList.length > 0 && (
        <>
          <h2>The judgement calls</h2>
          <p className="small" style={{ maxWidth: "66ch", marginTop: -6 }}>
            These aren’t figures anyone measured — they’re choices we made because the
            maths needs a number and reality doesn’t supply one. They’re the most likely
            place for this answer to be wrong.
          </p>
          <table className="plain">
            <thead>
              <tr><th>The choice</th><th>What we used</th><th></th></tr>
            </thead>
            <tbody>
              {assumptionList.map((a, i) => (
                <tr key={i}>
                  <td>
                    {a.label}
                    {a.plain && (
                      <div className="small" style={{ color: "var(--ink-2)", marginTop: 4, maxWidth: "52ch" }}>
                        {a.plain}
                      </div>
                    )}
                  </td>
                  <td className="num">{formatValue(a.value, a.unit)}</td>
                  <td>
                    <a
                      className="challenge"
                      href={challengeUrl(t, { kind: "input", label: a.label })}
                      target="_blank" rel="noreferrer"
                    >
                      challenge
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Check it yourself</h2>
      <p style={{ maxWidth: "66ch" }}>
        Below is this calculation’s fingerprint — a code generated from every number that
        went into it, the formula used, and the version of our software. Run the command
        underneath and you should get the identical code back. If you don’t, something
        changed and we’d want to know.
      </p>
      <div className="hash-block">{t.hash}</div>
      <div className="hash-block" style={{ marginTop: 10 }}>$ bun run verify</div>
      <p className="small muted" style={{ marginTop: 10 }}>
        Built from {measured} measured figure{measured === 1 ? "" : "s"} ·{" "}
        {srcs.length} source{srcs.length === 1 ? "" : "s"} ·{" "}
        {assumptionList.length} judgement{assumptionList.length === 1 ? "" : "s"} ·{" "}
        {depth(t)} layer{depth(t) === 1 ? "" : "s"} of working · software version{" "}
        <code>{t.engineVersion}</code>
      </p>

      <h2>Where the figures come from</h2>
      <ul style={{ paddingLeft: 18, color: "var(--ink-2)", maxWidth: "70ch" }}>
        {srcs.map((s) => <li key={s} style={{ marginBottom: 4 }}>{s}</li>)}
      </ul>

      <h2>Think we’ve got this wrong?</h2>
      <p style={{ maxWidth: "66ch" }}>
        Good — say which step. Pointing at one line of the working is far more useful to
        us than disagreeing with the headline. This link carries the fingerprint above, so
        the conversation starts on exactly the calculation you’re looking at.
      </p>
      <a className="challenge" href={challengeUrl(t)} target="_blank" rel="noreferrer">
        Challenge this calculation →
      </a>

      <footer className="foot">
        Every figure shows who measured it and when. Where our maths disagrees with a
        published number, we say so rather than quietly changing ours to match.
      </footer>
    </main>
  );
}
