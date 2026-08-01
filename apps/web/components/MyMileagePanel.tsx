"use client";

import { useState } from "react";
import { convertMileageTripCurrency, type ReimbursementStatus } from "@rr/shared";
import { color, fontSize, fontWeight, radius, reimbursementChip } from "@rr/ui-tokens";
import { TODAY } from "../lib/data";
import {
  useAddMileageTrip,
  useCurrentUser,
  useFxRate,
  useHomeCurrency,
  useMileage,
  useMyDisplayPrefs,
  useUsers,
} from "../lib/queries";
import { MileageTable } from "./MileageTable";
import { MultiSelectDropdown, multiSelectControlStyle } from "./MultiSelectDropdown";

const STATUS_OPTIONS: ReimbursementStatus[] = ["pending", "approved", "reimbursed", "rejected"];
// Rejected/reimbursed are settled — default to what still needs action.
const DEFAULT_STATUS_FILTER: ReimbursementStatus[] = ["pending", "approved"];

/**
 * Rendered by the top-level /mileage page. MileageTable elsewhere (Team
 * page) is the admin/manager-facing everyone's-trips view; this is the
 * counterpart for someone who works entirely on web and never installs
 * mobile: log a trip and see their own reimbursement status. No explicit
 * per-user filtering needed beyond passing currentUser.id to useMileage —
 * RLS already limits a plain member to their own rows regardless.
 */
export function MyMileagePanel() {
  const { data: currentUser } = useCurrentUser();
  const { data: users } = useUsers();
  const { data: homeCurrency } = useHomeCurrency();
  const { data: trips } = useMileage(currentUser?.id);
  const addTrip = useAddMileageTrip();

  // Personal, display-only re-expression of already-fetched trips (see
  // apps/web/app/profile/page.tsx) -- this is the one "my own data" view on
  // web that honors it. Team's mileage table and everywhere else keeps
  // showing the workspace currency for everyone.
  const { data: prefs } = useMyDisplayPrefs();
  const displayCurrency = prefs?.currency ?? homeCurrency;
  const { data: fxRate } = useFxRate(homeCurrency, displayCurrency);
  const displayTrips =
    trips && homeCurrency && displayCurrency && fxRate != null
      ? trips.map((t) => convertMileageTripCurrency(t, homeCurrency, displayCurrency, fxRate))
      : trips;

  const [purpose, setPurpose] = useState("");
  const [tripDate, setTripDate] = useState(TODAY);
  const [distance, setDistance] = useState("");
  const [distanceUnit, setDistanceUnit] = useState<"mi" | "km">("mi");
  const [statusFilter, setStatusFilter] = useState<ReimbursementStatus[]>(DEFAULT_STATUS_FILTER);

  const canSubmit = purpose.trim() !== "" && tripDate !== "" && Number(distance) > 0;

  const submit = () => {
    if (!canSubmit) return;
    addTrip.mutate(
      { tripDate, purpose: purpose.trim(), distance: Number(distance), distanceUnit },
      {
        onSuccess: () => {
          setPurpose("");
          setDistance("");
        },
      },
    );
  };

  if (!users || !homeCurrency || !displayCurrency) return null;

  const filteredTrips = (displayTrips ?? []).filter((t) => statusFilter.includes(t.reimbursementStatus));

  return (
    <div>
      <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: 12 }}>Log a trip</div>
        <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 10 }}>
          <input
            placeholder="Purpose (e.g. Client visit)"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            style={{ flex: "1 1 220px", padding: "9px 14px", borderRadius: radius.md, border: `1px solid ${color.borderStrong}`, fontSize: fontSize.body }}
          />
          <input
            type="date"
            value={tripDate}
            onChange={(e) => setTripDate(e.target.value)}
            style={{ padding: "9px 14px", borderRadius: radius.md, border: `1px solid ${color.borderStrong}`, fontSize: fontSize.body }}
          />
          <input
            type="number"
            min="0"
            step="0.1"
            placeholder="Distance"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            style={{ width: 110, padding: "9px 14px", borderRadius: radius.md, border: `1px solid ${color.borderStrong}`, fontSize: fontSize.body }}
          />
          <select
            value={distanceUnit}
            onChange={(e) => setDistanceUnit(e.target.value as "mi" | "km")}
            style={{ padding: "9px 10px", borderRadius: radius.md, border: `1px solid ${color.borderStrong}`, fontSize: fontSize.body, background: color.surface, color: color.text }}
          >
            <option value="mi">mi</option>
            <option value="km">km</option>
          </select>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || addTrip.isPending}
            style={{
              padding: "9px 16px",
              borderRadius: radius.md,
              background: color.brand,
              color: color.surface,
              fontWeight: fontWeight.bold,
              fontSize: fontSize.body,
              border: "none",
              cursor: canSubmit ? "pointer" : "not-allowed",
              opacity: canSubmit && !addTrip.isPending ? 1 : 0.6,
            }}
          >
            {addTrip.isPending ? "…" : "Add trip"}
          </button>
        </div>
        {addTrip.isError ? (
          <div style={{ fontSize: fontSize.small, color: color.up }}>
            {addTrip.error instanceof Error ? addTrip.error.message : "Couldn't log that trip."}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <MultiSelectDropdown
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: reimbursementChip[s].label }))}
          selected={statusFilter}
          onChange={(next) => setStatusFilter(next as ReimbursementStatus[])}
          emptyLabel="No statuses selected"
          buttonStyle={{ ...multiSelectControlStyle, width: 200, padding: "9px 14px", fontSize: fontSize.body, fontWeight: fontWeight.semibold }}
        />
      </div>

      <MileageTable trips={filteredTrips} currency={displayCurrency} users={users} />
    </div>
  );
}
