import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { color } from "@rr/ui-tokens";
import { formatMoney, formatShortDate, initials, type Receipt } from "@rr/shared";
import { rn } from "../lib/colors";
import { StatusBadge } from "./StatusBadge";
import { Text } from "./Text";

export function ReceiptRow({ receipt, currency, onPress }: { receipt: Receipt; currency: string; onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(receipt.vendor ?? "?")}</Text>
      </View>
      <View style={styles.mid}>
        <Text style={styles.vendor} numberOfLines={1}>
          {receipt.vendor ?? t("receiptDetail.unknownVendor")}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {receipt.receiptDate ? formatShortDate(receipt.receiptDate) : "—"} · {receipt.categoryName ?? "Other"}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.amount}>{formatMoney(receipt.totalMinor, currency)}</Text>
        <StatusBadge status={receipt.reimbursementStatus} />
      </View>
    </Pressable>
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
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: rn(color.avatarBg),
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "800",
    color: rn(color.avatarText),
  },
  mid: {
    flex: 1,
    minWidth: 0,
  },
  vendor: {
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
