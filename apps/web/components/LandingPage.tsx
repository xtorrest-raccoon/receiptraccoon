import type { ComponentType, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import {
  ArrowRightIcon,
  BarChartIcon,
  BellIcon,
  CameraIcon,
  CheckCircleIcon,
  DownloadIcon,
  GlobeIcon,
  PinIcon,
  ShieldIcon,
  TeamIcon,
  WarningIcon,
} from "./icons";

// Kept in sync by hand with the real values in the billing routes (see
// apps/web/app/api/billing/create-checkout-session/route.ts's TRIAL_DAYS and
// sync-seats/route.ts's TRIAL_SEAT_CAP) -- this page has no access to
// server-only route code, so there's nothing to import from directly.
const TRIAL_DAYS = 30;
const TRIAL_SEAT_CAP = 5;
const SEAT_PRICE = "€5";

type IconComponent = ComponentType<{ color: string; size?: number }>;

function PrimaryButton({ href, big, children }: { href: string; big?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: color.brand,
        color: "#fff",
        textDecoration: "none",
        fontWeight: fontWeight.bold,
        fontSize: big ? fontSize.xl : fontSize.base,
        padding: big ? "14px 26px" : "9px 18px",
        borderRadius: radius.md,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Link>
  );
}

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: fontSize.small,
          fontWeight: fontWeight.bold,
          color: color.brand,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 10,
        }}
      >
        {eyebrow}
      </div>
      <div style={{ fontSize: fontSize.h1 + 12, fontWeight: fontWeight.heavy, color: color.textStrong, letterSpacing: "-0.01em" }}>
        {title}
      </div>
      {sub ? (
        <p style={{ fontSize: fontSize.xl, color: color.textMuted, marginTop: 12, maxWidth: 600, marginLeft: "auto", marginRight: "auto", lineHeight: 1.6 }}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
];

function LandingNav() {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 20, background: color.surface, borderBottom: `1px solid ${color.border}` }}>
      <div className="flex items-center justify-between" style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 24px", gap: 12 }}>
        <Link href="/" className="flex items-center" style={{ gap: 10, textDecoration: "none" }}>
          <Image src="/logo.png" alt="ReceiptRaccoon" width={44} height={44} style={{ borderRadius: radius.sm }} />
          <span style={{ fontSize: fontSize.xl + 3, fontWeight: fontWeight.bold, color: color.textStrong }}>
            receipt<span style={{ color: color.brand }}>raccoon</span>
          </span>
        </Link>
        <nav className="hidden sm:flex" style={{ gap: 28 }}>
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} style={{ fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: color.textMuted, textDecoration: "none" }}>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center" style={{ gap: 16 }}>
          <Link
            href="/login"
            className="hidden sm:inline"
            style={{ fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: color.text, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Log in
          </Link>
          <PrimaryButton href="/login">Start free trial</PrimaryButton>
        </div>
      </div>
    </header>
  );
}

function HeroVisual() {
  return (
    // No overflow:hidden here -- the two chips below deliberately float half
    // off the photo's corners, so clipping has to happen one level in (on
    // the photo's own frame only), not on this outer positioning context.
    // Top/bottom margin only (no left/right) -- the photo fills the column's
    // full width; the vertical margin is just clearance for the chips.
    <div style={{ position: "relative", margin: "24px 0 28px" }}>
      <div
        style={{
          position: "relative",
          borderRadius: radius["3xl"],
          aspectRatio: "3 / 2",
          overflow: "hidden",
          border: `1px solid ${color.border}`,
        }}
      >
        {/* Licensed stock photo, supplied directly by the workspace owner --
            already has its own "Receipt scanned" card baked into the bottom. */}
        <Image src="/hero-photo.png" alt="Reviewing a scanned receipt" fill priority sizes="(max-width: 1024px) 100vw, 50vw" style={{ objectFit: "cover" }} />
      </div>

      <div
        style={{
          position: "absolute",
          top: -20,
          right: -16,
          background: color.surface,
          borderRadius: radius.lg,
          padding: "12px 16px",
          boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ fontSize: fontSize.tiny, color: color.textFaint, fontWeight: fontWeight.semibold }}>This month</div>
        <div style={{ fontSize: fontSize.h3, fontWeight: fontWeight.heavy, color: color.textStrong }}>€2,481</div>
        <div style={{ fontSize: fontSize.tiny, color: color.textMuted }}>12 receipts logged</div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: -20,
          left: -16,
          background: color.surface,
          borderRadius: radius.lg,
          padding: "12px 16px",
          boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ fontSize: fontSize.tiny, color: color.textFaint, fontWeight: fontWeight.semibold }}>Awaiting approval</div>
        <div style={{ fontSize: fontSize.h3, fontWeight: fontWeight.heavy, color: color.textStrong }}>3</div>
        <div style={{ fontSize: fontSize.tiny, color: color.up }}>Oldest: 2 days</div>
      </div>
    </div>
  );
}

