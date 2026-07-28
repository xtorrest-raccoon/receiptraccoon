import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

/**
 * Stripe calls this directly — no user session, no RLS-respecting client
 * possible, so this is service-role throughout. Signature verification
 * (constructEvent) is what actually authenticates the caller as Stripe
 * rather than anyone who found the URL; the raw body is required for that,
 * which is why this reads request.text() rather than request.json().
 */
export const runtime = "nodejs";

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** Mirrors workspaces.billing_status's check constraint in 0010_workspace_billing.sql. */
function mapSubscriptionStatus(status: Stripe.Subscription.Status): "active" | "past_due" | "canceled" | "inactive" {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  return "inactive";
}

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = serviceClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspace_id ?? session.client_reference_id;
      if (workspaceId && session.customer && session.subscription) {
        // Re-retrieve rather than trust session.subscription's shape here —
        // the webhook event only ever gives us the subscription ID, not its
        // expanded fields like trial_end.
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await supabase
          .from("workspaces")
          .update({
            billing_status: "active",
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            trial_used: true,
            trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq("id", workspaceId);
      }
      break;
    }
    // Covers plan changes, past-due retries, and reactivations — anything
    // that changes the subscription's own status after checkout.
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const workspaceId = subscription.metadata?.workspace_id;
      if (workspaceId) {
        await supabase
          .from("workspaces")
          .update({
            billing_status: mapSubscriptionStatus(subscription.status),
            // Once Stripe itself reports the subscription as no longer
            // trialing (natural expiry or our own trial_end: 'now' call in
            // /api/billing/sync-seats), stop showing a trial countdown.
            trial_ends_at: subscription.status === "trialing" && subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq("id", workspaceId);
      }
      break;
    }
    // Fires once a cancel_at_period_end subscription actually finishes, or
    // immediately for our own stripe.subscriptions.cancel() call when
    // canceling during a trial (see /api/billing/cancel-subscription).
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const workspaceId = subscription.metadata?.workspace_id;
      if (workspaceId) {
        await supabase
          .from("workspaces")
          .update({ billing_status: "canceled", cancel_at_period_end: false, trial_ends_at: null })
          .eq("id", workspaceId);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
