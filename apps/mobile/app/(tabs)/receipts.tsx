import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color } from "@rr/ui-tokens";
import type { Receipt } from "@rr/shared";
import { rn } from "../../lib/colors";
import { HOME_CURRENCY, listReceipts } from "../../lib/data";
import { Text } from "../../components/Text";
import { ReceiptRow } from "../../components/ReceiptRow";

export default function ReceiptsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<Receipt[]>([]);

  useEffect(() => {
    setLoading(true);
    // listReceipts is synchronous today (in-memory mock), but the load is kept
    // async-shaped so this screen doesn't need to change when it starts hitting
    // a real network call.
    const timer = setTimeout(() => {
      setReceipts(listReceipts());
      setLoading(false);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: rn(color.bgMobile) }}>
      <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={styles.title}>Receipts</Text>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={rn(color.brand)} />
        </View>
      ) : receipts.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>No receipts yet. Tap Capture to add one.</Text>
        </View>
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96, gap: 8 }}
          renderItem={({ item }) => (
            <ReceiptRow
              receipt={item}
              currency={HOME_CURRENCY}
              onPress={() => router.push(`/receipt/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 21,
    fontWeight: "800",
    color: rn(color.text),
  },
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 96,
  },
  emptyText: {
    fontSize: 13,
    color: rn(color.textMuted),
    textAlign: "center",
    paddingHorizontal: 32,
  },
});
