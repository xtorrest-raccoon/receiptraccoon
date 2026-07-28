import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireUser } from "../../../../lib/auth";

/**
 * Owner/admin: hands back a URL to Stripe's own hosted Billing Portal, where
 * the customer updates or replaces their card on file — same "let Stripe own
 * the PCI-sensitive UI" reasoning as Checkout itself. This is the "place
 * your payment method" entry point for a workspace that already has a
 * subscription; a brand-new workspace uses Checkout instead (via
 * BillingGate), since it has no customer/subscription yet to manage.
 */
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: "Only the workspace owner or an admin can manage billing" }, { status: 403 });
  }

  const { data: workspace, error: wsErr } = await supabase
    .from("workspaces")
    .select("stripe_customer_id")
    .eq("id", workspaceId)
    .single();
  const customerId = (workspace as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (wsErr || !customerId) {
    return NextResponse.json({ error: "No billing account yet — subscribe first" }, { status: 404 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${request.nextUrl.origin}/setup`,
  });

  return NextResponse.json({ url: portalSession.url });
}
