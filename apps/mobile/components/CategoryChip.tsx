import { StyleSheet, TouchableOpacity, View, type ViewStyle } from "react-native";
import { categoryChipColor } from "@rr/shared";
import { rn } from "../lib/colors";
import { Text } from "./Text";

export function CategoryChip({
  category,
  onPress,
  style,
}: {
  category: string;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const bg = rn(categoryChipColor(category, true));
  const fg = rn(categoryChipColor(category, false));
  const content = (
    <View style={[styles.chip, { backgroundColor: bg }, style]}>
      <Text style={[styles.label, { color: fg }]}>{category}</Text>
    </View>
  );
  if (!onPress) return content;
  return <TouchableOpacity onPress={onPress}>{content}</TouchableOpacity>;
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  label: {
    fontSize: 13.5,
    fontWeight: "700",
  },
});
