import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getActiveMembership, requireUser } from "../../../../lib/auth";

const TRIAL_DAYS = 30;

/**
 * Owner/admin: starts a Stripe Checkout session for the caller's own
 * workspace, priced per seat (quantity = current member count) against the
 * one recurring Price configured in STRIPE_PRICE_ID. The actual
 * billing_status flip to 'active' happens in the webhook once Stripe
 * confirms payment — this route only ever hands back a URL to redirect to.
 *
 * Grants a 30-day free trial (card still required up front — Stripe collects
 * it now and only actually charges once the trial ends) the first time a
 * workspace ever subscribes — see trial_used in 0011_billing_trial.sql.
 */
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  const { supabase, userId } = auth;

  const membership = await getActiveMembership(supabase, userId);
  if (!membership) {
    return NextResponse.json({ error: "No workspace found for this account" }, { status: 403 });
  }
  const { workspaceId, role } = membership;
  if (role !== "owner" && role !== "admin") {
    return NextResponse.json({ error: "Only the workspace owner or an admin can manage billing" }, { status: 403 });
  }

  const { data: workspace, error: wsErr } = await supabase
    .from("workspaces")
    .select("stripe_customer_id, trial_used")
    .eq("id", workspaceId)
    .single();
  if (wsErr || !workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const { count } = await supabase
    .from("workspace_members")
    .select("user_id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  const { data: userData } = await supabase.auth.getUser();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const ws = workspace as { stripe_customer_id: string | null; trial_used: boolean };
  const existingCustomerId = ws.stripe_customer_id;

  // exactOptionalPropertyTypes rejects passing customer_email: undefined
  // explicitly — omit the key entirely rather than pass a possibly-undefined value.
  const identity = existingCustomerId
    ? { customer: existingCustomerId }
    : userData.user?.email
      ? { customer_email: userData.user.email }
      : {};

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ...identity,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: count ?? 1 }],
    success_url: `${request.nextUrl.origin}/dashboard`,
    cancel_url: `${request.nextUrl.origin}/dashboard`,
    client_reference_id: workspaceId,
    subscription_data: {
      metadata: { workspace_id: workspaceId },
      ...(ws.trial_used ? {} : { trial_period_days: TRIAL_DAYS }),
    },
    metadata: { workspace_id: workspaceId },
  });

  if (!session.url) {
    return NextResponse.json({ error: "Could not start checkout" }, { status: 502 });
  }
  return NextResponse.json({ url: session.url });
}