const BUILT_FOR = ["Finance teams", "Operations", "Field crews", "Consultants", "Sales teams"];

function BuiltForRow() {
  return (
    <div
      style={{
        maxWidth: 1200,
        margin: "56px auto 0",
        borderTop: `1px solid ${color.border}`,
        paddingTop: 24,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 24,
      }}
    >
      <span style={{ fontSize: fontSize.body, fontWeight: fontWeight.bold, color: color.textFaint }}>Built for</span>
      {BUILT_FOR.map((b) => (
        <span key={b} style={{ fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: color.textMuted }}>
          {b}
        </span>
      ))}
    </div>
  );
}

function Hero() {
  return (
    <section style={{ background: color.bgWeb, padding: "64px 24px 0" }}>
      <div className="flex flex-col lg:flex-row items-center" style={{ maxWidth: 1200, margin: "0 auto", gap: 48 }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: color.brandSoft,
              color: color.brandSoftText,
              fontSize: fontSize.body,
              fontWeight: fontWeight.bold,
              padding: "6px 14px",
              borderRadius: radius.pill,
              marginBottom: 20,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 3, background: color.brand }} />
            Expense tracking, reimagined
          </div>
          <h1 style={{ fontSize: 48, fontWeight: fontWeight.heavy, lineHeight: 1.15, letterSpacing: "-0.02em", color: color.textStrong, marginBottom: 18 }}>
            Expense tracking that doesn&rsquo;t feel like <span style={{ color: color.brand }}>homework</span>
          </h1>
          <p style={{ fontSize: fontSize.xl + 2, color: color.textMuted, lineHeight: 1.6, marginBottom: 26, maxWidth: 480 }}>
            Snap a photo, we read the receipt. Log a trip, we calculate the mileage. Your team approves in a click — no
            spreadsheets, no shoebox of paper.
          </p>
          <PrimaryButton href="/login" big>
            Start your free {TRIAL_DAYS}-day trial <ArrowRightIcon color="#fff" />
          </PrimaryButton>
          <div className="flex items-center" style={{ gap: 8, marginTop: 18 }}>
            <CheckCircleIcon color={color.brand} size={16} />
            <span style={{ fontSize: fontSize.body, color: color.textMuted }}>No charge until your trial ends — cancel anytime</span>
          </div>
        </div>
        <div style={{ flex: 1, width: "100%" }}>
          <HeroVisual />
        </div>
      </div>
      <BuiltForRow />
      <div style={{ height: 64 }} />
    </section>
  );
}

interface Step {
  n: string;
  icon: IconComponent;
  title: string;
  body: string;
  /** Real photo for this step's visual, if supplied -- falls back to the icon illustration otherwise. */
  photo?: string;
}

const STEPS: Step[] = [
  {
    n: "01",
    icon: CameraIcon,
    title: "Capture",
    body: "Take a photo on your phone or drag a file into the browser. ReceiptRaccoon reads the vendor, date, total, tax, and category automatically — you just check it over.",
    photo: "/Capture-photo.png",
  },
  {
    n: "02",
    icon: PinIcon,
    title: "Log mileage",
    body: "Type a distance or drop in a start and end address and let us calculate it. Every trip's rate is locked in the moment it's logged, so nothing recalculates behind your back later.",
    photo: "/mileage-photo.png",
  },
  {
    n: "03",
    icon: CheckCircleIcon,
    title: "Approve & reimburse",
    body: "Whoever you've given approval authority to sees a queue of what's pending, approves or rejects it, and the amount owed updates automatically — for receipts and mileage alike.",
    photo: "/approved-photo.png",
  },
];

