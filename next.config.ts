import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The engine imports with explicit .ts extensions so the same files run under both
  // `bun test` and the Next bundler without a duplicate module graph.
  typedRoutes: false,
};

export default config;
