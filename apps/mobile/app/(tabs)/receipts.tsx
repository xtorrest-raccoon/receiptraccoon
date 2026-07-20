import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color } from "@rr/ui-tokens";
import type { Receipt } from "@rr/shared";
import { rn } from "../../lib/colors";
import { getHomeCurrency, listReceipts, deleteReceipt } from "../../lib/data";
import { Text } from "../../components/Text";
import { ReceiptRow } from "../../components/ReceiptRow";
import { SwipeToDelete } from "../../components/SwipeToDelete";

export default function ReceiptsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [currency, setCurrency] = useState(getHomeCurrency());

  // useFocusEffect, not useEffect: tab screens stay mounted in expo-router, so a
  // mount-only effect never re-reads after the user edits a receipt on the detail
  // screen and navigates back — the list would keep showing the old total.
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setCurrency(getHomeCurrency());
      // listReceipts is synchronous today (in-memory mock), but the load is kept
      // async-shaped so this screen doesn't need to change when it starts hitting
      // a real network call.
      const timer = setTimeout(() => {
        setReceipts(listReceipts());
        setLoading(false);
      }, 0);
      return () => clearTimeout(timer);
    }, []),
  );

  const confirmDelete = (receipt: Receipt) => {
    Alert.alert(
      "Delete receipt?",
      `${receipt.vendor ?? "This receipt"} will be permanently removed. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            const ok = deleteReceipt(receipt.id);
            if (ok) {
              setReceipts((prev) => prev.filter((r) => r.id !== receipt.id));
            } else {
              // Should be unreachable — only pending rows swipe — but report it
              // rather than appearing to succeed.
              Alert.alert("Could not delete", "Only pending receipts can be deleted.");
            }
          },
        },
      ],
    );
  };

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
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 + insets.bottom, gap: 8 }}
          renderItem={({ item }) => (
            <SwipeToDelete
              // Only pending receipts swipe. Once approved, paid or rejected a
              // receipt is part of the reimbursement record.
              enabled={item.reimbursementStatus === "pending"}
              onDelete={() => confirmDelete(item)}
            >
              <ReceiptRow
                receipt={item}
                currency={currency}
                onPress={() => router.push(`/receipt/${item.id}`)}
              />
            </SwipeToDelete>
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
