// Metro config for a pnpm monorepo.
//
// Metro's default resolver only looks at node_modules next to this app. In a pnpm
// workspace the `@rr/*` packages live under `packages/*` and are symlinked into the
// root `node_modules`, so Metro needs to (1) watch the repo root for changes to
// those packages and (2) know to look in the root `node_modules` when resolving a
// bare import it can't find locally.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

// Expo's own env-file loading (@expo/env) only looks in this app's own
// directory, but the repo keeps one shared .env.local at the workspace root
// (same file apps/web's next.config.mjs loads for its own env vars) — so
// EXPO_PUBLIC_SUPABASE_URL/ANON_KEY never reached process.env and every
// @rr/api call failed with "Missing EXPO_PUBLIC_SUPABASE_URL...". Runs once,
// synchronously, before Metro starts serving any transform requests, so
// babel-preset-expo's process.env.EXPO_PUBLIC_* inlining sees these on every
// subsequent bundle. Existing environment variables always win.
try {
  const raw = fs.readFileSync(path.join(workspaceRoot, ".env.local"), "utf8");
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

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so edits to packages/* trigger a Fast Refresh.
config.watchFolders = [workspaceRoot];

// Resolve node_modules from this app first, then fall back to the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// The @rr/* packages are TypeScript source with no build step ("main" points at
// src/index.ts) and their internal imports use NodeNext-style ".js" specifiers
// that actually resolve to ".ts" files on disk (e.g. `import "./money.js"` where
// only money.ts exists). Metro's resolver does not do TS-style extension rewriting
// by default, so we add it ourselves: if a relative import ending in .js can't be
// found, retry the same path with a TypeScript extension before giving up.
const TS_EXTENSION_FALLBACKS = [".ts", ".tsx"];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isRelative = moduleName.startsWith("./") || moduleName.startsWith("../");
  if (isRelative && moduleName.endsWith(".js")) {
    for (const ext of TS_EXTENSION_FALLBACKS) {
      const candidate = moduleName.slice(0, -3) + ext;
      try {
        return context.resolveRequest(context, candidate, platform);
      } catch {
        // try the next extension
      }
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Disable the "unstable" package-exports field resolution edge cases some
// workspace packages hit under pnpm's symlinked layout.
config.resolver.unstable_enablePackageExports = true;
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
