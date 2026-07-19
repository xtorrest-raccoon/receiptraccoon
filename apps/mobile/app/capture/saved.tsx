import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { color } from "@rr/ui-tokens";
import { formatMoney } from "@rr/shared";
import { rn } from "../../lib/colors";
import { getSavedSummary, resetCapture } from "../../lib/captureStore";
import { Text } from "../../components/Text";

export default function SavedScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState(getSavedSummary());

  useEffect(() => {
    setSummary(getSavedSummary());
  }, []);

  const onDone = () => {
    resetCapture();
    router.replace("/");
  };

  return (
    <View style={[styles.container, { backgroundColor: rn(color.bgMobile) }]}>
      <View style={styles.tick}>
        <Text style={styles.tickMark}>✓</Text>
      </View>
      <Text style={styles.title}>Receipt saved</Text>
      {summary && (
        <Text style={styles.summary}>
          {summary.vendor} · {formatMoney(summary.totalMinor, summary.currency)} · {summary.category}
        </Text>
      )}
      <Pressable style={styles.doneButton} onPress={onDone}>
        <Text style={styles.doneButtonLabel}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 30,
  },
  tick: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: rn(color.brandSoft),
    alignItems: "center",
    justifyContent: "center",
  },
  tickMark: {
    fontSize: 28,
    fontWeight: "800",
    color: rn(color.brandSoftText),
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: rn(color.text),
  },
  summary: {
    fontSize: 12.5,
    color: rn(color.textMuted),
    textAlign: "center",
  },
  doneButton: {
    marginTop: 6,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: rn(color.inkPanel),
  },
  doneButtonLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13.5,
  },
});
