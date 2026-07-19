/**
 * Design tokens, extracted verbatim from design/dashboard.dc.html and
 * design/mobile.dc.html.
 *
 * Extracted ONCE, here, so the web and mobile apps cannot drift apart on colour.
 * Do not re-derive values from the HTML in app code — import from this file.
 *
 * Everything is oklch, exactly as the design specifies. Tailwind v4 supports
 * oklch() natively, so these are a 1:1 port with no conversion or rounding.
 */

export const color = {
  /** Brand green. Primary actions, active nav, the mobile capture button. */
  brand: "oklch(56% 0.14 152)",
  brandHover: "oklch(51% 0.14 152)",
  brandSoft: "oklch(93% 0.05 152)",
  brandSoftText: "oklch(40% 0.13 152)",
  brandTint: "oklch(96% 0.01 152)",

  /** Page backgrounds. Web and mobile differ slightly — matched to each design. */
  bgWeb: "oklch(97.3% 0.006 250)",
  bgMobile: "oklch(95.5% 0.006 250)",
  surface: "#ffffff",
  surfaceMuted: "oklch(97.5% 0.006 250)",

  /** Dark stat card (mobile home, team page banner). */
  inkPanel: "oklch(22% 0.008 250)",
  inkPanelText: "oklch(75% 0.01 250)",

  border: "oklch(92% 0.005 250)",
  borderStrong: "oklch(88% 0.005 250)",
  borderSubtle: "oklch(95% 0.005 250)",

  text: "oklch(22% 0.01 250)",
  textStrong: "oklch(20% 0.01 250)",
  textMuted: "oklch(50% 0.01 250)",
  textFaint: "oklch(55% 0.01 250)",

  avatarBg: "oklch(94% 0.008 250)",
  avatarText: "oklch(35% 0.01 250)",

  /** Trend indicators. Up is bad for spend. */
  up: "oklch(55% 0.15 30)",
  down: "oklch(50% 0.13 152)",
} as const;

/** Reimbursement status chips. Keys match the reimbursement_status enum. */
export const reimbursementChip = {
  pending: { bg: "oklch(93% 0.06 65)", text: "oklch(48% 0.13 65)", label: "Pending" },
  approved: { bg: "oklch(93% 0.05 230)", text: "oklch(42% 0.13 230)", label: "Approved" },
  reimbursed: { bg: "oklch(93% 0.05 152)", text: "oklch(40% 0.13 152)", label: "Reimbursed" },
  rejected: { bg: "oklch(93% 0.06 20)", text: "oklch(45% 0.15 20)", label: "Rejected" },
} as const;

/** Extraction status chips. Keys match the receipt_status enum. */
export const receiptStatusChip = {
  processed: { bg: "oklch(93% 0.05 152)", text: "oklch(40% 0.13 152)", label: "Processed" },
  needs_review: { bg: "oklch(93% 0.06 65)", text: "oklch(48% 0.13 65)", label: "Needs review" },
  processing: { bg: "oklch(93% 0.006 250)", text: "oklch(46% 0.01 250)", label: "Processing" },
  uploading: { bg: "oklch(93% 0.006 250)", text: "oklch(46% 0.01 250)", label: "Uploading" },
  failed: { bg: "oklch(93% 0.06 20)", text: "oklch(45% 0.15 20)", label: "Failed" },
} as const;

/** Health ring. Thresholds match the design: >=80 on track, >=60 needs attention. */
export const healthChip = {
  onTrack: { bg: "oklch(93% 0.05 152)", text: "oklch(40% 0.13 152)" },
  needsAttention: { bg: "oklch(93% 0.06 65)", text: "oklch(48% 0.13 65)" },
  atRisk: { bg: "oklch(93% 0.05 30)", text: "oklch(45% 0.15 30)" },
} as const;

export const radius = {
  sm: 7,
  md: 10,
  lg: 12,
  xl: 14,
  "2xl": 16,
  "3xl": 18,
  pill: 20,
} as const;

export const fontSize = {
  micro: 10,
  tiny: 11,
  small: 12,
  body: 13,
  base: 14,
  lg: 15,
  xl: 17,
  h3: 19,
  h2: 21,
  h1: 22,
  stat: 26,
  statLg: 32,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  heavy: "800",
} as const;

/** Sidebar width on web; tab bar height on mobile. */
export const layout = {
  sidebarWidth: 236,
  tabBarHeight: 82,
  contentPaddingX: 36,
  contentPaddingY: 28,
  cardPadding: 22,
  drawerWidth: 480,
} as const;

export const font = {
  family: "'Inter', -apple-system, sans-serif",
  googleFontsUrl:
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
} as const;

/**
 * Web breakpoints.
 *
 * The design has NO media queries — it is desktop-only, and on a phone the
 * four-across stat grid is unusable. These are the agreed responsive rules, not
 * something lifted from the mockup. See BUILD_PLAN.md §0.3.
 */
export const breakpoint = {
  /** Below this: stat cards 2x2, charts stack full-width, tables become cards. */
  mobile: 640,
  /** Below this: sidebar collapses to a top bar. */
  tablet: 1024,
} as const;
