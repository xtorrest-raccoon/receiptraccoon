"use client";

import Link from "next/link";
import { isAdmin } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useConsolidatedSeatCount, useCurrentUser } from "../../lib/queries";
import { PaymentSetupPanel } from "../../components/PaymentSetupPanel";
import { InvoiceList } from "../../components/InvoiceList";
import { BillingAddressForm } from "../../components/BillingAddressForm";

function SectionHeading({ children }: { children: string }) {
  return (
    <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.bold, color: color.textFaint, textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 28, marginBottom: 10 }}>
      {children}
    </div>
  );
}

/**
 * Split out of Setup -- billing is owner/admin-only, same as it was there
 * (Setup itself is visible to a wider audience: any super user with full
 * reimbursement authority, not just owner/admin), so this page has its own,
 * stricter gate rather than inheriting Setup's.
 */
export default function BillingPage() {
  const { data: currentUser } = useCurrentUser();
  const { data: seatCount } = useConsolidatedSeatCount();

  if (!currentUser) return null;

  if (!isAdmin(currentUser.role)) {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
        <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, marginBottom: 8 }}>403 — Not authorized</div>
        <div style={{ fontSize: fontSize.body, color: color.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
          Payment is only visible to workspace owners/admins.
          {` Signed in as ${currentUser.name} (${currentUser.role}).`}
        </div>
        <Link href="/dashboard" style={{ color: color.brand, fontWeight: fontWeight.bold, fontSize: fontSize.body }}>
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, letterSpacing: "-0.01em", marginBottom: 4 }}>Payment</div>
      <div style={{ fontSize: fontSize.body, color: color.textMuted, marginBottom: 20 }}>
        Your subscription, payment method, and billing history.
      </div>

      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 20, minWidth: 180, maxWidth: 240, marginBottom: 8 }}>
        <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.semibold, color: color.textFaint, marginBottom: 6 }}>
          Active seats
        </div>
        <div style={{ fontSize: fontSize.stat - 4, fontWeight: fontWeight.heavy }}>{seatCount ?? "…"}</div>
        <div style={{ fontSize: fontSize.micro + 0.5, color: color.textFaint, marginTop: 6, lineHeight: 1.4 }}>
          Distinct people across every workspace in your organization.
        </div>
      </div>

      <SectionHeading>Payment setup</SectionHeading>
      <PaymentSetupPanel currentUser={currentUser} />

      <SectionHeading>Billing address</SectionHeading>
      <BillingAddressForm />

      <SectionHeading>Invoices</SectionHeading>
      <InvoiceList />
    </div>
  );
}
