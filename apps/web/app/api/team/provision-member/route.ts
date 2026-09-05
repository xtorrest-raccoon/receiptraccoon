import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveMembership, requireUser } from "../../../../lib/auth";

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

// Same four tiers as Profile Definition's security-group picker (see
// ReimbursementAuthorityTable / setMemberSecurityGroup) -- provisioning can
// set the new account's tier directly instead of always starting them at
// Member and needing a separate step afterward to grant Approver/Finance/
// Admin. Acting on one's OWN claim never gets the role-based blanket-
// authority bypass (see enforce_reimbursement_authority() in
// 0009_reimbursement_assignments.sql), so Admin also grants both
// reimbursement-authority booleans -- otherwise a new admin's own Approve/
// Refund buttons would render enabled (canTransitionReimbursement assumes
// every admin has both) yet fail with a raw 403 on click.
const GROUP_TO_MEMBER_ROW: Record<string, { role: "admin" | "member"; canApprove: boolean; canProcess: boolean }> = {
  admin: { role: "admin", canApprove: true, canProcess: true },
  finance: { role: "member", canApprove: false, canProcess: true },
  approve: { role: "member", canApprove: true, canProcess: false },
  member: { role: "member", canApprove: false, canProcess: false },
};
const ALLOWED_GROUPS = Object.keys(GROUP_TO_MEMBER_ROW);
const FROM_ADDRESS = "Claimeo Pro <noreply@receiptraccoon.fr>";

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
        subject: "Your Claimeo Pro account is ready",
        html: `
          <p>An account was just created for you on Claimeo Pro.</p>
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

/** Same delivery mechanism as sendWelcomeEmail, for the re-provisioned-account case below. */
async function sendReactivatedEmail(email: string, loginUrl: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: email,
        subject: "Your Claimeo Pro access has been restored",
        html: `
          <p>Your access to Claimeo Pro has been restored.</p>
          <p><a href="${loginUrl}">Sign in at ${loginUrl}</a> with your existing password, or use "Forgot password?" there if you don't remember it.</p>
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

  const membership = await getActiveMembership(supabase, userId);
  if (!membership) {
    return NextResponse.json({ error: "No workspace found for this account" }, { status: 403 });
  }
  const { workspaceId, role: callerRole } = membership;
  if (callerRole !== "owner" && callerRole !== "admin") {
    return NextResponse.json({ error: "Only an owner or admin can create accounts" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = (body?.email as string | undefined)?.trim().toLowerCase();
  const group = body?.group as string | undefined;
  if (!email || !group || !ALLOWED_GROUPS.includes(group)) {
    return NextResponse.json({ error: "A valid email and security group are required" }, { status: 400 });
  }
  const memberRow = GROUP_TO_MEMBER_ROW[group]!;

  const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const tempPassword = generateTempPassword();

  const { data: created, error: createErr } = await serviceClient.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  });

  if (!createErr && created.user) {
    const newUserId = created.user.id;

    // handle_new_user() just gave them their own solo workspace as its owner —
    // move them into the admin's workspace instead, same "delete old
    // membership, insert new one" shape as accept_workspace_invite(), just
    // driven by the admin instead of the new user clicking Accept.
    const { error: deleteErr } = await serviceClient.from("workspace_members").delete().eq("user_id", newUserId);
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }
    const { error: insertErr } = await serviceClient.from("workspace_members").insert({
      workspace_id: workspaceId,
      user_id: newUserId,
      role: memberRow.role,
      can_approve_reimbursements: memberRow.canApprove,
      can_process_reimbursements: memberRow.canProcess,
    });
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
    const { error: flagErr } = await serviceClient
      .from("profiles")
      .update({ must_change_password: true, home_workspace_id: workspaceId })
      .eq("id", newUserId);
    if (flagErr) {
      return NextResponse.json({ error: flagErr.message }, { status: 500 });
    }

    const emailSent = await sendWelcomeEmail(email, `${request.nextUrl.origin}/login`);
    return NextResponse.json({ email, tempPassword, emailSent, reactivated: false });
  }

  // createUser failed -- most commonly because this email already has an
  // auth account, typically from a PRIOR membership that was removed:
  // removeMember() deliberately never deletes the underlying account, only
  // the workspace_members row (see that function's own comment), so the
  // account is still sitting there, just orphaned from every workspace.
  // Look it up and re-attach it here instead of failing outright -- that's
  // the whole point of that design ("re-provisioning ... restores access").
  const { data: existingUserId, error: lookupErr } = await serviceClient.rpc("get_user_id_by_email", {
    lookup_email: email,
  });
  if (lookupErr || !existingUserId) {
    return NextResponse.json(
      { error: createErr?.message ?? "Could not create that account — that email may already be registered elsewhere." },
      { status: 409 },
    );
  }

  const { error: reattachErr } = await serviceClient.from("workspace_members").insert({
    workspace_id: workspaceId,
    user_id: existingUserId,
    role: memberRow.role,
    can_approve_reimbursements: memberRow.canApprove,
    can_process_reimbursements: memberRow.canProcess,
  });
  if (reattachErr) {
    // Most likely already a member of this exact workspace.
    return NextResponse.json(
      { error: "That email already has an account, and is already a member of this workspace." },
      { status: 409 },
    );
  }
  // Only fill in home_workspace_id if they don't already have one from
  // elsewhere -- unlike a brand-new account, this person may still belong
  // to another workspace they consider home.
  const { data: existingProfile } = await serviceClient
    .from("profiles")
    .select("home_workspace_id")
    .eq("id", existingUserId)
    .single();
  if (!(existingProfile as { home_workspace_id: string | null } | null)?.home_workspace_id) {
    await serviceClient.from("profiles").update({ home_workspace_id: workspaceId }).eq("id", existingUserId);
  }

  const emailSent = await sendReactivatedEmail(email, `${request.nextUrl.origin}/login`);
  return NextResponse.json({ email, tempPassword: null, emailSent, reactivated: true });
}
