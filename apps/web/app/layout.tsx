import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { color } from "@rr/ui-tokens";
import { AppShell } from "../components/AppShell";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ReceiptRaccoon",
  description: "Team expense management",
};

// Derived from @rr/ui-tokens rather than written as a literal in the .css file,
// so the scrollbar still traces back to the single source of truth for colour.
const scrollbarCss = `
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: ${color.borderStrong}; border-radius: 4px; }
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: scrollbarCss }} />
      </head>
      <body style={{ fontFamily: "var(--font-inter), -apple-system, sans-serif", fontSize: 14 }}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
