import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Load .env.local from the repo root into process.env.
 *
 * Node can do this with --env-file, but that requires every caller to remember the
 * flag. Scripts in this package call loadEnv() instead so `pnpm try` and `pnpm eval`
 * just work.
 *
 * Existing environment variables always win, so CI and deployed environments are
 * unaffected.
 */
export function loadEnv(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, "..", "..", "..");
  const path = join(root, ".env.local");

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return; // no local env file; rely on the real environment
  }

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
}
