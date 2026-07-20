import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color } from "@rr/ui-tokens";
import {
  formatMoney,
  formatShortDate,
  currencySymbol,
  rateToDecimalString,
  type DistanceUnit,
  type MileageTrip,
} from "@rr/shared";
import { rn } from "../../lib/colors";
import { convertDistance, formatDistance } from "../../lib/units";
import {
  CURRENT_MONTH,
  TODAY,
  addMileageTrip,
  updateMileageTrip,
  deleteMileageTrip,
  listMileage,
  getHomeCurrency,
  getDistanceUnit,
  getMileageRateMilli,
  estimateMileageAmountMinor,
} from "../../lib/data";
import { useFocusEffect } from "expo-router";
import { Text } from "../../components/Text";
import { TripRow } from "../../components/TripRow";
import { SwipeToDelete } from "../../components/SwipeToDelete";

export default function MileageScreen() {
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<MileageTrip[]>([]);
  // Currency and distance unit are workspace settings, changed from the gear on
  // the Home screen. Re-read on focus so returning here picks up a change.
  const [currency, setCurrency] = useState(getHomeCurrency());
  const [unit, setUnit] = useState<DistanceUnit>(getDistanceUnit());

  const [rateMilli, setRateMilliState] = useState(getMileageRateMilli());

  const [addTripOpen, setAddTripOpen] = useState(false);
  /** Non-null when the form is editing an existing trip rather than adding one. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPurpose, setNewPurpose] = useState("");
  const [newDate, setNewDate] = useState(TODAY);
  const [newDistance, setNewDistance] = useState("");

  useFocusEffect(
    useCallback(() => {
      setCurrency(getHomeCurrency());
      setUnit(getDistanceUnit());
      setRateMilliState(getMileageRateMilli());
      const timer = setTimeout(() => {
        setTrips(listMileage());
        setLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }, []),
  );

  // The rate is stored per the workspace's own distance unit, so no conversion.

  const monthTrips = useMemo(() => trips.filter((t) => t.tripDate.startsWith(CURRENT_MONTH)), [trips]);
  const monthReimbMinor = monthTrips.reduce((sum, t) => sum + t.amountMinor, 0);
  const monthDistanceInUnit = monthTrips.reduce(
    (sum, t) => sum + convertDistance(t.distance, t.distanceUnit, unit),
    0,
  );

  const distanceValue = parseFloat(newDistance.replace(",", "."));
  // Asks the API what this would be worth, rather than computing it here from a
  // cached rate. The screen's copy of the rate can go stale; the API's cannot
  // disagree with itself, so the estimate always matches what gets saved.
  const estimateMinor =
    !isNaN(distanceValue) && distanceValue > 0
      ? estimateMileageAmountMinor(distanceValue, unit)
      : null;

  const closeForm = () => {
    setAddTripOpen(false);
    setEditingId(null);
    setNewPurpose("");
    setNewDistance("");
    setNewDate(TODAY);
  };

  /** Tapping a pending trip loads it into the same form used to add one. */
  const startEdit = (trip: MileageTrip) => {
    setEditingId(trip.id);
    setNewPurpose(trip.purpose);
    setNewDate(trip.tripDate);
    setNewDistance(String(trip.distance));
    setAddTripOpen(true);
  };

  const saveTrip = () => {
    if (!newPurpose.trim() || isNaN(distanceValue) || distanceValue <= 0) return;

    if (editingId) {
      const updated = updateMileageTrip(editingId, {
        tripDate: newDate,
        purpose: newPurpose.trim(),
        distance: distanceValue,
      });
      if (updated) {
        setTrips((prev) => prev.map((t) => (t.id === editingId ? { ...updated } : t)));
      } else {
        Alert.alert("Could not save", "Only pending trips can be edited.");
      }
    } else {
      const trip = addMileageTrip({
        tripDate: newDate,
        purpose: newPurpose.trim(),
        distance: distanceValue,
        distanceUnit: unit,
      });
      setTrips((prev) => [trip, ...prev]);
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
            if (deleteMileageTrip(trip.id)) {
              setTrips((prev) => prev.filter((t) => t.id !== trip.id));
              if (editingId === trip.id) closeForm();
            } else {
              Alert.alert("Could not delete", "Only pending trips can be deleted.");
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: rn(color.bgMobile) }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: 96 + insets.bottom }}>
        {/* The mi/km toggle lives in Settings (gear on Home) — it is a workspace
            setting the Team page also reads, not a per-screen display preference. */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>Mileage</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.darkCard}>
            <Text style={styles.darkCardLabel}>Reimbursement this month</Text>
            <Text style={styles.darkCardValue}>{formatMoney(monthReimbMinor, currency)}</Text>
            <Text style={styles.darkCardSub}>{formatDistance(monthDistanceInUnit, unit)} logged</Text>
          </View>
          {/* Read-only. The rate is a workspace setting, edited in Settings. */}
          <View style={styles.rateCard}>
            <Text style={styles.statLabel}>Rate</Text>
            {/* Not formatMoney: that rounds to two decimals and would show a
                0.675 rate as 0.68, understating what a long trip is worth. */}
            <Text style={styles.statValue}>
              {currencySymbol(currency)}
              {rateToDecimalString(rateMilli)}
            </Text>
            <Text style={styles.statCaption}>per {unit}</Text>
          </View>
        </View>

        <View style={styles.tripsHeaderRow}>
          <Text style={styles.tripsHeaderTitle}>Recent trips</Text>
          <Pressable
            style={styles.addTripButton}
            onPress={() => (addTripOpen ? closeForm() : setAddTripOpen(true))}
          >
            <Text style={styles.addTripLabel}>{addTripOpen ? "Close" : "+ Add trip"}</Text>
          </Pressable>
        </View>

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
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput
                value={newDate}
                onChangeText={setNewDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={rn(color.textFaint)}
                style={[styles.addTripInput, { flex: 1 }]}
              />
              <TextInput
                value={newDistance}
                onChangeText={setNewDistance}
                placeholder={`Distance (${unit})`}
                placeholderTextColor={rn(color.textFaint)}
                keyboardType="decimal-pad"
                style={[styles.addTripInput, { flex: 1 }]}
              />
            </View>
            {estimateMinor !== null && (
              <Text style={styles.estimateText}>Estimated reimbursement: {formatMoney(estimateMinor, currency)}</Text>
            )}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
              <Pressable style={styles.cancelButton} onPress={closeForm}>
                <Text style={styles.cancelButtonLabel}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveTripButton} onPress={saveTrip}>
                <Text style={styles.saveButtonLabel}>
                  {editingId ? "Save changes" : "Save trip"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={rn(color.brand)} />
          </View>
        ) : trips.length === 0 ? (
          <Text style={styles.emptyText}>No trips logged yet.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {trips.map((t) => {
              const editable = t.reimbursementStatus === "pending";
              return (
                <SwipeToDelete key={t.id} enabled={editable} onDelete={() => confirmDelete(t)}>
                  <TripRow
                    trip={t}
                    currency={currency}
                    displayUnit={unit}
                    {...(editable ? { onPress: () => startEdit(t) } : {})}
                  />
                </SwipeToDelete>
              );
            })}
          </View>
        )}
      </ScrollView>
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
