import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { Footer } from "./LandingPage";

/**
 * Deliberately NOT LandingNav -- that one's "Start free trial" CTA and
 * #section anchors (meaningless off the landing page) don't belong on a
 * plain policy page, especially one linked directly from inside the mobile
 * app's Settings sheet and handed to App Store Connect/Google Play as the
 * required policy URL: an app-store reviewer landing on a signup pitch from
 * a "Privacy" link reads as exactly the kind of purchase-flow prompt that
 * can flag review, even though it's unrelated to in-app purchases.
 */
function LegalNav() {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 20, background: color.surface, borderBottom: `1px solid ${color.border}` }}>
      <div className="flex items-center justify-between" style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 24px", gap: 12 }}>
        <Link href="/" className="flex items-center" style={{ gap: 10, textDecoration: "none" }}>
          <Image src="/logo.png" alt="ReceiptRaccoon" width={40} height={40} style={{ borderRadius: radius.sm }} />
          <span style={{ fontSize: fontSize.xl + 1, fontWeight: fontWeight.bold, color: color.textStrong }}>
            receipt<span style={{ color: color.brand }}>raccoon</span>
          </span>
        </Link>
        <Link href="/login" style={{ fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: color.text, textDecoration: "none" }}>
          Log in
        </Link>
      </div>
    </header>
  );
}

/**
 * Shared shell for the standalone legal/support pages (Privacy, Terms,
 * Support) -- same footer as the marketing landing page, its own plain nav
 * above, and a prose column instead of marketing sections. These are the
 * pages the landing page's own footer links to, and the URLs handed to App
 * Store Connect / Google Play Console and linked from mobile's Settings sheet.
 */
export function LegalPageLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div style={{ color: color.text }}>
      <LegalNav />
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
