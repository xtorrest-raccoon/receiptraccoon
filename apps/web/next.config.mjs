import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Next.js only auto-loads .env.local from this app's own directory, but the repo
// keeps one shared .env.local at the workspace root (see packages/extraction's
// env.ts, which does the same thing for scripts) — so OPENAI_API_KEY reaches the
// /api/extract route without duplicating the file into apps/web. Runs once when
// the Next process starts, so process.env is already populated by request time.
// Existing environment variables always win, so a real deployment is unaffected.
try {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(path.join(here, "..", "..", ".env.local"), "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // no root .env.local; rely on the real environment
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@rr/shared", "@rr/ui-tokens", "@rr/mock-api", "@rr/extraction"],
  webpack: (config) => {
    // packages/shared uses NodeNext-style relative imports ("./types.js")
    // that point at .ts source files (there is no compiled dist yet). Node's
    // own resolver understands that mapping; webpack needs to be told.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".js", ".ts", ".tsx"],
    };
    return config;
  },
};

export default nextConfig;
