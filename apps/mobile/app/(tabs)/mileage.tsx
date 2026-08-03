import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, reimbursementChip } from "@rr/ui-tokens";
import {
  formatMoney,
  formatShortDate,
  currencySymbol,
  isRecentOrActionable,
  rateToDecimalString,
  mileageAmountForTrip,
  type DistanceUnit,
  type MileageTrip,
} from "@rr/shared";
import { rn } from "../../lib/colors";
import { convertDistance, formatDistance } from "../../lib/units";
import { CURRENT_MONTH, TODAY, calculateMileageDistance, type CalculatedDistance } from "../../lib/data";
import {
  useAddMileageTrip,
  useDeleteMileageTrip,
  useDisplayCurrency,
  useDisplayDistanceUnit,
  useDistanceUnit,
  useHomeCurrency,
  useIsHomeWorkspace,
  useMileage,
  useMyMileageRate,
  useUpdateMileageTrip,
} from "../../lib/queries";
import { Text } from "../../components/Text";
import { TextInput } from "../../components/TextInput";
import { TripRow } from "../../components/TripRow";
import { TripDetailModal } from "../../components/TripDetailModal";
import { SwipeToDelete } from "../../components/SwipeToDelete";

export default function MileageScreen() {
  const insets = useSafeAreaInsets();

  // "workspaceUnit" is the functional truth new trips log their distance in
  // (must never change — see plan's scope cut) — the rate itself is
  // denominated in this person's own currency, from myRate below, not
  // necessarily workspaceCurrency. "display*" is what already-logged trips
  // are shown in, personal-override-or-workspace-default — falls back to
  // workspace while the personal preference is still loading.
  const { data: workspaceCurrency } = useHomeCurrency();
  const { data: workspaceUnit } = useDistanceUnit();
  const { data: displayCurrency } = useDisplayCurrency();
  const { data: displayUnit } = useDisplayDistanceUnit();
  // You can toggle into a workspace you administer, but can only submit
  // trips into the one you were originally added to -- see
  // 0024_home_workspace.sql. Already-logged trips (from your home
  // workspace) still show/edit normally regardless of which is active.
  const { data: isHome } = useIsHomeWorkspace();
  const currency = displayCurrency ?? workspaceCurrency;
  const unit = displayUnit ?? workspaceUnit;
  // My own effective rate — my per-user override if an owner/admin set one,
  // else the workspace default — and the currency it's actually denominated
  // in (my own Setup row, if an admin set one there, else the workspace's).
  // Same rate addMileageTrip itself will use; no conversion needed to show
  // it, since it's already in whichever currency Setup put me in.
  const { data: myRate } = useMyMileageRate();
  const { data: trips, isLoading } = useMileage();
  const addMileageTrip = useAddMileageTrip();
  const updateMileageTrip = useUpdateMileageTrip();
  const deleteMileageTrip = useDeleteMileageTrip();

  const [addTripOpen, setAddTripOpen] = useState(false);
  /** Non-null when the form is editing an existing trip rather than adding one. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPurpose, setNewPurpose] = useState("");
  const [newDate, setNewDate] = useState(TODAY);
  const [newDistance, setNewDistance] = useState("");

  /** Editing an existing trip always forces "manual" — see startEdit below. */
  const [entryMode, setEntryMode] = useState<"manual" | "automatic">("manual");
  const [newStartAddress, setNewStartAddress] = useState("");
  const [newEndAddress, setNewEndAddress] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState<string | null>(null);
  /** Non-null only once a successful lookup has resolved a distance to save. */
  const [calculated, setCalculated] = useState<CalculatedDistance | null>(null);

  /** Non-null when a non-editable trip's read-only details are open — see TripDetailModal. */
  const [viewingTrip, setViewingTrip] = useState<MileageTrip | null>(null);

  if (!workspaceCurrency || !workspaceUnit || !currency || !unit || !myRate || isLoading || !trips) {
    return (
      <View style={{ flex: 1, backgroundColor: rn(color.bgMobile), alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={rn(color.brand)} />
      </View>
    );
  }

  // Reimbursed trips older than 3 months drop off the list below -- see
  // isRecentOrActionable. Everything still pending/approved/rejected stays,
  // and the full history remains on the web app. The "this month" stats
  // above read from the full, unfiltered `trips`, same as ever.
  const visibleTrips = trips.filter((t) => isRecentOrActionable(t.reimbursementStatus, t.tripDate));

  const monthTrips = trips.filter((t) => t.tripDate.startsWith(CURRENT_MONTH));
  const monthReimbMinor = monthTrips.reduce((sum, t) => sum + t.amountMinor, 0);
  const monthDistanceInUnit = monthTrips.reduce(
    (sum, t) => sum + convertDistance(t.distance, t.distanceUnit, unit),
    0,
  );

  const manualDistanceValue = parseFloat(newDistance.replace(",", "."));
  // In automatic mode the distance to save comes from the last successful
  // lookup, not a typed number — see calculated state above.
  const distanceValue = entryMode === "automatic" ? calculated?.distance ?? NaN : manualDistanceValue;
  // Computed locally from the same rate/currency already loaded for this
  // screen, rather than a round-trip per keystroke — mathematically identical
  // to the RAW figure addMileageTrip computes before converting to the
  // workspace's currency (see getEffectiveMileageRateInfo). Shown in the
  // rate's own currency, i.e. whatever Setup's user currency & mileage table
  // has this person in — the actually-saved amount_minor may still get
  // converted to the workspace's currency server-side, but that's not useful
  // to preview here; this person thinks in their own currency.
  const estimateMinor =
    !isNaN(distanceValue) && distanceValue > 0
      ? mileageAmountForTrip(distanceValue, workspaceUnit, myRate.rateMilli, workspaceUnit, myRate.currency)
      : null;

  const closeForm = () => {
    setAddTripOpen(false);
    setEditingId(null);
    setNewPurpose("");
    setNewDistance("");
    setNewDate(TODAY);
    setEntryMode("manual");
    setNewStartAddress("");
    setNewEndAddress("");
    setCalculating(false);
    setCalcError(null);
    setCalculated(null);
  };

  /**
   * Tapping a pending trip loads it into the same form used to add one,
   * always in Manual mode — the distance is already frozen at entry (same
   * "never recomputed" principle as rateMilli), so there's nothing to
   * recalculate even if the trip was originally logged automatically.
   */
  const startEdit = (trip: MileageTrip) => {
    setEditingId(trip.id);
    setNewPurpose(trip.purpose);
    setNewDate(trip.tripDate);
    setNewDistance(String(trip.distance));
    setEntryMode("manual");
    setAddTripOpen(true);
  };

  const runCalculateDistance = async () => {
    if (!newStartAddress.trim() || !newEndAddress.trim()) return;
    setCalculating(true);
    setCalcError(null);
    setCalculated(null);
    try {
      const result = await calculateMileageDistance(newStartAddress.trim(), newEndAddress.trim(), workspaceUnit);
      setCalculated(result);
    } catch (err) {
      setCalcError(err instanceof Error ? err.message : "Couldn't calculate that distance.");
    } finally {
      setCalculating(false);
    }
  };

  const saveTrip = () => {
    if (!newPurpose.trim() || isNaN(distanceValue) || distanceValue <= 0) return;

    if (editingId) {
      updateMileageTrip.mutate(
        { id: editingId, patch: { tripDate: newDate, purpose: newPurpose.trim(), distance: distanceValue } },
        {
          onSuccess: (updated) => {
            if (!updated) Alert.alert("Could not save", "Only pending trips can be edited.");
          },
        },
      );
    } else {
      addMileageTrip.mutate({
        tripDate: newDate,
        purpose: newPurpose.trim(),
        distance: distanceValue,
        distanceUnit: workspaceUnit,
        ...(entryMode === "automatic" && calculated
          ? { startAddress: calculated.originAddress, endAddress: calculated.destinationAddress }
          : {}),
      });
    }
    closeForm();
  };

  const confirmDelete = (trip: MileageTrip) => {
    Alert.alert(
      "Delete trip?",
      `"${trip.purpose}" will be permanently removed. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteMileageTrip.mutate(trip.id, {
              onSuccess: (ok) => {
                if (ok) {
                  if (editingId === trip.id) closeForm();
                } else {
                  Alert.alert("Could not delete", "Only pending trips can be deleted.");
                }
              },
            });
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: rn(color.bgMobile) }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: 96 + insets.bottom }}>
        {/* New trips are always logged with distance in workspaceUnit, at this
            person's own rate (in whichever currency Setup's user currency &
            mileage table has them in — see estimateMinor, saveTrip,
            runCalculateDistance above); the saved amount then gets converted
            to the workspace's own currency, which is what Team/payroll rely
            on. Already-logged trips below display in the personal unit/
            currency preference instead, editable only from the web app's
            Profile page. */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>Mileage</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.darkCard}>
            <Text style={styles.darkCardLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              Reimbursement this month
            </Text>
            <Text style={styles.darkCardValue}>{formatMoney(monthReimbMinor, currency)}</Text>
            <Text style={styles.darkCardSub} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {formatDistance(monthDistanceInUnit, unit)} logged
            </Text>
          </View>
          {/* Read-only here. This is MY effective rate — either a per-user
              override an owner/admin set for me, or the workspace default
              from Settings if they haven't. */}
          <View style={styles.rateCard}>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              Rate
            </Text>
            {/* Not formatMoney: that rounds to two decimals and would show a
                0.675 rate as 0.68, understating what a long trip is worth. */}
            <Text style={styles.statValue}>
              {currencySymbol(myRate.currency)}
              {rateToDecimalString(myRate.rateMilli)}
            </Text>
            <Text style={styles.statCaption} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              per {unit}
            </Text>
          </View>
        </View>

        <View style={styles.tripsHeaderRow}>
          <Text style={styles.tripsHeaderTitle}>Recent trips</Text>
          {isHome !== false && (
            <Pressable
              style={styles.addTripButton}
              onPress={() => (addTripOpen ? closeForm() : setAddTripOpen(true))}
            >
              <Text style={styles.addTripLabel}>{addTripOpen ? "Close" : "+ Add trip"}</Text>
            </Pressable>
          )}
        </View>

        {isHome === false && (
          <Text style={styles.emptyText}>
            You can only log trips into the workspace you were originally added to. Switch back to it from the web
            app to add a new one.
          </Text>
        )}

        {addTripOpen && (
          <View style={styles.addTripCard}>
            <Text style={styles.formTitle}>{editingId ? "Edit trip" : "New trip"}</Text>
            <TextInput
              value={newPurpose}
              onChangeText={setNewPurpose}
              placeholder="Trip purpose…"
              placeholderTextColor={rn(color.textFaint)}
              style={styles.addTripInput}
            />
            <TextInput
              value={newDate}
              onChangeText={setNewDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={rn(color.textFaint)}
              style={styles.addTripInput}
            />

            {/* Editing an existing trip is always Manual — see startEdit. */}
            {!editingId && (
              <View style={styles.segmented}>
                {(["automatic", "manual"] as const).map((m) => {
                  const on = m === entryMode;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setEntryMode(m)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[styles.segment, on && styles.segmentOn]}
                    >
                      <Text style={[styles.segmentLabel, on && styles.segmentLabelOn]}>
                        {m === "automatic" ? "Automatic" : "Manual"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {entryMode === "automatic" && !editingId ? (
              <>
                <TextInput
                  value={newStartAddress}
                  onChangeText={setNewStartAddress}
                  placeholder="Start address…"
                  placeholderTextColor={rn(color.textFaint)}
                  style={styles.addTripInput}
                />
                <TextInput
                  value={newEndAddress}
                  onChangeText={setNewEndAddress}
                  placeholder="End address…"
                  placeholderTextColor={rn(color.textFaint)}
                  style={styles.addTripInput}
                />
                <Pressable
                  style={[styles.calculateButton, calculating && { opacity: 0.6 }]}
                  disabled={calculating || !newStartAddress.trim() || !newEndAddress.trim()}
                  onPress={runCalculateDistance}
                >
                  {calculating ? (
                    <ActivityIndicator color={rn(color.brand)} size="small" />
                  ) : (
                    <Text style={styles.calculateButtonLabel}>Calculate distance</Text>
                  )}
                </Pressable>
                {calcError && <Text style={styles.calcErrorText}>{calcError}</Text>}
                {calculated && (
                  <Text style={styles.calcResultText}>
                    {formatDistance(calculated.distance, calculated.unit)} · {calculated.originAddress} →{" "}
                    {calculated.destinationAddress}
                  </Text>
                )}
              </>
            ) : (
              <TextInput
                value={newDistance}
                onChangeText={setNewDistance}
                placeholder={`Distance (${workspaceUnit})`}
                placeholderTextColor={rn(color.textFaint)}
                keyboardType="decimal-pad"
                style={styles.addTripInput}
              />
            )}

            {estimateMinor !== null && (
              <Text style={styles.estimateText}>Estimated reimbursement: {formatMoney(estimateMinor, myRate.currency)}</Text>
            )}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
              <Pressable style={styles.cancelButton} onPress={closeForm}>
                <Text style={styles.cancelButtonLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveTripButton, isNaN(distanceValue) && { opacity: 0.5 }]}
                disabled={isNaN(distanceValue) || distanceValue <= 0}
                onPress={saveTrip}
              >
                <Text style={styles.saveButtonLabel}>
                  {editingId ? "Save changes" : "Save trip"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {trips.length === 0 ? (
          <Text style={styles.emptyText}>No trips logged yet.</Text>
        ) : visibleTrips.length === 0 ? (
          <Text style={styles.emptyText}>Nothing needs attention — older reimbursed trips are on the web app.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {visibleTrips.map((t) => {
              const editable = t.reimbursementStatus === "pending";
              return (
                <SwipeToDelete key={t.id} enabled={editable} onDelete={() => confirmDelete(t)}>
                  <TripRow
                    trip={t}
                    currency={currency}
                    displayUnit={unit}
                    onPress={editable ? () => startEdit(t) : () => setViewingTrip(t)}
                  />
                </SwipeToDelete>
              );
            })}
          </View>
        )}
      </ScrollView>

      <TripDetailModal
        trip={viewingTrip}
        currency={currency}
        workspaceCurrency={workspaceCurrency}
        displayUnit={unit}
        onClose={() => setViewingTrip(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontSize: 21,
    fontWeight: "800",
    color: rn(color.text),
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  darkCard: {
    flex: 1.4,
    backgroundColor: rn(color.inkPanel),
    borderRadius: 18,
    padding: 16,
  },
  darkCardLabel: {
    fontSize: 12,
    color: rn(color.inkPanelText),
    fontWeight: "600",
  },
  darkCardValue: {
    fontSize: 26,
    fontWeight: "800",
    marginTop: 8,
    color: "#fff",
  },
  darkCardSub: {
    fontSize: 12,
    color: rn(color.brand),
    fontWeight: "700",
    marginTop: 6,
  },
  rateCard: {
    flex: 1,
    backgroundColor: rn(color.surface),
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 11,
    color: rn(color.textMuted),
    fontWeight: "600",
  },
  statValue: {
    fontSize: 17,
    fontWeight: "800",
    marginTop: 5,
    color: rn(color.text),
  },
  statCaption: {
    fontSize: 10.5,
    color: rn(color.textFaint),
    marginTop: 2,
  },
  editorCard: {
    backgroundColor: rn(color.surface),
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  editorTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    color: rn(color.text),
  },
  editorRow: {
    flexDirection: "row",
    gap: 8,
  },
  editorInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: rn(color.borderStrong),
    fontSize: 13,
    color: rn(color.text),
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: rn(color.brand),
    justifyContent: "center",
  },
  saveButtonLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  editorHint: {
    fontSize: 11,
    color: rn(color.textMuted),
    marginTop: 8,
    lineHeight: 16,
  },
  formTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: rn(color.text),
    marginBottom: 2,
  },
  tripsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  tripsHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: rn(color.text),
  },
  addTripButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: rn(color.brand),
  },
  addTripLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  addTripCard: {
    backgroundColor: rn(color.surface),
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  addTripInput: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: rn(color.borderStrong),
    fontSize: 13,
    color: rn(color.text),
  },
  estimateText: {
    fontSize: 11.5,
    color: rn(color.textMuted),
    marginTop: -2,
  },
  segmented: {
    flexDirection: "row",
    alignSelf: "flex-start",
    backgroundColor: rn(color.avatarBg),
    borderRadius: 20,
    padding: 3,
  },
  segment: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  segmentOn: {
    backgroundColor: rn(color.brand),
  },
  segmentLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: rn(color.textMuted),
  },
  segmentLabelOn: {
    color: "#fff",
  },
  calculateButton: {
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: rn(color.surfaceMuted),
  },
  calculateButtonLabel: {
    color: rn(color.brand),
    fontWeight: "700",
    fontSize: 13,
  },
  calcErrorText: {
    fontSize: 11.5,
    color: rn(reimbursementChip.rejected.text),
    lineHeight: 16,
  },
  calcResultText: {
    fontSize: 11.5,
    color: rn(color.textMuted),
    lineHeight: 16,
  },
  cancelButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: rn(color.surfaceMuted),
  },
  cancelButtonLabel: {
    color: rn(color.textMuted),
    fontWeight: "700",
    fontSize: 13,
  },
  saveTripButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: rn(color.brand),
  },
  emptyText: {
    fontSize: 13,
    color: rn(color.textMuted),
    textAlign: "center",
    paddingVertical: 24,
  },
});
