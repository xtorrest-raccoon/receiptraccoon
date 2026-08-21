import { FlatList, Modal, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { color } from "@rr/ui-tokens";
import { rn, rnAlpha } from "../lib/colors";
import { Text } from "./Text";

export interface PickerOption {
  value: string;
  label: string;
}

/**
 * A minimal bottom-sheet list picker. Stands in for the design's native `<select>`
 * (month picker, category picker) since React Native has no equivalent form
 * control — this keeps the same "tap to choose from a short list" interaction.
 */
export function PickerSheet({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            style={{ maxHeight: 340 }}
            renderItem={({ item }) => {
              const active = item.value === selectedValue;
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item.value);
                    onClose();
                  }}
                  style={[styles.row, active && { backgroundColor: rn(color.brandTint) }]}
                >
                  <Text style={[styles.rowLabel, active && { color: rn(color.brand), fontWeight: "700" }]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
          />
          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelLabel}>{t("common.cancel")}</Text>
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
    marginBottom: 12,
    color: rn(color.text),
  },
  row: {
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: rn(color.text),
  },
  cancel: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: rn(color.surfaceMuted),
    alignItems: "center",
  },
  cancelLabel: {
    fontSize: 13.5,
    fontWeight: "700",
    color: rn(color.textMuted),
  },
});
