import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, reimbursementChip } from "@rr/ui-tokens";
import {
  formatMoney,
  formatPaymentMethod,
  formatShortDate,
  minorToDecimalString,
  parseMoneyToMinor,
  type Receipt,
} from "@rr/shared";
import { rn, rnAlpha } from "../../lib/colors";
import { HOME_CURRENCY, getReceipt, patchReceiptLocal } from "../../lib/data";
import { Text } from "../../components/Text";
import { CategoryChip } from "../../components/CategoryChip";
import { StatusBadge } from "../../components/StatusBadge";

export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [receipt, setReceipt] = useState<Receipt | undefined>(undefined);
  const [comment, setComment] = useState("");
  const [totalText, setTotalText] = useState("");

  useEffect(() => {
    const r = getReceipt(id);
    setReceipt(r);
    setComment(r?.comment ?? "");
    setTotalText(r ? minorToDecimalString(r.totalMinor, r.currency) : "");
  }, [id]);

  const currency = receipt?.currency ?? HOME_CURRENCY;

  const lineItemsTotal = useMemo(() => receipt?.lineItems ?? [], [receipt]);

  if (!receipt) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
        <BackLink onPress={() => router.back()} />
        <Text style={styles.emptyText}>Receipt not found.</Text>
      </View>
    );
  }

  const commitComment = (value: string) => {
    setComment(value);
    patchReceiptLocal(receipt.id, { comment: value });
  };

  const commitTotal = (value: string) => {
    setTotalText(value);
    const minor = parseMoneyToMinor(value, currency);
    if (minor !== null) {
      patchReceiptLocal(receipt.id, { totalMinor: minor });
      setReceipt((prev) => (prev ? { ...prev, totalMinor: minor } : prev));
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: rn(color.bgMobile) }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 14 }]}
    >
      <BackLink onPress={() => router.back()} />

      <Text style={styles.vendor}>{receipt.vendor ?? "Unknown vendor"}</Text>
      <Text style={styles.subMeta}>
        {receipt.receiptDate ? formatShortDate(receipt.receiptDate) : "—"} ·{" "}
        {formatPaymentMethod(receipt.paymentBrand, receipt.paymentLast4) ?? "—"}
      </Text>

      <View style={styles.photoPlaceholder}>
        <Text style={styles.photoPlaceholderText}>[ receipt photo ]</Text>
      </View>

      <View style={styles.chipRow}>
        <CategoryChip category={receipt.categoryName ?? "Other"} />
        <StatusBadge status={receipt.reimbursementStatus} />
      </View>

      {receipt.reimbursementStatus === "rejected" && receipt.rejectionReason && (
        <View style={[styles.banner, { backgroundColor: rnAlpha(reimbursementChip.rejected.bg, 0.4) }]}>
          <Text style={[styles.bannerTitle, { color: rn(reimbursementChip.rejected.text) }]}>Reason for rejection</Text>
          <Text style={[styles.bannerBody, { color: rn(reimbursementChip.rejected.text) }]}>{receipt.rejectionReason}</Text>
        </View>
      )}

      {receipt.originalCurrency && (
        <View style={[styles.banner, { backgroundColor: rnAlpha(reimbursementChip.approved.bg, 0.4) }]}>
          <Text style={[styles.bannerTitle, { color: rn(reimbursementChip.approved.text) }]}>Currency conversion</Text>
          <Text style={[styles.bannerBody, { color: rn(reimbursementChip.approved.text) }]}>
            Originally {receipt.originalCurrency}{" "}
            {receipt.originalTotalMinor !== null
              ? formatMoney(receipt.originalTotalMinor, receipt.originalCurrency)
              : ""}
            {receipt.fxRate ? ` · converted at ${receipt.fxRate}` : ""}
            {receipt.fxRateDate ? ` on ${formatShortDate(receipt.fxRateDate)}` : ""}
          </Text>
        </View>
      )}

      <View style={{ marginBottom: 14 }}>
        <Text style={styles.sectionLabel}>Comment</Text>
        <TextInput
          value={comment}
          onChangeText={commitComment}
          placeholder="Add a comment — e.g. attendees, purpose…"
          placeholderTextColor={rn(color.textFaint)}
          multiline
          style={styles.commentInput}
        />
      </View>

      <Text style={styles.lineItemsTitle}>Line items</Text>
      <View style={styles.lineItemsCard}>
        {lineItemsTotal.length === 0 ? (
          <Text style={[styles.emptyText, { paddingVertical: 12 }]}>No line items captured.</Text>
        ) : (
          lineItemsTotal.map((li, index) => (
            <View
              key={li.id}
              style={[
                styles.lineItemRow,
                index < lineItemsTotal.length - 1 && { borderBottomWidth: 1, borderBottomColor: rn(color.borderSubtle) },
              ]}
            >
              <Text style={styles.lineItemDesc}>{li.description}</Text>
              <Text style={styles.lineItemAmount}>{formatMoney(li.amountMinor, currency)}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.totalsCard}>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Subtotal</Text>
          <Text style={styles.totalsValue}>
            {receipt.subtotalMinor !== null ? formatMoney(receipt.subtotalMinor, currency) : "—"}
          </Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsLabel}>Tax</Text>
          <Text style={styles.totalsValue}>
            {receipt.taxMinor !== null ? formatMoney(receipt.taxMinor, currency) : "—"}
          </Text>
        </View>
        <View style={[styles.totalsRow, styles.totalsFinalRow]}>
          <Text style={styles.totalFinalLabel}>Total</Text>
          <TextInput
            value={totalText}
            onChangeText={commitTotal}
            keyboardType="decimal-pad"
            style={styles.totalInput}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function BackLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ marginBottom: 12 }}>
      <Text style={styles.backLink}>‹ Receipts</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  backLink: {
    fontSize: 13.5,
    fontWeight: "700",
    color: rn(color.brand),
  },
  vendor: {
    fontSize: 19,
    fontWeight: "800",
    color: rn(color.text),
  },
  subMeta: {
    fontSize: 12.5,
    color: rn(color.textMuted),
    marginTop: 2,
    marginBottom: 14,
  },
  photoPlaceholder: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: rn(color.borderStrong),
    backgroundColor: rn(color.surfaceMuted),
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: {
    color: rn(color.textFaint),
    fontSize: 12,
    fontFamily: "monospace",
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 14,
  },
  banner: {
    borderRadius: 12,
    padding: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
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
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: rn(color.textMuted),
    marginBottom: 4,
  },
  commentInput: {
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: rn(color.borderStrong),
    fontSize: 13,
    backgroundColor: rn(color.surface),
    color: rn(color.text),
    textAlignVertical: "top",
  },
  lineItemsTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    color: rn(color.text),
  },
  lineItemsCard: {
    backgroundColor: rn(color.surface),
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 14,
  },
  lineItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  lineItemDesc: {
    fontSize: 12.5,
    color: rn(color.text),
    flex: 1,
    marginRight: 8,
  },
  lineItemAmount: {
    fontSize: 12.5,
    fontWeight: "700",
    color: rn(color.text),
  },
  totalsCard: {
    backgroundColor: rn(color.surface),
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalsLabel: {
    fontSize: 13,
    color: rn(color.textMuted),
  },
  totalsValue: {
    fontSize: 13,
    color: rn(color.textMuted),
  },
  totalsFinalRow: {
    alignItems: "center",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: rn(color.border),
  },
  totalFinalLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: rn(color.text),
  },
  totalInput: {
    width: 90,
    textAlign: "right",
    fontSize: 15,
    fontWeight: "800",
    borderWidth: 1,
    borderColor: rn(color.borderStrong),
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    color: rn(color.text),
  },
  emptyText: {
    fontSize: 13,
    color: rn(color.textMuted),
    textAlign: "center",
  },
});
