import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { reimbursementChip } from "@rr/ui-tokens";
import type { ReimbursementStatus } from "@rr/shared";
import { rn } from "../lib/colors";
import { Text } from "./Text";

// reimbursementChip.label comes from @rr/shared, shared with the (English-only)
// web app -- this looks up the translated label itself instead, only using
// reimbursementChip for its colour tokens.
export function StatusBadge({ status }: { status: ReimbursementStatus }) {
  const { t } = useTranslation();
  const meta = reimbursementChip[status];
  return (
    <View style={[styles.badge, { backgroundColor: rn(meta.bg) }]}>
      <Text style={[styles.label, { color: rn(meta.text) }]}>{t(`statusBadge.${status}`)}</Text>
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
