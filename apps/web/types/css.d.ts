// Plain `tsc --noEmit` (used for CI-style typechecking) doesn't load the "next"
// language-service plugin the way `next build`'s internal checker does, so it
// has no idea what to do with a side-effect CSS import. This ambient module
// declaration is enough for `import "./globals.css"` to typecheck either way.
declare module "*.css";
