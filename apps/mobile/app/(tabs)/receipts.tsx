import { useCallback } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color } from "@rr/ui-tokens";
import { canDeleteReceipt, isRecentOrActionable, type Receipt } from "@rr/shared";
import { rn } from "../../lib/colors";
import { useDeleteReceipt, useHomeCurrency, useReceipts } from "../../lib/queries";
import { Text } from "../../components/Text";
import { ReceiptRow } from "../../components/ReceiptRow";
import { SwipeToDelete } from "../../components/SwipeToDelete";

export default function ReceiptsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: currency } = useHomeCurrency();
  const { data: receipts, isLoading, refetch } = useReceipts();
  const deleteReceipt = useDeleteReceipt();

  // Reimbursed receipts older than 3 months drop off this list -- see
  // isRecentOrActionable. Everything still pending/approved/rejected stays,
  // and the full history remains on the web app.
  const visibleReceipts = (receipts ?? []).filter((r) => isRecentOrActionable(r.reimbursementStatus, r.receiptDate));

  // Tab screens stay mounted in expo-router, so a mutation made on another
  // screen already invalidates this query in the background — this refetch
  // on focus is just a cheap extra guarantee, not the only thing keeping the
  // list current.
  useFocusEffect(
    useCallback(() => {
      refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
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
            deleteReceipt.mutate(receipt.id, {
              onSuccess: (ok) => {
                // Should be unreachable — only pending/rejected rows swipe — but
                // report it rather than appearing to succeed.
                if (!ok) Alert.alert("Could not delete", "Only pending or rejected receipts can be deleted.");
              },
            });
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

      {isLoading || !currency ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={rn(color.brand)} />
        </View>
      ) : !receipts || receipts.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>No receipts yet. Tap Capture to add one.</Text>
        </View>
      ) : visibleReceipts.length === 0 ? (
        <View style={styles.centerFill}>
          <Text style={styles.emptyText}>Nothing needs attention — older reimbursed receipts are on the web app.</Text>
        </View>
      ) : (
        <FlatList
          data={visibleReceipts}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 + insets.bottom, gap: 8 }}
          renderItem={({ item }) => (
            <SwipeToDelete
              // Pending or rejected receipts swipe — see canDeleteReceipt. Once
              // approved or reimbursed, a receipt is part of the reimbursement
              // record and stays put.
              enabled={canDeleteReceipt(item.reimbursementStatus)}
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
