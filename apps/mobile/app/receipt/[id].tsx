import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, reimbursementChip } from "@rr/ui-tokens";
import {
  formatMoney,
  formatPaymentMethod,
  formatShortDate,
  minorToDecimalString,
  parseMoneyToMinor,
  currencySymbol,
  canEditReceiptAmount,
  canEditReceiptComment,
  canEditReceiptCategory,
  reclaimMinor,
} from "@rr/shared";
import { rn, rnAlpha } from "../../lib/colors";
import {
  useCategories,
  useReceipt,
  useReceiptPhotoUrl,
  useSetReceiptCategory,
  useSetReceiptComment,
  useSetReceiptReclaim,
} from "../../lib/queries";
import { Text } from "../../components/Text";
import { TextInput } from "../../components/TextInput";
import { CategoryChip } from "../../components/CategoryChip";
import { StatusBadge } from "../../components/StatusBadge";
import { PickerSheet } from "../../components/PickerSheet";

export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: receipt, isLoading } = useReceipt(id ?? null);
  const { data: categories } = useCategories();
  const { data: photoUrl } = useReceiptPhotoUrl(receipt?.imagePath ?? null);
  const setReceiptComment = useSetReceiptComment();
  const setReceiptCategory = useSetReceiptCategory();
  const setReceiptReclaim = useSetReceiptReclaim();

  const [comment, setComment] = useState("");
  const [reclaimText, setReclaimText] = useState("");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);

  useEffect(() => {
    setComment(receipt?.comment ?? "");
    setReclaimText(receipt ? minorToDecimalString(reclaimMinor(receipt), receipt.currency) : "");
  }, [receipt]);

  const lineItemsTotal = useMemo(() => receipt?.lineItems ?? [], [receipt]);

  if (isLoading || (receipt && !categories)) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 14, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={rn(color.brand)} />
      </View>
    );
  }

  if (!receipt) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
        <BackLink onPress={() => router.back()} />
        <Text style={styles.emptyText}>Receipt not found.</Text>
      </View>
    );
  }

  const currency = receipt.currency;
  const amountEditable = canEditReceiptAmount(receipt.reimbursementStatus);
  const commentEditable = canEditReceiptComment(receipt.reimbursementStatus);
  const categoryEditable = canEditReceiptCategory(receipt.reimbursementStatus);
  const typedReclaim = parseMoneyToMinor(reclaimText, currency);
  const reclaimExceedsTotal = typedReclaim !== null && typedReclaim > receipt.totalMinor;

  const commitComment = (value: string) => {
    setComment(value);
    setReceiptComment.mutate({ id: receipt.id, comment: value });
  };

  const commitCategory = (value: string) => {
    setReceiptCategory.mutate({ id: receipt.id, categoryName: value });
  };

  const commitReclaim = (value: string) => {
    setReclaimText(value);
    const minor = parseMoneyToMinor(value, currency);
    // Reject a claim above the total rather than storing it — the database has the
    // same constraint, so accepting it here would only fail later at the API.
    if (minor !== null && minor >= 0 && minor <= receipt.totalMinor) {
      setReceiptReclaim.mutate({ id: receipt.id, minor });
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: rn(color.bgMobile) }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 14 }]}
      // Without these the numeric keyboard covers the Total and Comment fields:
      // iOS insets the scroll view by the keyboard height so the focused field
      // stays visible, taps outside a field still register, and dragging down
      // dismisses the keyboard.
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      <BackLink onPress={() => router.back()} />

      <Text style={styles.vendor}>{receipt.vendor ?? "Unknown vendor"}</Text>
      <Text style={styles.subMeta}>
        {receipt.receiptDate ? formatShortDate(receipt.receiptDate) : "—"} ·{" "}
        {formatPaymentMethod(receipt.paymentBrand, receipt.paymentLast4) ?? "—"}
      </Text>

      {photoUrl ? (
        <Pressable onPress={() => setPhotoViewerOpen(true)}>
          <Image source={{ uri: photoUrl }} style={styles.photo} contentFit="cover" />
        </Pressable>
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoPlaceholderText}>[ receipt photo ]</Text>
        </View>
      )}

      <View style={styles.chipRow}>
        <CategoryChip
          category={receipt.categoryName ?? "Other"}
          onPress={categoryEditable ? () => setCategoryPickerOpen(true) : undefined}
        />
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
        {commentEditable ? (
          <TextInput
            value={comment}
            onChangeText={commitComment}
            placeholder="e.g. reason for exception, attendees, purpose…"
            placeholderTextColor={rn(color.textFaint)}
            multiline
            style={styles.commentInput}
          />
        ) : (
          <View style={styles.commentReadonly}>
            <Text style={comment ? styles.commentReadonlyText : styles.commentEmptyText}>
              {comment || "No comment was added."}
            </Text>
          </View>
        )}
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
        {/* Total is a transcription of the document, never editable — correcting
            a misread goes through re-extraction, not by typing over it. */}
        <View style={[styles.totalsRow, styles.totalsFinalRow]}>
          <Text style={styles.totalFinalLabel}>Total</Text>
          <Text style={styles.totalFinalValue}>{formatMoney(receipt.totalMinor, currency)}</Text>
        </View>

        {/* What is actually being claimed. Defaults to the total; lower it for a
            shared bill or a personal portion. This is the figure that feeds spend
            reporting and reimbursement. */}
        <View style={[styles.totalsRow, styles.reclaimRow]}>
          {/* Past tense once the money has actually been paid out — "to reclaim"
              reads as still outstanding, which it no longer is. */}
          <Text style={styles.totalFinalLabel}>
            {receipt.reimbursementStatus === "reimbursed" ? "Amount reclaimed" : "Amount to reclaim"}
          </Text>
          {amountEditable ? (
            <View style={styles.totalInputRow}>
              <Text style={styles.totalCurrency}>{currencySymbol(currency)}</Text>
              <TextInput
                value={reclaimText}
                onChangeText={commitReclaim}
                keyboardType="decimal-pad"
                selectTextOnFocus
                style={styles.totalInput}
              />
            </View>
          ) : (
            <Text style={styles.totalFinalValue}>
              {formatMoney(reclaimMinor(receipt), currency)}
            </Text>
          )}
        </View>
        {reclaimExceedsTotal && (
          <Text style={styles.reclaimError}>
            Cannot reclaim more than the receipt total.
          </Text>
        )}
      </View>

      <PickerSheet
        visible={categoryPickerOpen}
        title="Category"
        options={(categories ?? []).map((c) => ({ value: c, label: c }))}
        selectedValue={receipt.categoryName ?? "Other"}
        onSelect={commitCategory}
        onClose={() => setCategoryPickerOpen(false)}
      />

      {photoUrl && (
        <Modal visible={photoViewerOpen} transparent animationType="fade" onRequestClose={() => setPhotoViewerOpen(false)}>
          <Pressable style={styles.photoViewerBackdrop} onPress={() => setPhotoViewerOpen(false)}>
            <Image source={{ uri: photoUrl }} style={styles.photoViewerImage} contentFit="contain" />
          </Pressable>
          <Pressable
            onPress={() => setPhotoViewerOpen(false)}
            style={[styles.photoViewerClose, { top: insets.top + 12 }]}
          >
            <Text style={styles.photoViewerCloseLabel}>✕</Text>
          </Pressable>
        </Modal>
      )}
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
  photo: {
    width: "100%",
    height: 220,
    borderRadius: 16,
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
  photoViewerBackdrop: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  photoViewerImage: {
    width: "100%",
    height: "100%",
  },
  photoViewerClose: {
    position: "absolute",
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoViewerCloseLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
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
  // Same footprint as commentInput but without the input chrome, so a reimbursed
  // receipt reads as a record rather than as a disabled form field.
  commentReadonly: {
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: rn(color.surfaceMuted),
  },
  commentReadonlyText: {
    fontSize: 13,
    color: rn(color.text),
    lineHeight: 19,
  },
  commentEmptyText: {
    fontSize: 13,
    color: rn(color.textFaint),
    fontStyle: "italic",
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
  totalFinalValue: {
    fontSize: 15,
    fontWeight: "800",
    color: rn(color.text),
  },
  reclaimRow: {
    paddingTop: 8,
  },
  reclaimError: {
    fontSize: 11.5,
    color: rn(color.up),
    marginTop: 6,
    textAlign: "right",
  },
  totalInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  totalCurrency: {
    fontSize: 15,
    fontWeight: "800",
    color: rn(color.textMuted),
  },
  totalInput: {
    // Fixed at 90 before, which clipped the trailing digit of any amount six
    // characters or longer (e.g. "238.93") — the box was too narrow for its
    // own padding plus a bold 15px font. minWidth lets it grow for larger
    // totals instead of silently cutting them off.
    minWidth: 90,
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
