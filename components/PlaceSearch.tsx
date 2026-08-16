"use client";

/**
 * The front door.
 *
 * A stranger arrives wanting to look something up, not to read about a product. One box
 * over every country and city we can value is the shortest path from "what is X worth"
 * to an answer.
 */

import { useState, useMemo } from "react";
import type { SearchEntry } from "../engine/findings.ts";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function PlaceSearch({
  entries, suggestions,
}: {
  entries: readonly SearchEntry[];
  suggestions: readonly { name: string; href: string }[];
}) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const needle = norm(q.trim());
    if (needle.length < 2) return [];
    const starts: SearchEntry[] = [];
    const contains: SearchEntry[] = [];
    for (const e of entries) {
      const n = norm(e.name);
      if (n.startsWith(needle)) starts.push(e);
      else if (n.includes(needle)) contains.push(e);
      if (starts.length >= 8) break;
    }
    return [...starts, ...contains].slice(0, 8);
  }, [q, entries]);

  return (
    <div className="search">
      <div className="search-box">
        <span className="search-icon" aria-hidden>⌕</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="a country or a city…"
          aria-label="Search for a country or city"
          autoComplete="off"
        />
      </div>

      {results.length > 0 && (
        <ul className="search-results">
          {results.map((r) => (
            <li key={r.href}>
              <a href={r.href}>
                <span className="search-name">{r.name}</span>
                <span className="search-detail">{r.detail}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {q.trim().length >= 2 && results.length === 0 && (
        <p className="search-empty">
          Nothing called “{q.trim()}” yet. We cover {entries.length} places — every country
          the World Bank publishes wealth for, and every European city Eurostat measures.{" "}
          <a href="/sources">See what that leaves out →</a>
        </p>
      )}

      {q.trim().length < 2 && (
        <p className="search-hint">
          Try{" "}
          {suggestions.map((s, i) => (
            <span key={s.href}>
              {i > 0 && " · "}
              <a href={s.href}>{s.name}</a>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
