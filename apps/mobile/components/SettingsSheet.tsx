import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { color } from "@rr/ui-tokens";
import {
  currencySymbol,
  rateToDecimalString,
  parseRateToMilli,
  MI_TO_KM,
  type DistanceUnit,
} from "@rr/shared";
import { rn, rnAlpha } from "../lib/colors";
import { Text } from "./Text";

export interface SettingsDraft {
  distanceUnit: DistanceUnit;
  rateMilli: number;
  homeCurrency: string;
}

/**
 * Settings bottom sheet, reached from the gear in the Home header.
 *
 * Edits are held as a draft and applied together on Save. Nothing takes effect
 * while the sheet is open — changing the home currency re-expresses every amount
 * in the app, so doing that live under a half-finished set of changes would be
 * jarring, and there would be no way to back out.
 *
 * Dismissing without saving discards the draft.
 */
export function SettingsSheet({
  visible,
  currencies,
  initial,
  onSave,
  onClose,
}: {
  visible: boolean;
  currencies: readonly string[];
  initial: SettingsDraft;
  onSave: (draft: SettingsDraft) => void;
  onClose: () => void;
}) {
  const [unit, setUnit] = useState<DistanceUnit>(initial.distanceUnit);
  const [currency, setCurrency] = useState(initial.homeCurrency);
  const [rateText, setRateText] = useState(rateToDecimalString(initial.rateMilli));

  // Reset the draft each time the sheet opens, so a previous cancel does not
  // leave stale edits sitting in the fields.
  useEffect(() => {
    if (!visible) return;
    setUnit(initial.distanceUnit);
    setCurrency(initial.homeCurrency);
    setRateText(rateToDecimalString(initial.rateMilli));
  }, [visible, initial.distanceUnit, initial.homeCurrency, initial.rateMilli]);

  /**
   * Switching unit converts the rate in the field, so it stays worth roughly the
   * same rather than reading as 1.6x wrong while you decide. The exact statutory
   * figure can then be typed over it.
   */
  const changeUnit = (next: DistanceUnit) => {
    if (next === unit) return;
    const current = parseRateToMilli(rateText);
    if (current !== null) {
      const converted = Math.round(next === "km" ? current / MI_TO_KM : current * MI_TO_KM);
      setRateText(rateToDecimalString(converted));
    }
    setUnit(next);
  };

  const parsedRate = parseRateToMilli(rateText);
  const rateValid = parsedRate !== null && parsedRate > 0;

  const save = () => {
    if (!rateValid) return;
    onSave({ distanceUnit: unit, rateMilli: parsedRate, homeCurrency: currency });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Settings</Text>

          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionLabel}>Distance unit</Text>
            <Text style={styles.sectionHint}>Used for mileage and the per-unit rate.</Text>
            <View style={styles.segmented}>
              {(["mi", "km"] as const).map((u) => {
                const on = u === unit;
                return (
                  <Pressable
                    key={u}
                    onPress={() => changeUnit(u)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.segment, on && styles.segmentOn]}
                  >
                    <Text style={[styles.segmentLabel, on && styles.segmentLabelOn]}>{u}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 18 }]}>
              Reimbursement rate per {unit}
            </Text>
            <Text style={styles.sectionHint}>
              Applies to new trips. Trips already logged keep the rate they were recorded at.
            </Text>
            <View style={styles.rateRow}>
              <Text style={styles.rateSymbol}>{currencySymbol(currency)}</Text>
              <TextInput
                value={rateText}
                onChangeText={setRateText}
                placeholder="0.700"
                placeholderTextColor={rn(color.textFaint)}
                keyboardType="decimal-pad"
                selectTextOnFocus
                style={[styles.rateInput, !rateValid && styles.rateInputInvalid]}
              />
            </View>
            {!rateValid && <Text style={styles.rateError}>Enter a rate above zero.</Text>}

            <Text style={[styles.sectionLabel, { marginTop: 18 }]}>Home currency</Text>
            <Text style={styles.sectionHint}>Every amount is shown converted to this currency.</Text>
            {currencies.map((code) => {
              const active = code === currency;
              return (
                <Pressable
                  key={code}
                  onPress={() => setCurrency(code)}
                  style={[styles.row, active && { backgroundColor: rn(color.brandTint) }]}
                >
                  <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>{code}</Text>
                  <Text style={[styles.rowSymbol, active && styles.rowLabelActive]}>
                    {currencySymbol(code)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.save, !rateValid && styles.saveDisabled]}
              onPress={save}
              disabled={!rateValid}
            >
              <Text style={styles.saveLabel}>Save</Text>
            </Pressable>
          </View>
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
    marginBottom: 16,
    color: rn(color.text),
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: rn(color.textMuted),
    marginBottom: 2,
  },
  sectionHint: {
    fontSize: 11.5,
    color: rn(color.textFaint),
    marginBottom: 8,
  },
  segmented: {
    flexDirection: "row",
    alignSelf: "flex-start",
    backgroundColor: rn(color.avatarBg),
    borderRadius: 20,
    padding: 3,
  },
  segment: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  segmentOn: {
    backgroundColor: rn(color.brand),
  },
  segmentLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: rn(color.textMuted),
  },
  segmentLabelOn: {
    color: "#fff",
  },
  rateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rateSymbol: {
    fontSize: 15,
    fontWeight: "700",
    color: rn(color.textMuted),
  },
  rateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: rn(color.borderStrong),
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: "700",
    color: rn(color.text),
  },
  rateInputInvalid: {
    borderColor: rn(color.up),
  },
  rateError: {
    fontSize: 11.5,
    color: rn(color.up),
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: rn(color.text),
  },
  rowSymbol: {
    fontSize: 14,
    color: rn(color.textMuted),
  },
  rowLabelActive: {
    color: rn(color.brand),
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  cancel: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: rn(color.avatarBg),
  },
  cancelLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: rn(color.textMuted),
  },
  save: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: rn(color.brand),
  },
  saveDisabled: {
    opacity: 0.45,
  },
  saveLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
