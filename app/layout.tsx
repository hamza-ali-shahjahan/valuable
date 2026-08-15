import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Valuable — verifiable valuations",
  description:
    "What a country, a city, a company or your startup is worth — with the complete " +
    "working, so anyone can recompute it and prove we didn't cheat.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <header className="masthead">
          <div className="masthead-inner">
            <a className="wordmark" href="/">Valuable</a>
            <span className="small muted mono">show your working</span>
            <nav>
              <a href="/countries">All countries</a>
              <a href="/country/uk">United Kingdom</a>
              <a href="/method">Method</a>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
