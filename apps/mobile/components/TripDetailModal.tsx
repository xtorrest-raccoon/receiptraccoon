import { Modal, Pressable, StyleSheet, View } from "react-native";
import { color, reimbursementChip } from "@rr/ui-tokens";
import { formatMoney, formatShortDate, rateToDecimalString, currencySymbol, type MileageTrip, type DistanceUnit } from "@rr/shared";
import { rn, rnAlpha } from "../lib/colors";
import { convertDistance, formatDistance } from "../lib/units";
import { Text } from "./Text";
import { StatusBadge } from "./StatusBadge";

/**
 * Read-only view for a trip that can no longer be edited (approved, reimbursed,
 * or rejected) — see mileage.tsx's onPress split. Pending trips never reach
 * this; tapping one opens the editable form instead.
 */
export function TripDetailModal({
  trip,
  currency,
  displayUnit,
  onClose,
}: {
  trip: MileageTrip | null;
  currency: string;
  displayUnit: DistanceUnit;
  onClose: () => void;
}) {
  return (
    <Modal visible={trip !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {trip && (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.purpose} numberOfLines={2}>
                  {trip.purpose}
                </Text>
                <StatusBadge status={trip.reimbursementStatus} />
              </View>
              <Text style={styles.date}>{formatShortDate(trip.tripDate)}</Text>

              {trip.reimbursementStatus === "rejected" && trip.rejectionReason && (
                <View style={[styles.banner, { backgroundColor: rnAlpha(reimbursementChip.rejected.bg, 0.4) }]}>
                  <Text style={[styles.bannerTitle, { color: rn(reimbursementChip.rejected.text) }]}>
                    Reason for rejection
                  </Text>
                  <Text style={[styles.bannerBody, { color: rn(reimbursementChip.rejected.text) }]}>
                    {trip.rejectionReason}
                  </Text>
                </View>
              )}

              {trip.startAddress && trip.endAddress && (
                <View style={styles.addressRow}>
                  <Text style={styles.addressText} numberOfLines={2}>
                    {trip.startAddress} → {trip.endAddress}
                  </Text>
                </View>
              )}

              <View style={styles.detailsCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Distance</Text>
                  <Text style={styles.detailValue}>
                    {formatDistance(convertDistance(trip.distance, trip.distanceUnit, displayUnit), displayUnit)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Rate</Text>
                  <Text style={styles.detailValue}>
                    {currencySymbol(currency)}
                    {rateToDecimalString(trip.rateMilli)} per {trip.rateUnit}
                  </Text>
                </View>
                <View style={[styles.detailRow, styles.detailFinalRow]}>
                  <Text style={styles.detailFinalLabel}>
                    {trip.reimbursementStatus === "reimbursed" ? "Reimbursed" : "Reimbursement"}
                  </Text>
                  <Text style={styles.detailFinalValue}>{formatMoney(trip.amountMinor, currency)}</Text>
                </View>
              </View>

              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonLabel}>Close</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  sheet: {
    backgroundColor: rn(color.bgMobile),
    borderRadius: 18,
    padding: 18,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  purpose: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: rn(color.text),
  },
  date: {
    fontSize: 12.5,
    color: rn(color.textMuted),
    marginTop: 2,
    marginBottom: 14,
  },
  banner: {
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  bannerTitle: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  bannerBody: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  addressRow: {
    marginBottom: 12,
  },
  addressText: {
    fontSize: 12.5,
    color: rn(color.textMuted),
    lineHeight: 18,
  },
  detailsCard: {
    backgroundColor: rn(color.surface),
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontSize: 13,
    color: rn(color.textMuted),
  },
  detailValue: {
    fontSize: 13,
    color: rn(color.textMuted),
  },
  detailFinalRow: {
    alignItems: "center",
    paddingTop: 6,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: rn(color.border),
  },
  detailFinalLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: rn(color.text),
  },
  detailFinalValue: {
    fontSize: 15,
    fontWeight: "800",
    color: rn(color.text),
  },
  closeButton: {
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: rn(color.surfaceMuted),
    marginTop: 16,
  },
  closeButtonLabel: {
    color: rn(color.textMuted),
    fontWeight: "700",
    fontSize: 13,
  },
});
