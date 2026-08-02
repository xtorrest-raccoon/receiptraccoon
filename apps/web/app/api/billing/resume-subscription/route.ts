import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getActiveMembership, requireUser } from "../../../../lib/auth";

/**
 * Owner/admin: undoes a pending cancel_at_period_end before it actually
 * takes effect. Only meaningful for a paid subscription scheduled to
 * cancel — a trial cancellation is immediate and final (see
 * /api/billing/cancel-subscription), nothing to resume there.
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

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("stripe_subscription_id")
    .eq("id", workspaceId)
    .single();
  const subscriptionId = (workspace as { stripe_subscription_id: string | null } | null)?.stripe_subscription_id;
  if (!subscriptionId) {
    return NextResponse.json({ error: "No subscription to resume" }, { status: 404 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
  await supabase.from("workspaces").update({ cancel_at_period_end: false }).eq("id", workspaceId);

  return NextResponse.json({ resumed: true });
}
