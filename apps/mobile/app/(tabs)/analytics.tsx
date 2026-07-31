import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { color } from "@rr/ui-tokens";
import { formatMoney, formatShortDate, summarizeCountryVisits } from "@rr/shared";
import { rn } from "../../lib/colors";
import { flagEmoji } from "../../lib/countryFlag";
import { COUNTRY_NAMES } from "../../lib/worldMapData";
import { useDashboard, useReceipts } from "../../lib/queries";
import { CURRENT_MONTH } from "../../lib/data";
import { Text } from "../../components/Text";
import { WorldMap } from "../../components/WorldMap";

function ShareIcon({ tint }: { tint: string }) {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v12" stroke={tint} strokeWidth={2} strokeLinecap="round" />
      <Path d="M8 7l4-4 4 4" stroke={tint} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke={tint} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

// Commonly cited figure for UN member + observer states -- an approximation,
// not a precise denominator. "% of the world" is a fun stat, not an audited one.
const TOTAL_COUNTRIES = 195;
const CURRENT_YEAR = CURRENT_MONTH.slice(0, 4);

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: receipts } = useReceipts({});
  const { data: dashboard } = useDashboard(CURRENT_MONTH);

  const visits = useMemo(() => summarizeCountryVisits(receipts ?? []), [receipts]);
  const visitedCodes = useMemo(() => new Set(visits.map((v) => v.countryCode)), [visits]);
  const tripCount = useMemo(() => visits.reduce((s, v) => s + v.tripCount, 0), [visits]);
  const yearTotalMinor = useMemo(
    () =>
      visits.reduce((sum, v) => (v.lastDate.startsWith(CURRENT_YEAR) || v.firstDate.startsWith(CURRENT_YEAR) ? sum + v.totalMinor : sum), 0),
    [visits],
  );
  const worldPct = Math.round((visits.length / TOTAL_COUNTRIES) * 100);

  if (!receipts || !dashboard) {
    return (
      <View style={{ flex: 1, backgroundColor: rn(color.bgMobile), alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={rn(color.brand)} />
      </View>
    );
  }

  const currency = dashboard.currency;

  const onShare = () => {
    const countryWord = visits.length === 1 ? "country" : "countries";
    Share.share({
      message: `I've tracked expenses across ${visits.length} ${countryWord} and ${tripCount} trips with ReceiptRaccoon 🦝`,
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: rn(color.bgMobile) }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: 96 + insets.bottom }}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Analytics</Text>
          <Pressable style={styles.shareButton} onPress={onShare} accessibilityRole="button" accessibilityLabel="Share">
            <ShareIcon tint={rn(color.text)} />
            <Text style={styles.shareLabel}>Share</Text>
          </Pressable>
        </View>

        <WorldMap visited={visitedCodes} selected={selected} onSelectCountry={(code) => setSelected(code)} />

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{worldPct}%</Text>
            <Text style={styles.statLabel}>Of the world</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{tripCount}</Text>
            <Text style={styles.statLabel}>Trips</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{visits.length}</Text>
            <Text style={styles.statLabel}>Countries</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.yearRow}>
            <Text style={styles.yearLabel}>This year</Text>
            <Text style={styles.yearValue}>{formatMoney(yearTotalMinor, currency)}</Text>
          </View>

          {visits.length === 0 ? (
            <Text style={styles.emptyText}>No receipts with a detected country yet.</Text>
          ) : (
            visits.map((v, i) => (
              <Pressable
                key={v.countryCode}
                onPress={() => router.push({ pathname: "/country/[code]", params: { code: v.countryCode } })}
                style={[styles.countryRow, i < visits.length - 1 && styles.countryRowBorder]}
              >
                <Text style={styles.flag}>{flagEmoji(v.countryCode)}</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.countryName}>{COUNTRY_NAMES[v.countryCode] ?? v.countryCode}</Text>
                  <Text style={styles.countryDates}>
                    {formatShortDate(v.firstDate)} – {formatShortDate(v.lastDate)}
                  </Text>
                </View>
                <Text style={styles.countryAmount}>{formatMoney(v.totalMinor, currency)}</Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 21,
    fontWeight: "800",
    color: rn(color.text),
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: rn(color.avatarBg),
  },
  shareLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: rn(color.text),
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 16,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 21,
    fontWeight: "800",
    color: rn(color.text),
  },
  statLabel: {
    fontSize: 11.5,
    color: rn(color.textMuted),
    marginTop: 2,
  },
  card: {
    backgroundColor: rn(color.surface),
    borderRadius: 18,
    padding: 16,
  },
  yearRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 10,
  },
  yearLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: rn(color.text),
  },
  yearValue: {
    fontSize: 15,
    fontWeight: "800",
    color: rn(color.text),
  },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  countryRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: rn(color.borderSubtle),
  },
  flag: {
    fontSize: 26,
  },
  countryName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: rn(color.text),
  },
  countryDates: {
    fontSize: 11.5,
    color: rn(color.textFaint),
    marginTop: 1,
  },
  countryAmount: {
    fontSize: 13.5,
    fontWeight: "800",
    color: rn(color.text),
  },
  emptyText: {
    fontSize: 13,
    color: rn(color.textMuted),
    textAlign: "center",
    paddingVertical: 12,
  },
});
