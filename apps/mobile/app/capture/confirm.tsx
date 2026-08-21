import { useEffect, useState, type ReactNode } from "react";
import { Image } from "expo-image";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, reimbursementChip } from "@rr/ui-tokens";
import { formatMoney, formatShortDate, minorToDecimalString, parseMoneyToMinor, currencySymbol } from "@rr/shared";
import { rn, rnAlpha } from "../../lib/colors";
import { findDuplicateReceipt, type DraftReceipt } from "../../lib/data";
import { useAddReceipt, useCategories, useHomeCurrency, useUploadReceiptPhoto } from "../../lib/queries";
import { getDraftReceipt, resetCapture, setSavedSummary } from "../../lib/captureStore";
import { Text } from "../../components/Text";
import { TextInput } from "../../components/TextInput";
import { CategoryChip } from "../../components/CategoryChip";
import { PickerSheet } from "../../components/PickerSheet";

/** "2026-07-03" -> a local Date for that calendar day, not midnight UTC (which can land on the wrong day west of Greenwich). Falls back to today when unset/unparseable, so the picker never opens on an invalid date. */
function parseDateOrToday(iso: string): Date {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Deliberately NOT formatShortDate — that one always omits the year (fine
 * for a receipt list row you're skimming), but this field is where someone
 * actually confirms/corrects the date before saving, so the year has to be
 * visible to catch a wrong one (see the country/date-format-ambiguity work
 * this same session, which exists for exactly this class of error).
 */
function formatDateWithYear(iso: string): string {
  return parseDateOrToday(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ConfirmScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: currency } = useHomeCurrency();
  const { data: categories } = useCategories();
  const addReceipt = useAddReceipt();
  const uploadPhoto = useUploadReceiptPhoto();

  const [draft, setDraft] = useState<DraftReceipt | null>(null);
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState("");
  const [totalText, setTotalText] = useState("");
  const [taxText, setTaxText] = useState("");
  const [payment, setPayment] = useState("");
  const [category, setCategory] = useState("Other");
  const [comment, setComment] = useState("");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    if (!currency) return;
    const d = getDraftReceipt();
    setDraft(d);
    if (d) {
      setVendor(d.vendor);
      setDate(d.date);
      setTotalText(minorToDecimalString(d.totalMinor, currency));
      setTaxText(minorToDecimalString(d.taxMinor, currency));
      setPayment(
        d.paymentBrand || d.paymentLast4 ? `${d.paymentBrand ?? ""} •${d.paymentLast4 ?? ""}`.trim() : "",
      );
      setCategory(d.category);
      setComment(d.comment);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency]);

  if (!currency || !categories) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={rn(color.brand)} />
      </View>
    );
  }

  const totalMinor = parseMoneyToMinor(totalText, currency);
  const saving = addReceipt.isPending || uploadPhoto.isPending;
  const canSave = vendor.trim().length > 0 && totalMinor !== null && totalMinor > 0 && !saving;

  const onSave = async () => {
    if (!canSave || totalMinor === null) return;

    const isDuplicate = await findDuplicateReceipt(vendor, date.trim() || null, totalMinor);
    if (isDuplicate) {
      // Vendor+date+total matching isn't proof — two identical coffees on the
      // same day would match too. Framed as a question, not an assertion.
      Alert.alert(
        t("confirm.possibleDuplicateTitle"),
        t("confirm.possibleDuplicateBody", { vendor: vendor.trim() }),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("confirm.yesSaveIt"), onPress: () => doSave() },
        ],
      );
      return;
    }

    await doSave();
  };

  const doSave = async () => {
    if (!canSave || totalMinor === null) return;
    // "Visa •1234" -> brand "Visa", last4 "1234" — the inverse of
    // formatPaymentMethod, which is what produced this shape in the first place.
    const [paymentBrand, paymentLast4] = payment.includes("•")
      ? payment.split("•").map((s) => s.trim())
      : [payment.trim() || null, null];

    // The photo is secondary to the receipt data itself — a failed upload
    // (network blip, etc.) shouldn't lose everything the user just typed in.
    // Falls back to no photo rather than blocking the save.
    let imagePath: string | null = null;
    if (draft?.photoUri) {
      try {
        imagePath = await uploadPhoto.mutateAsync(draft.photoUri);
      } catch {
        imagePath = null;
      }
    }

    addReceipt.mutate(
      {
        vendor: vendor.trim(),
        receiptDate: date.trim() || null,
        totalMinor,
        taxMinor: parseMoneyToMinor(taxText, currency) ?? 0,
        categoryName: category,
        comment: comment.trim(),
        paymentBrand: paymentBrand || null,
        paymentLast4: paymentLast4 || null,
        imagePath,
        originalCurrency: draft?.originalCurrency ?? null,
        originalTotalMinor: draft?.originalTotalMinor ?? null,
        fxRate: draft?.fxRate ?? null,
        fxRateDate: draft?.fxRateDate ?? null,
        country: draft?.country ?? null,
      },
      {
        onSuccess: () => {
          setSavedSummary({ vendor: vendor.trim(), totalMinor, category, currency });
          router.replace("/capture/saved");
        },
      },
    );
  };

  const onDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    // Android's picker is a self-dismissing native dialog -- it must be
    // unmounted here or it stays stuck open. iOS's stays open until the
    // "Done" button below closes it, so a new pick there isn't itself a
    // close signal.
    if (Platform.OS === "android") setDatePickerOpen(false);
    if (event.type === "set" && selected) setDate(toIsoDate(selected));
  };

  const onCancel = () => {
    Alert.alert(t("confirm.discardTitle"), t("confirm.discardBody"), [
      { text: t("confirm.keepEditing"), style: "cancel" },
      {
        text: t("confirm.discard"),
        style: "destructive",
        onPress: () => {
          resetCapture();
          router.replace("/capture");
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 18, paddingBottom: 24 }}
        // Same reason as the receipt detail screen: the keyboard would otherwise
        // cover the Total, Tax and Comment fields on this form.
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <Text style={styles.title}>{t("confirm.title")}</Text>
        <Text style={styles.subtitle}>{t("confirm.subtitle")}</Text>

        {draft?.photoUri ? (
          <Image source={{ uri: draft.photoUri }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>{t("confirm.photoPlaceholder")}</Text>
          </View>
        )}

        <View style={{ gap: 10 }}>
          <Field label={t("confirm.vendorLabel")}>
            <TextInput value={vendor} onChangeText={setVendor} placeholder={t("confirm.vendorPlaceholder")} style={styles.input} />
          </Field>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label={t("confirm.dateLabel")}>
                <Pressable onPress={() => setDatePickerOpen(true)} style={styles.input}>
                  <Text style={date ? styles.dateValueText : styles.dateValuePlaceholder}>
                    {date ? formatDateWithYear(date) : t("confirm.datePlaceholder")}
                  </Text>
                </Pressable>
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t("confirm.totalLabel", { symbol: currencySymbol(currency) })}>
                <TextInput
                  value={totalText}
                  onChangeText={setTotalText}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </Field>
            </View>
          </View>

          {draft?.originalCurrency && draft.originalTotalMinor !== null ? (
            <View style={styles.fxBanner}>
              <Text style={styles.fxBannerText}>
                {t("confirm.originally", { amount: formatMoney(draft.originalTotalMinor, draft.originalCurrency) })}
                {draft.fxRate !== null ? t("confirm.convertedAt", { rate: draft.fxRate.toFixed(4) }) : ""}
                {draft.fxRateDate ? t("confirm.onDate", { date: formatShortDate(draft.fxRateDate) }) : ""}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label={t("confirm.taxLabel", { symbol: currencySymbol(currency) })}>
                <TextInput value={taxText} onChangeText={setTaxText} keyboardType="decimal-pad" style={styles.input} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t("confirm.paymentLabel")}>
                <TextInput
                  value={payment}
                  onChangeText={setPayment}
                  placeholder={t("confirm.paymentPlaceholder")}
                  style={styles.input}
                />
              </Field>
            </View>
          </View>

          <Field label={t("confirm.categoryLabel")}>
            <CategoryChip category={category} onPress={() => setCategoryPickerOpen(true)} />
          </Field>

          <Field label={t("confirm.commentLabel")}>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder={t("confirm.commentPlaceholder")}
              placeholderTextColor={rn(color.textFaint)}
              multiline
              style={styles.commentInput}
            />
          </Field>
        </View>

        <View style={styles.actionsRow}>
          <Pressable onPress={onCancel} disabled={saving} style={[styles.cancelButton, saving && { opacity: 0.5 }]}>
            <Text style={styles.cancelButtonLabel}>{t("common.cancel")}</Text>
          </Pressable>
          <Pressable
            onPress={onSave}
            disabled={!canSave}
            style={[styles.saveButton, !canSave && { opacity: 0.5 }]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonLabel}>{t("confirm.saveReceipt")}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <PickerSheet
        visible={categoryPickerOpen}
        title={t("confirm.categoryPickerTitle")}
        options={categories.map((c) => ({ value: c, label: c }))}
        selectedValue={category}
        onSelect={setCategory}
        onClose={() => setCategoryPickerOpen(false)}
      />

      {/* Android's picker is a self-contained native dialog -- mounting it is
          enough, no wrapper needed. iOS's "spinner" display renders inline
          wherever it's mounted rather than floating itself, so it needs its
          own bottom-sheet here (same shape as PickerSheet) with an explicit
          "Done" to close, since nothing else on iOS dismisses it. */}
      {datePickerOpen && Platform.OS === "android" && (
        <DateTimePicker value={parseDateOrToday(date)} mode="date" display="default" onChange={onDateChange} />
      )}
      {Platform.OS === "ios" && (
        <Modal visible={datePickerOpen} transparent animationType="fade" onRequestClose={() => setDatePickerOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setDatePickerOpen(false)}>
            <Pressable style={styles.datePickerSheet} onPress={(e) => e.stopPropagation()}>
              <DateTimePicker value={parseDateOrToday(date)} mode="date" display="spinner" onChange={onDateChange} />
              <Pressable style={styles.datePickerDone} onPress={() => setDatePickerOpen(false)}>
                <Text style={styles.datePickerDoneLabel}>{t("common.done")}</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: rn(color.bgMobile),
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 2,
    color: rn(color.text),
  },
  subtitle: {
    fontSize: 12.5,
    color: rn(color.textMuted),
    marginBottom: 14,
  },
  photo: {
    width: "100%",
    height: 140,
    borderRadius: 14,
    marginBottom: 16,
  },
  photoPlaceholder: {
    width: "100%",
    height: 140,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: rn(color.borderStrong),
    backgroundColor: rn(color.surfaceMuted),
    alignItems: "center",
    justifyContent: "center",
  },
  photoPlaceholderText: {
    color: rn(color.textFaint),
    fontSize: 11.5,
    fontFamily: "monospace",
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: rn(color.textMuted),
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  input: {
    fontSize: 14,
    fontWeight: "600",
    backgroundColor: rn(color.surface),
    borderWidth: 1,
    borderColor: rn(color.borderStrong),
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: rn(color.text),
  },
  dateValueText: {
    fontSize: 14,
    fontWeight: "600",
    color: rn(color.text),
  },
  dateValuePlaceholder: {
    fontSize: 14,
    fontWeight: "600",
    color: rn(color.textFaint),
  },
  backdrop: {
    flex: 1,
    backgroundColor: rnAlpha(color.text, 0.35),
    justifyContent: "flex-end",
  },
  datePickerSheet: {
    backgroundColor: rn(color.surface),
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    alignItems: "center",
  },
  datePickerDone: {
    marginTop: 8,
    paddingVertical: 13,
    paddingHorizontal: 40,
    borderRadius: 12,
    backgroundColor: rn(color.brand),
  },
  datePickerDoneLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  fxBanner: {
    backgroundColor: rn(reimbursementChip.approved.bg),
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  fxBannerText: {
    fontSize: 12,
    fontWeight: "600",
    color: rn(reimbursementChip.approved.text),
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
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: rn(color.surfaceMuted),
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
  },
  cancelButtonLabel: {
    color: rn(color.textMuted),
    fontWeight: "700",
    fontSize: 15,
  },
  saveButton: {
    flex: 1,
    backgroundColor: rn(color.brand),
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
  },
  saveButtonLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
