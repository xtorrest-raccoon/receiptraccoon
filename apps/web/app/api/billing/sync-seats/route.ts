import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getActiveMembership, requireUser } from "../../../../lib/auth";

/**
 * Recomputes the caller's workspace's member count and pushes it to Stripe
 * as the subscription's quantity — per-seat pricing means the price scales
 * with headcount, so this needs to run after anything that adds or removes
 * a member. Called best-effort from the client after ProvisionMemberPanel,
 * AcceptInviteBanner, and member removal succeed; a no-op (not an error) if
 * the workspace has no active subscription yet.
 *
 * Any member can trigger this (it only ever reports an accurate count, it
 * doesn't grant or change anyone's access) — no admin check needed beyond
 * the caller genuinely belonging to the workspace being synced.
 */
export const runtime = "nodejs";

const TRIAL_SEAT_CAP = 5;
const FROM_ADDRESS = "Claimeo Pro <noreply@receiptraccoon.fr>";

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** Best-effort, same reasoning as provision-member's sendWelcomeEmail — never blocks the actual seat sync. */
async function notifyTrialEndedEarly(workspaceId: string, origin: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  try {
    const svc = serviceClient();
    const { data: ownerRow } = await svc
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("role", "owner")
      .limit(1)
      .single();
    const ownerId = (ownerRow as { user_id: string } | null)?.user_id;
    if (!ownerId) return;
    const { data: ownerUser } = await svc.auth.admin.getUserById(ownerId);
    const email = ownerUser.user?.email;
    if (!email) return;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: email,
        subject: "Your Claimeo Pro trial has ended",
        html: `
          <p>Your workspace just went over the ${TRIAL_SEAT_CAP}-seat limit for the free trial.</p>
          <p>Your subscription has started and your card has been charged for the current seat count.</p>
          <p><a href="${origin}/setup">View billing in Setup</a></p>
        `,
      }),
    });
  } catch {
    // best-effort — a failed notification email never blocks the seat sync
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  const { supabase, userId } = auth;

  const membership = await getActiveMembership(supabase, userId);
  if (!membership) {
    return NextResponse.json({ error: "No workspace found for this account" }, { status: 403 });
  }
  const { workspaceId } = membership;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("stripe_subscription_id, trial_ends_at")
    .eq("id", workspaceId)
    .single();
  const ws = workspace as { stripe_subscription_id: string | null; trial_ends_at: string | null } | null;
  const subscriptionId = ws?.stripe_subscription_id;
  if (!subscriptionId) {
    return NextResponse.json({ synced: false });
  }

  const { count } = await supabase
    .from("workspace_members")
    .select("user_id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) {
    return NextResponse.json({ synced: false });
  }

  const inTrial = ws?.trial_ends_at !== null && ws?.trial_ends_at !== undefined && new Date(ws.trial_ends_at) > new Date();
  const overTrialCap = inTrial && (count ?? 0) > TRIAL_SEAT_CAP;

  await stripe.subscriptions.update(subscriptionId, {
    items: [{ id: itemId, quantity: count ?? 1 }],
    ...(overTrialCap ? { trial_end: "now" } : {}),
  });

  if (overTrialCap) {
    const svc = serviceClient();
    await svc.from("workspaces").update({ trial_ends_at: null, trial_ended_early: true }).eq("id", workspaceId);
    await notifyTrialEndedEarly(workspaceId, request.nextUrl.origin);
  }

  return NextResponse.json({ synced: true, seats: count, trialEndedEarly: overTrialCap });
}
