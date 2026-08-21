import { Linking, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { color } from "@rr/ui-tokens";
import { currencySymbol, rateToDecimalString, type DistanceUnit } from "@rr/shared";
import { rn, rnAlpha } from "../lib/colors";
import { Text } from "./Text";

// The web app's own deployed URL -- not derived from getApiBaseUrl() (that
// one points at whatever dev server Metro is running against, wrong for
// these two links even in production builds). Same URL App Store Connect/
// Google Play get for the required Privacy Policy link.
const WEB_APP_URL = "https://receiptraccoon-web.vercel.app";

/**
 * Settings bottom sheet, reached from the gear in the Home header.
 *
 * Read-only: workspace, distance unit, reimbursement rate, and home currency
 * are workspace-wide settings now edited only from the web app's Setup page
 * (a phone editing a rate that applies to the whole team was the risk we were
 * trying to remove). Sign out sits outside the scrollable area so it's always
 * reachable without depending on a scroll gesture landing correctly.
 */
export function SettingsSheet({
  visible,
  workspaceName,
  distanceUnit,
  rateMilli,
  rateCurrency,
  rateUnit,
  homeCurrency,
  onClose,
  onSignOut,
}: {
  visible: boolean;
  workspaceName: string | undefined;
  distanceUnit: DistanceUnit | undefined;
  rateMilli: number | undefined;
  /**
   * Whichever currency rateMilli is actually denominated in right now — the
   * caller's own effective currency from Setup's user currency & mileage
   * table if they have a rate override, else the workspace's own (see
   * getMyMileageRate). Kept separate from homeCurrency below: the two can
   * genuinely differ, and mislabeling a rate with the wrong currency symbol
   * reads as ~10x too big or small, not just "not yet converted".
   */
  rateCurrency: string | undefined;
  /** Same reasoning as rateCurrency, but for the unit rateMilli is per — can differ from distanceUnit below. */
  rateUnit: DistanceUnit | undefined;
  homeCurrency: string | undefined;
  onClose: () => void;
  onSignOut: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.hint}>Workspace settings are managed from the web app by the admin.</Text>

          <ScrollView style={{ maxHeight: 320 }}>
            {workspaceName ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Workspace</Text>
                <Text style={styles.rowValue}>{workspaceName}</Text>
              </View>
            ) : null}
            {distanceUnit ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Distance unit</Text>
                <Text style={styles.rowValue}>{distanceUnit}</Text>
              </View>
            ) : null}
            {rateMilli !== undefined && rateUnit ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Rate per {rateUnit}</Text>
                <Text style={styles.rowValue}>
                  {currencySymbol(rateCurrency ?? homeCurrency ?? "EUR")}
                  {rateToDecimalString(rateMilli)}
                </Text>
              </View>
            ) : null}
            {homeCurrency ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>User Currency</Text>
                <Text style={styles.rowValue}>{homeCurrency}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.linkRow}>
            <Pressable onPress={() => Linking.openURL(`${WEB_APP_URL}/privacy`)}>
              <Text style={styles.linkLabel}>Privacy</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(`${WEB_APP_URL}/support`)}>
              <Text style={styles.linkLabel}>Support</Text>
            </Pressable>
          </View>

          <Pressable style={styles.signOutRow} onPress={onSignOut}>
            <Text style={styles.signOutLabel}>Sign out</Text>
          </Pressable>

          <Pressable style={styles.close} onPress={onClose}>
            <Text style={styles.closeLabel}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: rnAlpha(color.text, 0.35),
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: rn(color.surface),
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
    color: rn(color.text),
  },
  hint: {
    fontSize: 11.5,
    color: rn(color.textFaint),
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: rn(color.avatarBg),
    marginBottom: 8,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: rn(color.textMuted),
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "700",
    color: rn(color.text),
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 14,
  },
  linkLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: rn(color.textMuted),
    textDecorationLine: "underline",
  },
  signOutRow: {
    marginTop: 8,
    paddingVertical: 13,
    alignItems: "center",
  },
  signOutLabel: {
    fontSize: 13.5,
    fontWeight: "700",
    color: rn(color.up),
  },
  close: {
    marginTop: 4,
    paddingVertical: 13,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: rn(color.avatarBg),
  },
  closeLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: rn(color.textMuted),
  },
});
