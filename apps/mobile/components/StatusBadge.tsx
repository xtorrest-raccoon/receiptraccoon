import { StyleSheet, View } from "react-native";
import { reimbursementChip } from "@rr/ui-tokens";
import type { ReimbursementStatus } from "@rr/shared";
import { rn } from "../lib/colors";
import { Text } from "./Text";

export function StatusBadge({ status }: { status: ReimbursementStatus }) {
  const meta = reimbursementChip[status];
  return (
    <View style={[styles.badge, { backgroundColor: rn(meta.bg) }]}>
      <Text style={[styles.label, { color: rn(meta.text) }]}>{meta.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
  },
});