function StepVisual({ n, icon: Icon, photo }: { n: string; icon: IconComponent; photo?: string | undefined }) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: radius["2xl"],
        aspectRatio: "16 / 10",
        // Kept even when a photo is set -- a neutral backdrop while the
        // (lazy-loaded, below-the-fold) image is still fetching, instead of
        // whatever happens to sit behind the section.
        background: color.surfaceMuted,
        border: `1px solid ${color.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {photo ? (
        <Image src={photo} alt="" fill sizes="(max-width: 1024px) 100vw, 50vw" style={{ objectFit: "cover" }} />
      ) : (
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: radius["2xl"],
            background: color.brandTint,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon color={color.brand} size={40} />
        </div>
      )}
      <span
        style={{
          position: "absolute",
          top: 14,
          left: 18,
          fontSize: 46,
          fontWeight: fontWeight.heavy,
          color: photo ? "rgba(255,255,255,0.85)" : color.border,
          textShadow: photo ? "0 2px 10px rgba(0,0,0,0.35)" : undefined,
        }}
      >
        {n}
      </span>
    </div>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" style={{ background: color.surface, padding: "80px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <SectionHeading eyebrow="How it works" title="Three steps, then you're done" />
        <div style={{ display: "flex", flexDirection: "column", gap: 64, marginTop: 56 }}>
          {STEPS.map((step, i) => (
            <div
              key={step.n}
              className={`flex flex-col items-center ${i % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"}`}
              style={{ gap: 40 }}
            >
              <div style={{ flex: 1 }}>
                <div className="flex items-center" style={{ gap: 8, marginBottom: 14 }}>
                  <step.icon color={color.brand} size={18} />
                  <span style={{ fontSize: fontSize.small, fontWeight: fontWeight.bold, color: color.textFaint, letterSpacing: "0.06em" }}>
                    STEP {step.n}
                  </span>
                </div>
                <div style={{ fontSize: fontSize.h2 + 4, fontWeight: fontWeight.heavy, color: color.textStrong, marginBottom: 10 }}>{step.title}</div>
                <p style={{ fontSize: fontSize.xl, color: color.textMuted, lineHeight: 1.6, maxWidth: 460 }}>{step.body}</p>
              </div>
              <div style={{ flex: 1, width: "100%" }}>
                <StepVisual n={step.n} icon={step.icon} photo={step.photo} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface Feature {
  icon: IconComponent;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: CameraIcon,
    title: "One photo, zero typing",
    body: "Extraction pulls out vendor, date, total, tax, payment method, and line items straight from the image — on the phone or the web app.",
  },
  {
    icon: WarningIcon,
    title: "Catches duplicates before you do",
    body: "If a receipt looks like one you've already logged — same vendor, date, and amount — we ask before saving, not after.",
  },
  {
    icon: PinIcon,
    title: "Mileage without the math",
    body: "Manual distance or automatic calculation from two addresses. Each trip's reimbursement rate is frozen at the moment it's logged.",
  },
  {
    icon: GlobeIcon,
    title: "Handles other currencies",
    body: "A receipt in a different currency gets converted to your workspace's home currency automatically, using the day's exchange rate.",
  },
  {
    icon: ShieldIcon,
    title: "Approval, your way",
    body: "Set who can approve, reject, or refund whose expenses. Owners and admins always have full authority; anyone else only sees and acts on what they've been assigned.",
  },
  {
    icon: BellIcon,
    title: "Nothing falls through the cracks",
    body: "An optional daily email reminds approvers exactly what's sitting in their queue — skipped entirely on days there's nothing to review.",
  },
  {
    icon: BarChartIcon,
    title: "See the whole business, or just your own",
    body: "Admins get a workspace-wide view: total spend, outstanding refunds, what's aged over 30 days, mileage cost, who's spent the most. Everyone else just sees their own numbers.",
  },
  {
    icon: DownloadIcon,
    title: "Export whenever you need it",
    body: "Pull receipts to CSV for your accountant in one click.",
  },
];

