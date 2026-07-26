import type { ReimbursementStatus, Role } from "./types.js";

/**
 * Authorization rules. Decided 2026-07-19 — see DESIGN_V2_DELTA.md §9.
 *
 * IMPORTANT: this module is for UI affordances only (hide the Team tab, render a
 * badge instead of a dropdown). It is NOT the enforcement point. Enforcement lives
 * in Postgres RLS policies and the `enforce_reimbursement_authority` trigger, so
 * the rules hold regardless of which client is writing.
 *
 * Never let a check here be the only thing standing between a member and an
 * approval.
 */

export function isAdmin(role: Role): boolean {
  return role === "owner" || role === "admin";
}

export function canManageWorkspaceSettings(role: Role): boolean {
  return isAdmin(role);
}

export function canManageBilling(role: Role): boolean {
  return role === "owner";
}

/**
 * Whether someone can approve/reject or process (refund) reimbursements is now
 * independent of role — see 0007_reimbursement_authority.sql. A plain member
 * can be granted either capability (or both) without becoming admin/owner;
 * role still gates workspace administration (settings, invites, members) on
 * its own, unrelated axis.
 */
export interface ReimbursementAuthority {
  canApproveReimbursements: boolean;
  canProcessReimbursements: boolean;
}

export function hasAnyReimbursementAuthority(authority: ReimbursementAuthority): boolean {
  return authority.canApproveReimbursements || authority.canProcessReimbursements;
}

/** Admin/owner can always see it; anyone granted either capability can too. */
export function canViewTeamPage(role: Role, authority: ReimbursementAuthority): boolean {
  return isAdmin(role) || hasAnyReimbursementAuthority(authority);
}

/**
 * Can this actor move a receipt (or mileage trip) to `targetStatus`?
 *
 * Mirrors enforce_reimbursement_authority() in 0007_reimbursement_authority.sql
 * — approve/reject/back-to-pending need canApproveReimbursements, only the
 * final payout (-> reimbursed) needs canProcessReimbursements. This is a UI
 * affordance only (disable the option, don't offer the control); it does not
 * attempt to replicate the trigger's self-approval exception, since that
 * needs the whole workspace's authority list to evaluate — a rejected write
 * surfaces the server's error instead.
 */
export function canTransitionReimbursement(
  targetStatus: ReimbursementStatus,
  role: Role,
  authority: ReimbursementAuthority,
): boolean {
  if (isAdmin(role)) return true;
  return targetStatus === "reimbursed" ? authority.canProcessReimbursements : authority.canApproveReimbursements;
}

/**
 * Amounts are editable only while a receipt is still pending.
 *
 * Once it is approved or reimbursed the figure has been signed off and, in the
 * reimbursed case, actually paid — editing it afterwards would mean the amount on
 * record no longer matches what was approved or transferred. A rejected receipt is
 * frozen too: the employee moves it back to pending to correct and resubmit, which
 * makes the correction visible in reimbursement_events rather than silent.
 *
 * Enforced in the database as well as here — see the receipt amount trigger in
 * 0001_init.sql. This function is for UI affordances only.
 */
export function canEditReceiptAmount(status: ReimbursementStatus): boolean {
  return status === "pending";
}

/**
 * Comments freeze on the same rule as amounts: editable only while pending.
 *
 * Once a claim has been approved, paid, or rejected, the comment is part of what
 * an approver acted on. Letting it change afterwards would mean the justification
 * on record is not the one that was reviewed. To revise it, the receipt goes back
 * to pending, which is a visible transition in reimbursement_events rather than a
 * silent edit.
 *
 * Enforced in the database as well as here — this function is for UI affordances
 * only.
 */
export function canEditReceiptComment(status: ReimbursementStatus): boolean {
  return status === "pending";
}

/** Category freezes on the same rule as amounts and comments — see canEditReceiptAmount. */
export function canEditReceiptCategory(status: ReimbursementStatus): boolean {
  return status === "pending";
}

/**
 * Deleting is looser than editing: a rejected receipt can be deleted outright
 * (no money changed hands, and the employee may not want to resubmit it) as
 * well as a still-pending one. Approved and reimbursed stay undeletable —
 * those represent a real decision or payment that must stay on record.
 */
export function canDeleteReceipt(status: ReimbursementStatus): boolean {
  return status === "pending" || status === "rejected";
}

/** Rejection is not terminal — an employee can correct and resubmit. */
export const REIMBURSEMENT_TRANSITIONS: Record<ReimbursementStatus, ReimbursementStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["reimbursed", "rejected", "pending"],
  reimbursed: ["pending"],
  rejected: ["pending"],
};

export function isLegalTransition(
  from: ReimbursementStatus,
  to: ReimbursementStatus,
): boolean {
  return REIMBURSEMENT_TRANSITIONS[from].includes(to);
}
