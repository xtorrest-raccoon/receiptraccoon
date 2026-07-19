import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color } from "@rr/ui-tokens";
import { formatMoney, formatShortDate, minorToDecimalString, parseMoneyToMinor, type DistanceUnit, type MileageTrip } from "@rr/shared";
import { rn } from "../../lib/colors";
import { convertDistance, convertRateMinor, formatDistance } from "../../lib/units";
import { HOME_CURRENCY, CURRENT_MONTH, TODAY, addMileageTrip, listMileage } from "../../lib/data";
import { Text } from "../../components/Text";
import { TripRow } from "../../components/TripRow";

export default function MileageScreen() {
  const insets = useSafeAreaInsets();
  const currency = HOME_CURRENCY;

  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState<MileageTrip[]>([]);
  const [unit, setUnit] = useState<DistanceUnit>("mi");

  const [rateEditorOpen, setRateEditorOpen] = useState(false);
  const [rateEditorValue, setRateEditorValue] = useState("");
  const [customRateMinor, setCustomRateMinor] = useState<number | null>(null);

  const [addTripOpen, setAddTripOpen] = useState(false);
  const [newPurpose, setNewPurpose] = useState("");
  const [newDate, setNewDate] = useState(TODAY);
  const [newDistance, setNewDistance] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setTrips(listMileage());
      setLoading(false);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // The rate is frozen per-trip in the mock data (rateMinor, always quoted per
  // mile). Reset any local preview override when the display unit changes so it
  // never shows a rate that was typed for the other unit.
  useEffect(() => {
    setCustomRateMinor(null);
    setRateEditorOpen(false);
  }, [unit]);

  const baseRatePerMileMinor = trips[0]?.rateMinor ?? 0;
  const effectiveRateMinor = customRateMinor ?? convertRateMinor(baseRatePerMileMinor, "mi", unit);

  const monthTrips = useMemo(() => trips.filter((t) => t.tripDate.startsWith(CURRENT_MONTH)), [trips]);
  const monthReimbMinor = monthTrips.reduce((sum, t) => sum + t.amountMinor, 0);
  const monthDistanceInUnit = monthTrips.reduce(
    (sum, t) => sum + convertDistance(t.distance, t.distanceUnit, unit),
    0,
  );

  const openRateEditor = () => {
    setRateEditorValue(minorToDecimalString(effectiveRateMinor, currency));
    setRateEditorOpen(true);
  };

  const saveRate = () => {
    const minor = parseMoneyToMinor(rateEditorValue, currency);
    if (minor !== null && minor > 0) {
      setCustomRateMinor(minor);
    }
    setRateEditorOpen(false);
  };

  const distanceValue = parseFloat(newDistance);
  const estimateMinor =
    !isNaN(distanceValue) && distanceValue > 0 ? Math.round(distanceValue * effectiveRateMinor) : null;

  const saveTrip = () => {
    if (!newPurpose.trim() || isNaN(distanceValue) || distanceValue <= 0) return;
    const trip = addMileageTrip({
      tripDate: newDate,
      purpose: newPurpose.trim(),
      distance: distanceValue,
      distanceUnit: unit,
    });
    setTrips((prev) => [trip, ...prev]);
    setAddTripOpen(false);
    setNewPurpose("");
    setNewDistance("");
  };

  return (
    <View style={{ flex: 1, backgroundColor: rn(color.bgMobile) }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: 96 }}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Mileage</Text>
          <View style={styles.unitToggle}>
            {(["mi", "km"] as DistanceUnit[]).map((u) => (
              <Pressable
                key={u}
                onPress={() => setUnit(u)}
                style={[styles.unitOption, unit === u && { backgroundColor: rn(color.brand) }]}
              >
                <Text style={[styles.unitOptionLabel, { color: unit === u ? "#fff" : rn(color.textFaint) }]}>{u}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.darkCard}>
            <Text style={styles.darkCardLabel}>Reimbursement this month</Text>
            <Text style={styles.darkCardValue}>{formatMoney(monthReimbMinor, currency)}</Text>
            <Text style={styles.darkCardSub}>{formatDistance(monthDistanceInUnit, unit)} logged</Text>
          </View>
          <Pressable style={styles.rateCard} onPress={openRateEditor}>
            <Text style={styles.statLabel}>Rate ✎</Text>
            <Text style={styles.statValue}>{formatMoney(effectiveRateMinor, currency)}</Text>
            <Text style={styles.statCaption}>per {unit}</Text>
          </Pressable>
        </View>

        {rateEditorOpen && (
          <View style={styles.editorCard}>
            <Text style={styles.editorTitle}>Reimbursement rate per {unit} ({currency})</Text>
            <View style={styles.editorRow}>
              <TextInput
                value={rateEditorValue}
                onChangeText={setRateEditorValue}
                placeholder="0.70"
                keyboardType="decimal-pad"
                style={styles.editorInput}
              />
              <Pressable style={styles.saveButton} onPress={saveRate}>
                <Text style={styles.saveButtonLabel}>Save</Text>
              </Pressable>
            </View>
            <Text style={styles.editorHint}>
              Preview only — used to estimate new trips below. Saved trips keep the rate on record at the
              time they were logged.
            </Text>
          </View>
        )}

        <View style={styles.tripsHeaderRow}>
          <Text style={styles.tripsHeaderTitle}>Recent trips</Text>
          <Pressable style={styles.addTripButton} onPress={() => setAddTripOpen((v) => !v)}>
            <Text style={styles.addTripLabel}>+ Add trip</Text>
          </Pressable>
        </View>

        {addTripOpen && (
          <View style={styles.addTripCard}>
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
              <Pressable style={styles.cancelButton} onPress={() => setAddTripOpen(false)}>
                <Text style={styles.cancelButtonLabel}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveTripButton} onPress={saveTrip}>
                <Text style={styles.saveButtonLabel}>Save trip</Text>
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
            {trips.map((t) => (
              <TripRow key={t.id} trip={t} currency={currency} displayUnit={unit} />
            ))}
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
  unitToggle: {
    flexDirection: "row",
    backgroundColor: rn(color.surfaceMuted),
    borderRadius: 20,
    padding: 3,
  },
  unitOption: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  unitOptionLabel: {
    fontSize: 11.5,
    fontWeight: "700",
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
