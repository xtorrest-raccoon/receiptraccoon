"use client";

import { color, fontSize, fontWeight } from "@rr/ui-tokens";
import { MyMileagePanel } from "../../components/MyMileagePanel";

/** Top-level, visible to everyone signed in — RLS scopes what each role actually sees (own trips vs. everyone's for admin/authority). */
export default function MileagePage() {
  return (
    <div>
      <div style={{ fontSize: fontSize.h1, fontWeight: fontWeight.heavy, letterSpacing: "-0.01em", marginBottom: 4 }}>Mileage</div>
      <div style={{ fontSize: fontSize.body, color: color.textMuted, marginBottom: 20 }}>
        Log a trip and track its reimbursement.
      </div>
      <MyMileagePanel />
    </div>
  );
}
