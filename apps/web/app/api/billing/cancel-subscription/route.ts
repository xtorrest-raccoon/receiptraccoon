import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireUser } from "../../../../lib/auth";

/**
 * Owner/admin: cancels the caller's workspace's subscription.
 *
 * A trialing subscription is canceled outright (stripe.subscriptions.cancel)
 * — access ends immediately, which is fine since nothing was ever charged.
 * A paid one instead gets cancel_at_period_end: true — access continues
 * through what's already been paid for, then stops; undoable up until then
 * via /api/billing/resume-subscription. The RLS-bound client from
 * requireUser can write workspaces directly here (workspaces_update already
 * permits owner/admin), no service role needed.
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

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("stripe_subscription_id")
    .eq("id", workspaceId)
    .single();
  const subscriptionId = (workspace as { stripe_subscription_id: string | null } | null)?.stripe_subscription_id;
  if (!subscriptionId) {
    return NextResponse.json({ error: "No active subscription to cancel" }, { status: 404 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  if (subscription.status === "trialing") {
    await stripe.subscriptions.cancel(subscriptionId);
    await supabase
      .from("workspaces")
      .update({ billing_status: "canceled", trial_ends_at: null, cancel_at_period_end: false })
      .eq("id", workspaceId);
    return NextResponse.json({ canceled: true, immediately: true });
  }

  const updated = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  const accessUntil = new Date(updated.current_period_end * 1000).toISOString();
  await supabase
    .from("workspaces")
    .update({ cancel_at_period_end: true, current_period_end: accessUntil })
    .eq("id", workspaceId);
  return NextResponse.json({ canceled: true, immediately: false, accessUntil });
}