function Features() {
  return (
    <section id="features" style={{ background: color.bgWeb, padding: "80px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <SectionHeading
          eyebrow="Features"
          title="Everything your team actually needs"
          sub="No bloat, no complexity — just the tools that make expense tracking fast and painless."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5" style={{ marginTop: 48 }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 22 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.lg,
                  background: color.brandTint,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <f.icon color={color.brand} size={20} />
              </div>
              <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: color.textStrong, marginBottom: 8 }}>{f.title}</div>
              <p style={{ fontSize: fontSize.base, color: color.textMuted, lineHeight: 1.55 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PRICING_FEATURES = [
  "Unlimited receipts & mileage",
  "OCR receipt extraction",
  "Multi-currency support",
  "Approval workflows",
  "CSV export",
  "Daily digest emails",
  "Workspace analytics",
  "Duplicate detection",
];

function Pricing() {
  return (
    <section id="pricing" style={{ background: color.surface, padding: "80px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <SectionHeading
          eyebrow="Pricing"
          title="Simple, per-seat pricing"
          sub="One plan. Pay for the people you have — the seat count adjusts automatically as your team grows or shrinks. No tiers to compare, no features locked behind a higher plan."
        />
        <div style={{ marginTop: 48, background: color.inkPanel, borderRadius: radius["3xl"], padding: 32 }}>
          <div className="flex flex-col sm:flex-row" style={{ justifyContent: "space-between", gap: 20, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: fontSize.small, fontWeight: fontWeight.bold, color: color.brand, letterSpacing: "0.06em", marginBottom: 8 }}>
                FULL ACCESS
              </div>
              <div style={{ fontSize: fontSize.h1 + 8, fontWeight: fontWeight.heavy, color: "#fff", marginBottom: 4 }}>Everything included</div>
              <div style={{ fontSize: fontSize.base, color: color.inkPanelText }}>One plan, every feature, every team.</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: fontSize.h1 + 14, fontWeight: fontWeight.heavy, color: "#fff" }}>
                {SEAT_PRICE}
                <span style={{ fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: color.inkPanelText }}>/seat/month</span>
              </div>
              <div style={{ fontSize: fontSize.small, color: color.inkPanelText, marginTop: 4 }}>Billed monthly · scales with your team</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" style={{ marginBottom: 24 }}>
            {PRICING_FEATURES.map((f) => (
              <div key={f} className="flex items-center" style={{ gap: 10 }}>
                <CheckCircleIcon color={color.brand} size={18} />
                <span style={{ fontSize: fontSize.base, color: color.inkPanelText }}>{f}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: radius.lg,
              padding: 16,
              marginBottom: 20,
              display: "flex",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: radius.md,
                background: "rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <TeamIcon color={color.brand} />
            </div>
            <div>
              <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: "#fff", marginBottom: 2 }}>
                Try it free for {TRIAL_DAYS} days
              </div>
              <div style={{ fontSize: fontSize.body, color: color.inkPanelText, lineHeight: 1.5 }}>
                Every workspace gets a full {TRIAL_DAYS}-day trial, up to {TRIAL_SEAT_CAP} seats. We ask for a card upfront but
                don&rsquo;t charge you until the trial ends — cancel anytime before that and you pay nothing.
              </div>
            </div>
          </div>

          <Link
            href="/login"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: color.brand,
              color: "#fff",
              textDecoration: "none",
              fontWeight: fontWeight.bold,
              fontSize: fontSize.xl,
              padding: "14px 0",
              borderRadius: radius.md,
            }}
          >
            Start your free trial
          </Link>
          <div style={{ textAlign: "center", fontSize: fontSize.small, color: color.inkPanelText, marginTop: 12 }}>
            No charge until your {TRIAL_DAYS}-day trial ends · Cancel anytime
          </div>
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section style={{ position: "relative", background: color.inkPanel, padding: "90px 24px 70px", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at 85% 100%, color-mix(in oklch, ${color.brand} 35%, transparent), transparent 60%)`,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: radius["2xl"],
            background: color.surface,
            margin: "0 auto 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <Image src="/logo.png" alt="ReceiptRaccoon" width={88} height={88} />
        </div>
        <div style={{ fontSize: fontSize.h1 + 16, fontWeight: fontWeight.heavy, color: "#fff", letterSpacing: "-0.01em", marginBottom: 12 }}>
          Stop chasing receipts.
        </div>
        <div style={{ fontSize: fontSize.xl, color: color.inkPanelText, marginBottom: 32 }}>Get your team set up in a few minutes.</div>
        <Link
          href="/login"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: color.brand,
            color: "#fff",
            textDecoration: "none",
            fontWeight: fontWeight.bold,
            fontSize: fontSize.xl,
            padding: "14px 30px",
            borderRadius: radius.md,
          }}
        >
          Start free trial <ArrowRightIcon color="#fff" />
        </Link>
        <div style={{ fontSize: fontSize.body, color: color.inkPanelText, marginTop: 16 }}>
          {TRIAL_DAYS} days free · No charge until it ends · Cancel anytime
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ background: color.inkPanel, borderTop: "1px solid rgba(255,255,255,0.08)", padding: "24px" }}>
      <div className="flex flex-col sm:flex-row" style={{ maxWidth: 1200, margin: "0 auto", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div className="flex items-center" style={{ gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.sm,
              background: color.surface,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <Image src="/logo.png" alt="" width={32} height={32} />
          </div>
          <span style={{ fontSize: fontSize.body, color: color.inkPanelText }}>
            © {new Date().getFullYear()} ReceiptRaccoon. All rights reserved.
          </span>
        </div>
        {/* Plain text, not links -- Privacy/Terms/Support pages don't exist yet. */}
        <div className="flex items-center" style={{ gap: 24 }}>
          <span style={{ fontSize: fontSize.body, color: color.inkPanelText }}>Privacy</span>
          <span style={{ fontSize: fontSize.body, color: color.inkPanelText }}>Terms</span>
          <span style={{ fontSize: fontSize.body, color: color.inkPanelText }}>Support</span>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div style={{ color: color.text }}>
      <LandingNav />
      <Hero />
      <HowItWorks />
      <Features />
      <Pricing />
      <ClosingCta />
      <Footer />
    </div>
  );
}
