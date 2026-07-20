import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { color } from "@rr/ui-tokens";
import { categoryChipColor, formatMoney, formatShortDate, type MileageTrip, type DistanceUnit } from "@rr/shared";
import { rn } from "../lib/colors";
import { convertDistance, formatDistance } from "../lib/units";
import { StatusBadge } from "./StatusBadge";
import { Text } from "./Text";

// Mileage has no category of its own, so its icon tile borrows "Travel"'s hue from
// @rr/shared's category palette rather than inventing an untracked colour.
const MILEAGE_ICON_FG = rn(categoryChipColor("Travel", false));
const MILEAGE_ICON_BG = rn(categoryChipColor("Travel", true));

function CarGlyph() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 16 L5.5 10.5 C5.8 9.4 6.8 8.5 8 8.5 H16 C17.2 8.5 18.2 9.4 18.5 10.5 L20 16"
        stroke={MILEAGE_ICON_FG}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M3 16 H21 V18.5 H3 Z" stroke={MILEAGE_ICON_FG} strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M6 18.5 A1.5 1.5 0 1 0 6 21.5 A1.5 1.5 0 1 0 6 18.5" fill={MILEAGE_ICON_FG} />
      <Path d="M18 18.5 A1.5 1.5 0 1 0 18 21.5 A1.5 1.5 0 1 0 18 18.5" fill={MILEAGE_ICON_FG} />
    </Svg>
  );
}

export function TripRow({
  trip,
  currency,
  displayUnit,
  onPress,
}: {
  trip: MileageTrip;
  currency: string;
  displayUnit: DistanceUnit;
  /** Omitted for trips that cannot be edited, which leaves the row inert. */
  onPress?: () => void;
}) {
  const distance = convertDistance(trip.distance, trip.distanceUnit, displayUnit);
  const Container = onPress ? Pressable : View;
  return (
    <Container onPress={onPress} style={styles.row}>
      <View style={styles.iconBox}>
        <CarGlyph />
      </View>
      <View style={styles.mid}>
        <Text style={styles.purpose} numberOfLines={1}>
          {trip.purpose}
        </Text>
        <Text style={styles.meta}>
          {formatShortDate(trip.tripDate)} · {formatDistance(distance, displayUnit)}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>{formatMoney(trip.amountMinor, currency)}</Text>
        <StatusBadge status={trip.reimbursementStatus} />
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: rn(color.surface),
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: MILEAGE_ICON_BG,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  mid: {
    flex: 1,
    minWidth: 0,
  },
  purpose: {
    fontSize: 13.5,
    fontWeight: "700",
    color: rn(color.text),
  },
  meta: {
    fontSize: 11.5,
    color: rn(color.textMuted),
    marginTop: 1,
  },
  right: {
    alignItems: "flex-end",
    gap: 4,
    flexShrink: 0,
  },
  amount: {
    fontSize: 14,
    fontWeight: "800",
    color: rn(color.text),
  },
});
