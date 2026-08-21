import { useMemo } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color } from "@rr/ui-tokens";
import { categoryAccent, computeCategoryBreakdown, daysBetween, formatMoney, formatShortDate, reclaimMinor } from "@rr/shared";
import { rn } from "../../lib/colors";
import { flagEmoji } from "../../lib/countryFlag";
import { COUNTRY_NAMES } from "../../lib/worldMapData";
import { useDashboard, useReceipts } from "../../lib/queries";
import { CURRENT_MONTH } from "../../lib/data";
import { Text } from "../../components/Text";

export default function CountryDetailScreen() {
  const { t } = useTranslation();
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: receipts } = useReceipts({});
  const { data: dashboard } = useDashboard(CURRENT_MONTH);

  const countryReceipts = useMemo(
    () => (receipts ?? []).filter((r) => r.country === code).sort((a, b) => (b.receiptDate ?? "").localeCompare(a.receiptDate ?? "")),
    [receipts, code],
  );
  const breakdown = useMemo(() => computeCategoryBreakdown(countryReceipts).filter((c) => c.pct > 0), [countryReceipts]);

  if (!receipts || !dashboard) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 14, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={rn(color.brand)} />
      </View>
    );
  }

  if (countryReceipts.length === 0 || !code) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
        <BackLink label={t("country.backLink")} onPress={() => router.back()} />
        <Text style={styles.emptyText}>{t("country.noReceipts")}</Text>
      </View>
    );
  }

  const currency = dashboard.currency;
  const dates = countryReceipts.map((r) => r.receiptDate ?? "").filter(Boolean).sort();
  const firstDate = dates[0]!;
  const lastDate = dates[dates.length - 1]!;
  const totalMinor = countryReceipts.reduce((s, r) => s + reclaimMinor(r), 0);
  const days = Math.max(1, daysBetween(firstDate, lastDate) + 1);
  const avgPerDayMinor = Math.round(totalMinor / days);

  return (
    <ScrollView style={{ backgroundColor: rn(color.bgMobile) }} contentContainerStyle={[styles.container, { paddingTop: insets.top + 14 }]}>
      <BackLink label={t("country.backLink")} onPress={() => router.back()} />

      <View style={styles.headerCard}>
        <Text style={styles.flag}>{flagEmoji(code)}</Text>
        <Text style={styles.countryName}>{COUNTRY_NAMES[code] ?? code}</Text>
        <Text style={styles.dateRange}>
          {formatShortDate(firstDate)} – {formatShortDate(lastDate)} · {t("country.day", { count: days })}
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t("country.spent")}</Text>
          <Text style={styles.statValue}>{formatMoney(totalMinor, currency)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t("country.avgPerDay")}</Text>
          <Text style={styles.statValue}>{formatMoney(avgPerDayMinor, currency)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t("country.byCategory")}</Text>
      <View style={styles.card}>
        {breakdown.map((c, i) => (
          <View key={c.name} style={[styles.categoryRow, i < breakdown.length - 1 && styles.rowBorder]}>
            <View style={[styles.dot, { backgroundColor: rn(categoryAccent(c.name)) }]} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.categoryName}>{c.name}</Text>
              <Text style={styles.categoryCount}>
                {t("country.transaction", { count: countryReceipts.filter((r) => (r.categoryName ?? "Other") === c.name).length })}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.categoryAmount}>{formatMoney(c.amountMinor, currency)}</Text>
              <Text style={styles.categoryPct}>{Math.round(c.pct)}%</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>{t("country.receiptsSection")}</Text>
      <View style={styles.card}>
        {countryReceipts.map((r, i) => (
          <Pressable
            key={r.id}
            onPress={() => router.push(`/receipt/${r.id}`)}
            style={[styles.receiptRow, i < countryReceipts.length - 1 && styles.rowBorder]}
          >
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.receiptVendor}>{r.vendor ?? t("receiptDetail.unknownVendor")}</Text>
              <Text style={styles.receiptDate}>{r.receiptDate ? formatShortDate(r.receiptDate) : "—"}</Text>
            </View>
            <Text style={styles.receiptAmount}>{formatMoney(reclaimMinor(r), currency)}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ marginBottom: 12 }}>
      <Text style={styles.backLink}>{label}</Text>
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
  headerCard: {
    alignItems: "center",
    marginBottom: 18,
  },
  flag: {
    fontSize: 44,
    marginBottom: 8,
  },
  countryName: {
    fontSize: 21,
    fontWeight: "800",
    color: rn(color.text),
  },
  dateRange: {
    fontSize: 12.5,
    color: rn(color.textMuted),
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: rn(color.surface),
    borderRadius: 14,
    padding: 14,
  },
  statLabel: {
    fontSize: 11.5,
    color: rn(color.textMuted),
    fontWeight: "600",
  },
  statValue: {
    fontSize: 17,
    fontWeight: "800",
    marginTop: 4,
    color: rn(color.text),
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: rn(color.text),
    marginBottom: 8,
  },
  card: {
    backgroundColor: rn(color.surface),
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: rn(color.borderSubtle),
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: "700",
    color: rn(color.text),
  },
  categoryCount: {
    fontSize: 11.5,
    color: rn(color.textFaint),
    marginTop: 1,
  },
  categoryAmount: {
    fontSize: 13,
    fontWeight: "800",
    color: rn(color.text),
  },
  categoryPct: {
    fontSize: 11,
    color: rn(color.textMuted),
    marginTop: 1,
  },
  receiptRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  receiptVendor: {
    fontSize: 13,
    fontWeight: "700",
    color: rn(color.text),
  },
  receiptDate: {
    fontSize: 11.5,
    color: rn(color.textFaint),
    marginTop: 1,
  },
  receiptAmount: {
    fontSize: 13,
    fontWeight: "800",
    color: rn(color.text),
  },
  emptyText: {
    fontSize: 13,
    color: rn(color.textMuted),
    textAlign: "center",
  },
});
