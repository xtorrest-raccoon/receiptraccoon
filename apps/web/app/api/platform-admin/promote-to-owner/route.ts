import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "../../../../lib/auth";

/**
 * Platform-admin-only recovery action: promotes an existing member of an
 * arbitrary workspace to System Admin, for when every System Admin there
 * is unreachable (left the company, lost their account, whatever) -- see
 * 0032_platform_support.sql. The actual authorization check and audit
 * logging both happen inside the platform_promote_to_owner() RPC itself,
 * called here through the CALLER's own token (not service role) so
 * auth.uid() resolves to them and is_platform_admin() actually means
 * something -- this route only adds the notification email on top, which
 * needs the service role (reading every member's address via the admin
 * API) and so can't live in the RPC itself.
 */
export const runtime = "nodejs";

const FROM_ADDRESS = "ReceiptRaccoon <noreply@receiptraccoon.fr>";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const body = await request.json().catch(() => null);
  const workspaceId = body?.workspaceId as string | undefined;
  const targetUserId = body?.targetUserId as string | undefined;
  if (!workspaceId || !targetUserId) {
    return NextResponse.json({ error: "workspaceId and targetUserId are required" }, { status: 400 });
  }

  const { error: rpcErr } = await supabase.rpc("platform_promote_to_owner", {
    p_workspace_id: workspaceId,
    p_target_user_id: targetUserId,
  });
  if (rpcErr) {
    return NextResponse.json({ error: rpcErr.message }, { status: 403 });
  }

  // Best-effort from here on -- the promotion already succeeded and is
  // already logged; a failed notification should never look like the
  // recovery itself failed.
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ notified: false });

  try {
    const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: members } = await serviceClient.from("workspace_members").select("user_id").eq("workspace_id", workspaceId);
    const memberIds = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id);

    const { data: targetProfile } = await serviceClient.from("profiles").select("display_name").eq("id", targetUserId).single();
    const targetName = (targetProfile as { display_name: string } | null)?.display_name ?? "A member";

    const emails: string[] = [];
    for (const id of memberIds) {
      const { data } = await serviceClient.auth.admin.getUserById(id);
      if (data.user?.email) emails.push(data.user.email);
    }

    await Promise.all(
      emails.map((to) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM_ADDRESS,
            to,
            subject: "A System Admin was restored on your ReceiptRaccoon workspace",
            html: `
              <p>ReceiptRaccoon support just promoted <strong>${targetName}</strong> to System Admin on your workspace, as part of an account-recovery request.</p>
              <p>If you didn't expect this, contact support immediately.</p>
            `,
          }),
        }).catch(() => null),
      ),
    );
    return NextResponse.json({ notified: true });
  } catch {
    return NextResponse.json({ notified: false });
  }
}
