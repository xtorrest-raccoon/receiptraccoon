"use client";

import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import { useInvoices } from "../lib/queries";

/** Stripe is the only source of truth for invoices — no local copy, no PDF generation. */
function formatAmount(minor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
}

const STATUS_LABEL: Record<string, string> = {
  paid: "Paid",
  open: "Open",
  uncollectible: "Failed",
  void: "Void",
  draft: "Draft",
};

export function InvoiceList() {
  const { data: invoices, isLoading } = useInvoices();

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 20, marginTop: 16 }}>
      <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: 4 }}>Invoices</div>
      <div style={{ fontSize: fontSize.small, color: color.textMuted, marginBottom: 14 }}>
        Generated automatically by Stripe once a month — view or download each one as a PDF.
      </div>

      {isLoading ? null : !invoices || invoices.length === 0 ? (
        <div style={{ fontSize: fontSize.small, color: color.textFaint }}>No invoices yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {invoices.map((inv) => (
            <div
              key={inv.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                padding: "10px 12px",
                borderRadius: radius.md,
                border: `1px solid ${color.border}`,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontSize: fontSize.small + 0.5, fontWeight: fontWeight.semibold }}>
                  {new Date(inv.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
                </div>
                <div style={{ fontSize: fontSize.tiny + 0.5, color: color.textFaint }}>
                  {inv.status === "uncollectible" ? (
                    <span style={{ color: color.up }}>{STATUS_LABEL[inv.status] ?? inv.status}</span>
                  ) : (
                    STATUS_LABEL[inv.status ?? ""] ?? inv.status
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ fontSize: fontSize.small + 0.5, fontWeight: fontWeight.bold }}>
                  {formatAmount(inv.amountPaidMinor, inv.currency)}
                </div>
                {inv.hostedInvoiceUrl ? (
                  <a href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer" style={{ fontSize: fontSize.small, color: color.brand, fontWeight: fontWeight.semibold }}>
                    View
                  </a>
                ) : null}
                {inv.invoicePdf ? (
                  <a href={inv.invoicePdf} target="_blank" rel="noreferrer" style={{ fontSize: fontSize.small, color: color.brand, fontWeight: fontWeight.semibold }}>
                    Download PDF
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
