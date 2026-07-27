import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "../../../../lib/auth";

/**
 * Admin/owner-only: creates a brand-new account for someone who will never
 * self-register (see the mobile app's sign-in-only login screen) — a
 * temporary password is generated here and returned ONCE for the admin to
 * relay to that person however they like.
 *
 * A welcome email is also sent (via Resend's API directly — not Supabase
 * Auth's own email, which we skip via email_confirm below) with a link to
 * sign in, but deliberately NOT the password itself: email isn't a fully
 * secure channel, so the temp password still only ever reaches the new
 * person however the admin relays it themselves.
 *
 * Uses the service-role key for two things a signed-in user's own client
 * can never do: Supabase's admin.createUser (skips email confirmation
 * entirely, since the admin is vouching for this address, not the person
 * confirming it themselves) and moving the brand-new account's membership
 * out of the solo workspace handle_new_user() auto-creates for it and into
 * the admin's own workspace instead.
 */
export const runtime = "nodejs";

const ALLOWED_ROLES = ["member", "admin"];
const FROM_ADDRESS = "ReceiptRaccoon <noreply@receiptraccoon.fr>";

function generateTempPassword(): string {
  // Excludes visually ambiguous characters (0/O, 1/l/I) — this gets typed by
  // hand from wherever the admin relays it.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

/**
 * Best-effort — a failed welcome email should never undo an already-created
 * account, so this is called after everything else succeeds and its result
 * only affects the response message, not whether the request as a whole
 * failed.
 */
async function sendWelcomeEmail(email: string, loginUrl: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: email,
        subject: "Your ReceiptRaccoon account is ready",
        html: `
          <p>An account was just created for you on ReceiptRaccoon.</p>
          <p><a href="${loginUrl}">Sign in at ${loginUrl}</a> using the temporary password your admin gave you separately.</p>
          <p>You'll be asked to choose your own password the first time you sign in.</p>
        `,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
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
  const { workspace_id: workspaceId, role: callerRole } = membership as { workspace_id: string; role: string };
  if (callerRole !== "owner" && callerRole !== "admin") {
    return NextResponse.json({ error: "Only an owner or admin can create accounts" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  const role = body?.role as string | undefined;
  if (!email || !role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "A valid email and role (member or admin) are required" }, { status: 400 });
  }

  const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const tempPassword = generateTempPassword();

  const { data: created, error: createErr } = await serviceClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });
  if (createErr || !created.user) {
    // Most common case: this email already has an account somewhere else.
    return NextResponse.json(
      { error: createErr?.message ?? "Could not create that account — that email may already be registered elsewhere." },
      { status: 409 },
    );
  }
  const newUserId = created.user.id;

  // handle_new_user() just gave them their own solo workspace as its owner —
  // move them into the admin's workspace instead, same "delete old
  // membership, insert new one" shape as accept_workspace_invite(), just
  // driven by the admin instead of the new user clicking Accept.
  const { error: deleteErr } = await serviceClient.from("workspace_members").delete().eq("user_id", newUserId);
  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }
  const { error: insertErr } = await serviceClient
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, user_id: newUserId, role });
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  const { error: flagErr } = await serviceClient
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", newUserId);
  if (flagErr) {
    return NextResponse.json({ error: flagErr.message }, { status: 500 });
  }

  const emailSent = await sendWelcomeEmail(email, `${request.nextUrl.origin}/login`);

  return NextResponse.json({ email, tempPassword, emailSent });
}
