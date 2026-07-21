import { useEffect, useState, type ReactNode } from "react";
import { Image } from "expo-image";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color } from "@rr/ui-tokens";
import { minorToDecimalString, parseMoneyToMinor, currencySymbol } from "@rr/shared";
import { rn } from "../../lib/colors";
import type { DraftReceipt } from "../../lib/data";
import { useAddReceipt, useCategories, useHomeCurrency } from "../../lib/queries";
import { getDraftReceipt, setSavedSummary } from "../../lib/captureStore";
import { Text } from "../../components/Text";
import { CategoryChip } from "../../components/CategoryChip";
import { PickerSheet } from "../../components/PickerSheet";

export default function ConfirmScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: currency } = useHomeCurrency();
  const { data: categories } = useCategories();
  const addReceipt = useAddReceipt();

  const [draft, setDraft] = useState<DraftReceipt | null>(null);
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState("");
  const [totalText, setTotalText] = useState("");
  const [taxText, setTaxText] = useState("");
  const [payment, setPayment] = useState("");
  const [category, setCategory] = useState("Other");
  const [comment, setComment] = useState("");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

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
  const canSave = vendor.trim().length > 0 && totalMinor !== null && totalMinor > 0 && !addReceipt.isPending;

  const onSave = () => {
    if (!canSave || totalMinor === null) return;
    // "Visa •1234" -> brand "Visa", last4 "1234" — the inverse of
    // formatPaymentMethod, which is what produced this shape in the first place.
    const [paymentBrand, paymentLast4] = payment.includes("•")
      ? payment.split("•").map((s) => s.trim())
      : [payment.trim() || null, null];
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
        imagePath: draft?.photoUri ?? null,
      },
      {
        onSuccess: () => {
          setSavedSummary({ vendor: vendor.trim(), totalMinor, category, currency });
          router.replace("/capture/saved");
        },
      },
    );
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
        <Text style={styles.title}>Review receipt</Text>
        <Text style={styles.subtitle}>Confirm the details we found</Text>

        {draft?.photoUri ? (
          <Image source={{ uri: draft.photoUri }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>[ captured photo ]</Text>
          </View>
        )}

        <View style={{ gap: 10 }}>
          <Field label="Vendor">
            <TextInput value={vendor} onChangeText={setVendor} placeholder="Vendor name" style={styles.input} />
          </Field>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Date">
                <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={styles.input} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label={`Total (${currencySymbol(currency)})`}>
                <TextInput
                  value={totalText}
                  onChangeText={setTotalText}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </Field>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label={`Tax (${currencySymbol(currency)})`}>
                <TextInput value={taxText} onChangeText={setTaxText} keyboardType="decimal-pad" style={styles.input} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Payment">
                <TextInput
                  value={payment}
                  onChangeText={setPayment}
                  placeholder="Visa •1234"
                  style={styles.input}
                />
              </Field>
            </View>
          </View>

          <Field label="Category">
            <CategoryChip category={category} onPress={() => setCategoryPickerOpen(true)} />
          </Field>

          <Field label="Comment">
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="e.g. reason for exception, attendees, purpose…"
              placeholderTextColor={rn(color.textFaint)}
              multiline
              style={styles.commentInput}
            />
          </Field>
        </View>

        <Pressable
          onPress={onSave}
          disabled={!canSave}
          style={[styles.saveButton, !canSave && { opacity: 0.5 }]}
        >
          {addReceipt.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonLabel}>Save receipt</Text>
          )}
        </Pressable>
      </ScrollView>

      <PickerSheet
        visible={categoryPickerOpen}
        title="Category"
        options={categories.map((c) => ({ value: c, label: c }))}
        selectedValue={category}
        onSelect={setCategory}
        onClose={() => setCategoryPickerOpen(false)}
      />
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
  saveButton: {
    marginTop: 22,
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
