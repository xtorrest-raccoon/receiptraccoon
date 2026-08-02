import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatMoney, formatShortDate } from "@rr/shared";

/**
 * Triggered once a day by Vercel Cron (see vercel.json) — not user-facing,
 * so auth is a shared secret rather than a session: Vercel Cron sends
 * `Authorization: Bearer ${CRON_SECRET}` automatically when that env var is
 * set, and this route rejects anything else. Service-role throughout, same
 * reasoning as the Stripe webhook: no user session exists in this context.
 *
 * For every workspace that opted in (daily_approval_reminders_enabled),
 * computes each approver's OWN pending queue using the same assignment-
 * scoped authority model enforced everywhere else (see
 * enforce_reimbursement_authority in 0015), then emails only the people
 * whose queue isn't empty.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

const FROM_ADDRESS = "ReceiptRaccoon <noreply@receiptraccoon.fr>";

function serviceClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

interface PendingItem {
  label: string;
  date: string;
  amount: string;
}

async function sendReminderEmail(apiKey: string, to: string, items: PendingItem[], origin: string): Promise<boolean> {
  const rows = items.map((i) => `<li>${i.label} — ${i.date} — ${i.amount}</li>`).join("");
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to,
        subject: `${items.length} expense${items.length === 1 ? "" : "s"} waiting on your decision`,
        html: `
          <p>You have ${items.length} pending item${items.length === 1 ? "" : "s"} to review:</p>
          <ul>${rows}</ul>
          <p><a href="${origin}/team">Review in ReceiptRaccoon</a></p>
        `,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
  }

  const supabase = serviceClient();

  const { data: workspaces, error: wsErr } = await supabase
    .from("workspaces")
    .select("id, home_currency")
    .eq("daily_approval_reminders_enabled", true);
  if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 });

  let emailsSent = 0;

  for (const ws of (workspaces ?? []) as { id: string; home_currency: string }[]) {
    const [membersRes, groupsRes, assignmentsRes, receiptsRes, tripsRes] = await Promise.all([
      supabase
        .from("workspace_members")
        .select("user_id, role, can_approve_reimbursements, can_process_reimbursements")
        .eq("workspace_id", ws.id),
      supabase.from("groups").select("id").eq("workspace_id", ws.id),
      supabase.from("reimbursement_group_assignments").select("approver_id, group_id").eq("workspace_id", ws.id),
      supabase
        .from("receipts")
        .select("created_by, vendor, receipt_date, total_minor, reimbursement_status")
        .eq("workspace_id", ws.id)
        .in("reimbursement_status", ["pending", "approved"]),
      supabase
        .from("mileage_trips")
        .select("user_id, purpose, trip_date, amount_minor, reimbursement_status")
        .eq("workspace_id", ws.id)
        .in("reimbursement_status", ["pending", "approved"]),
    ]);

    const members = (membersRes.data ?? []) as {
      user_id: string;
      role: string;
      can_approve_reimbursements: boolean;
      can_process_reimbursements: boolean;
    }[];
    const groupIds = ((groupsRes.data ?? []) as { id: string }[]).map((g) => g.id);
    const { data: groupMembersData } =
      groupIds.length > 0 ? await supabase.from("group_members").select("group_id, user_id").in("group_id", groupIds) : { data: [] };
    const groupMembers = (groupMembersData ?? []) as { group_id: string; user_id: string }[];
    const assignments = (assignmentsRes.data ?? []) as { approver_id: string; group_id: string }[];
    const receipts = (receiptsRes.data ?? []) as {
      created_by: string;
      vendor: string | null;
      receipt_date: string | null;
      total_minor: number;
      reimbursement_status: string;
    }[];
    const trips = (tripsRes.data ?? []) as {
      user_id: string;
      purpose: string;
      trip_date: string;
      amount_minor: number;
      reimbursement_status: string;
    }[];

    for (const member of members) {
      const isAdmin = member.role === "owner" || member.role === "admin";
      const assignedGroupIds = assignments.filter((a) => a.approver_id === member.user_id).map((a) => a.group_id);
      const assignedEmployeeIds = groupMembers.filter((gm) => assignedGroupIds.includes(gm.group_id)).map((gm) => gm.user_id);
      const canActOn = (capability: "approve" | "process", ownerId: string): boolean => {
        if (isAdmin) return true;
        const hasCapability = capability === "approve" ? member.can_approve_reimbursements : member.can_process_reimbursements;
        return hasCapability && assignedEmployeeIds.includes(ownerId);
      };

      const items: PendingItem[] = [];
      for (const r of receipts) {
        const capability = r.reimbursement_status === "pending" ? "approve" : "process";
        if (canActOn(capability, r.created_by)) {
          items.push({
            label: r.vendor ?? "Receipt",
            date: r.receipt_date ? formatShortDate(r.receipt_date) : "no date",
            amount: formatMoney(r.total_minor, ws.home_currency),
          });
        }
      }
      for (const t of trips) {
        const capability = t.reimbursement_status === "pending" ? "approve" : "process";
        if (canActOn(capability, t.user_id)) {
          items.push({ label: t.purpose, date: formatShortDate(t.trip_date), amount: formatMoney(t.amount_minor, ws.home_currency) });
        }
      }

      if (items.length === 0) continue;

      const { data: userRes } = await supabase.auth.admin.getUserById(member.user_id);
      const email = userRes.user?.email;
      if (!email) continue;

      if (await sendReminderEmail(resendKey, email, items, request.nextUrl.origin)) emailsSent++;
    }
  }

  return NextResponse.json({ workspacesChecked: workspaces?.length ?? 0, emailsSent });
}
