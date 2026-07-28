import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireUser } from "../../../../lib/auth";

/**
 * Owner/admin: lists past invoices straight from Stripe (no local copy —
 * Stripe is the source of truth and already generates a PDF + hosted page
 * per invoice), for the Invoices section of Setup. An empty list, not an
 * error, if the workspace has no customer yet.
 */
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  const { supabase, userId } = auth;

  const { data: membership, error: membershipErr } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .limit(1)
    .single();
  if (membershipErr || !membership) {
    return NextResponse.json({ error: "No workspace found for this account" }, { status: 403 });
  }
  const { workspace_id: workspaceId, role } = membership as { workspace_id: string; role: string };
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Only the workspace owner or an admin can view invoices" }, { status: 403 });
  }

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("stripe_customer_id")
    .eq("id", workspaceId)
    .single();
  const customerId = (workspace as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ invoices: [] });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const invoices = await stripe.invoices.list({ customer: customerId, limit: 24 });

  return NextResponse.json({
    invoices: invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      createdAt: new Date(inv.created * 1000).toISOString(),
      amountPaidMinor: inv.amount_paid,
      currency: inv.currency,
      status: inv.status,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      invoicePdf: inv.invoice_pdf ?? null,
    })),
  });
}
