import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { requireUser } from "../../../../lib/auth";

/**
 * Owner/admin: saves the customer billing address (legal name, address,
 * tax ID, billing email -- see 0022_billing_address.sql) for the caller's
 * own workspace, and syncs it to the Stripe Customer object so Stripe's
 * own invoice PDFs pick it up automatically. Tax ID goes through
 * invoice_settings.custom_fields rather than Stripe's Tax IDs API --
 * that API requires knowing the exact type per country (eu_vat, us_ein,
 * ...), which is more validation than this needs; a custom field still
 * renders on every invoice.
 *
 * If the workspace has no stripe_customer_id yet (mid-checkout, or never
 * subscribed), the address is still saved here -- it just isn't synced
 * to Stripe until a customer exists.
 */
export const runtime = "nodejs";

interface AddressInput {
  legalName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  taxId: string | null;
  billingEmail: string | null;
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

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

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const address: AddressInput = {
    legalName: clean(body.legalName),
    addressLine1: clean(body.addressLine1),
    addressLine2: clean(body.addressLine2),
    city: clean(body.city),
    state: clean(body.state),
    postalCode: clean(body.postalCode),
    country: clean(body.country)?.toUpperCase() ?? null,
    taxId: clean(body.taxId),
    billingEmail: clean(body.billingEmail),
  };

  const { error: updateErr } = await supabase
    .from("workspaces")
    .update({
      billing_legal_name: address.legalName,
      billing_address_line1: address.addressLine1,
      billing_address_line2: address.addressLine2,
      billing_city: address.city,
      billing_state: address.state,
      billing_postal_code: address.postalCode,
      billing_country: address.country,
      billing_tax_id: address.taxId,
      billing_email: address.billingEmail,
    })
    .eq("id", workspaceId);
  if (updateErr) {
    return NextResponse.json({ error: "Could not save the billing address" }, { status: 500 });
  }

  const { data: workspace } = await supabase.from("workspaces").select("stripe_customer_id").eq("id", workspaceId).single();
  const customerId = (workspace as { stripe_customer_id: string | null } | null)?.stripe_customer_id;

  if (customerId) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    try {
      await stripe.customers.update(customerId, {
        ...(address.legalName ? { name: address.legalName } : {}),
        ...(address.billingEmail ? { email: address.billingEmail } : {}),
        address: {
          line1: address.addressLine1 ?? "",
          line2: address.addressLine2 ?? "",
          city: address.city ?? "",
          state: address.state ?? "",
          postal_code: address.postalCode ?? "",
          country: address.country ?? "",
        },
        invoice_settings: {
          custom_fields: address.taxId ? [{ name: "Tax ID", value: address.taxId }] : [],
        },
      });
    } catch {
      // The address is already saved above -- a Stripe sync failure (e.g.
      // a malformed field Stripe rejects) shouldn't lose what was entered,
      // just delay it showing up on the next invoice.
      return NextResponse.json({ saved: true, stripeSynced: false });
    }
  }

  return NextResponse.json({ saved: true, stripeSynced: Boolean(customerId) });
}
