/**
 * The front page.
 *
 * POSITIONING, which the earlier version got wrong. This is not a site about showing
 * working. It is a method and a platform for finding what a country, city, company or
 * startup is genuinely worth — and then understanding what moves that number.
 *
 * The audit trail is how we earn the right to be believed. It is the credibility
 * mechanism, not the product. It should be visible and never the headline.
 */

import PlaceSearch from "../components/PlaceSearch.tsx";
import { findings, searchIndex } from "../engine/findings.ts";
import { valuableCountries } from "../engine/countries.ts";
import { allMetros } from "../engine/metros.ts";
import { rankedCompanies } from "../engine/companies.ts";

export default function Home() {
  const entries = searchIndex();
  const items = findings();
  const countries = valuableCountries().length;
  const cities = allMetros().length;
  const companies = rankedCompanies().length;

  return (
    <main className="wrap">
      <section className="hero">
        <h1>
          What is it actually worth —<br />and what would move it?
        </h1>
        <p className="lede">
          A method for valuing countries, cities, companies and startups on the same
          principles, and for working out which decisions change the answer.
        </p>

        <PlaceSearch
          entries={entries}
          suggestions={[
            { name: "India", href: "/country/ind" },
            { name: "Singapore", href: "/country/sgp" },
            { name: "Paris", href: "/metro/fr001mc" },
            { name: "Intel", href: "/company/50863" },
          ]}
        />
      </section>

      <h2>What we can value</h2>
      <div className="grid-2">
        <a className="entity" href="/countries">
          <div className="entity-count">{countries}</div>
          <div className="entity-name">Countries</div>
          <p className="entity-note">
            What a nation owns, what its people will earn, and what its land holds —
            measured the same way everywhere, so they can honestly be compared.
          </p>
          <span className="entity-go">Explore countries →</span>
        </a>

        <a className="entity" href="/metros">
          <div className="entity-count">{cities}</div>
          <div className="entity-name">Cities</div>
          <p className="entity-note">
            What a city’s buildings, land and infrastructure are worth — the part that
            can’t get up and leave when people do.
          </p>
          <span className="entity-go">Explore cities →</span>
        </a>

        <a className="entity" href="/companies">
          <div className="entity-count">{companies}</div>
          <div className="entity-name">Companies</div>
          <p className="entity-note">
            Ranked on whether they earn more than their money costs — not on size. Built
            from filed accounts, so it is a measurement rather than an opinion.
          </p>
          <span className="entity-go">Explore companies →</span>
        </a>

        <a className="entity" href="/simulate">
          <div className="entity-count">You</div>
          <div className="entity-name">Your startup</div>
          <p className="entity-note">
            Eight numbers you already know, and you get a valuation range plus a ranked
            list of what to fix before an investor finds it. Nothing is stored.
          </p>
          <span className="entity-go">Value your startup →</span>
        </a>
      </div>

      <h2>What the numbers say</h2>
      <p className="small muted" style={{ maxWidth: "68ch", marginTop: -6, marginBottom: 16 }}>
        Not headlines — findings. Each one is computed from our own figures, so it can’t
        drift out of line with the page it points to.
      </p>

      <div className="findings">
        {items.map((f) => (
          <a className="finding" href={f.href} key={f.href + f.headline}>
            <div className="finding-headline">{f.headline}</div>
            <p className="finding-body">{f.body}</p>
            <span className="finding-action">{f.action} →</span>
          </a>
        ))}
      </div>

      <h2>Why you can believe any of it</h2>
      <div className="grid-2">
        <div className="stat">
          <div className="stat-label">Every figure is traceable</div>
          <p className="stat-note" style={{ marginTop: 8 }}>
            Each number shows every figure behind it, where it came from and when it was
            measured. Follow it down to the source and back.
          </p>
        </div>
        <div className="stat">
          <div className="stat-label">The judgements are marked</div>
          <p className="stat-note" style={{ marginTop: 8 }}>
            Where we chose a number rather than measured one, it says so — and you can
            move it and watch what happens.
          </p>
        </div>
        <div className="stat">
          <div className="stat-label">Anyone can check it</div>
          <p className="stat-note" style={{ marginTop: 8 }}>
            Every calculation carries a fingerprint. Recompute it; if it matches, nothing
            has drifted. One command does all of them.
          </p>
        </div>
        <div className="stat">
          <div className="stat-label">We say what we don’t know</div>
          <p className="stat-note" style={{ marginTop: 8 }}>
            Figures we haven’t confirmed are held back rather than published. The gaps are
            listed as plainly as the numbers.{" "}
            <a href="/sources">See every source →</a>
          </p>
        </div>
      </div>

      <footer className="foot">
        Built in the open. Figures come from national statistics offices and the World
        Bank — every one listed, with its licence and what it feeds, on the{" "}
        <a href="/sources">sources page</a>.
      </footer>
    </main>
  );
}
