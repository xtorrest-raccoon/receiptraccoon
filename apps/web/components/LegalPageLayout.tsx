import type { ReactNode } from "react";
import { color, fontSize, fontWeight } from "@rr/ui-tokens";
import { LandingNav, Footer } from "./LandingPage";

/**
 * Shared shell for the standalone legal/support pages (Privacy, Terms,
 * Support) -- same nav/footer as the marketing landing page, but a plain
 * prose column instead of marketing sections. These are the pages the
 * landing page's own footer links to, and the URLs handed to App Store
 * Connect / Google Play Console and linked from mobile's Settings sheet.
 */
export function LegalPageLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div style={{ color: color.text }}>
      <LandingNav />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 80px" }}>
        <h1 style={{ fontSize: fontSize.h1 + 8, fontWeight: fontWeight.heavy, letterSpacing: "-0.01em", marginBottom: 6 }}>{title}</h1>
        <div style={{ fontSize: fontSize.small, color: color.textFaint, marginBottom: 36 }}>Last updated {updated}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28, fontSize: fontSize.body, lineHeight: 1.7, color: color.textMuted }}>
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: color.textStrong, marginBottom: 10 }}>{heading}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </section>
  );
}
