import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Valuable — what it's worth, and what moves it",
  description:
    "Find what a country, city, company or startup is actually worth — and what would " +
    "move it. Every figure traceable to the office that measured it.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <header className="masthead">
          <div className="masthead-inner">
            <a className="wordmark" href="/">Valuable</a>
            <span className="small muted">what it’s worth, and what moves it</span>
            <nav>
              <a href="/countries">Countries</a>
              <a href="/metros">Cities</a>
              <a href="/simulate">Your startup</a>
              <a href="/sources">Sources</a>
              <a href="/method">Method</a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
