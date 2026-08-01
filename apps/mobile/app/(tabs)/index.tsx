import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color } from "@rr/ui-tokens";
import { categoryAccent, convertRateMilliCurrency, formatMoney } from "@rr/shared";
import { signOut } from "@rr/api";
import { rn } from "../../lib/colors";
import { CURRENT_MONTH } from "../../lib/data";
import {
  useAvailableMonths,
  useCurrentUser,
  useDashboard,
  useDisplayDistanceUnit,
  useDisplayRate,
  useHomeCurrency,
  useMyMileageRateMilli,
  useOwedToUser,
  useWorkspaceName,
} from "../../lib/queries";
import { Text } from "../../components/Text";
import { SpendBarChart } from "../../components/SpendBarChart";
import { PickerSheet } from "../../components/PickerSheet";
import { SettingsSheet } from "../../components/SettingsSheet";

function GearIcon({ tint }: { tint: string }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3.2} stroke={tint} strokeWidth={1.8} />
      <Path
        d="M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9.1a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03Z"
        stroke={tint}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [breakdownMonth, setBreakdownMonth] = useState(CURRENT_MONTH);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const { data: user } = useCurrentUser();
  const { data: dashboard, refetch: refetchDashboard } = useDashboard(CURRENT_MONTH);
  const { data: breakdownDashboardOther } = useDashboard(breakdownMonth === CURRENT_MONTH ? undefined : breakdownMonth);
  const { data: monthOptions } = useAvailableMonths();
  // Not month-scoped: this is a running balance, so it must not drop a pending
  // claim the moment the calendar rolls into a new month. amountMinor and
  // receiptCount come from the same underlying filter (pending + approved,
  // reimbursed and rejected both excluded) so the two boxes below can never
  // describe different sets of receipts.
  const { data: owedToUser, refetch: refetchOwed } = useOwedToUser();
  const { data: distanceUnit } = useDisplayDistanceUnit();
  const { data: workspaceName } = useWorkspaceName();
  // Settings sheet shows MY effective rate (a per-user override if one was
  // set, else the workspace default), converted to my display currency —
  // same reasoning as the Mileage tab's rate card.
  const { data: workspaceCurrency } = useHomeCurrency();
  const { data: rateMilli } = useMyMileageRateMilli();
  const { data: rateConv } = useDisplayRate(workspaceCurrency);

  // Tab screens stay mounted, so a mutation made on the receipt detail screen
  // or Mileage already invalidates these queries in the background — this
  // refetch on focus is just a cheap extra guarantee.
  useFocusEffect(
    useCallback(() => {
      refetchDashboard();
      refetchOwed();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (!user || !dashboard || !monthOptions || !owedToUser || !distanceUnit || rateMilli === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: rn(color.bgMobile), alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={rn(color.brand)} />
      </View>
    );
  }

  const breakdownDashboard = breakdownMonth === CURRENT_MONTH ? dashboard : breakdownDashboardOther;
  // Already the personal display currency, not necessarily the workspace's —
  // see lib/data.ts's getDashboard, which converts before this ever reaches here.
  const currency = dashboard.currency;
  const settingsRateMilli =
    rateConv?.rate != null && workspaceCurrency ? convertRateMilliCurrency(rateMilli, workspaceCurrency, currency, rateConv.rate) : rateMilli;

  const greeting = getGreeting();
  const breakdown = breakdownDashboard?.categoryBreakdown.filter((c) => c.pct > 0) ?? [];
  const selectedMonthLabel =
    monthOptions.find((m) => m.value === breakdownMonth)?.label ?? breakdownMonth;

  return (
    <View style={{ flex: 1, backgroundColor: rn(color.bgMobile) }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: 96 + insets.bottom }}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.name}>{user.name}</Text>
          </View>
          <Pressable
            style={styles.settingsButton}
            onPress={() => setSettingsOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <GearIcon tint={rn(color.avatarText)} />
          </Pressable>
        </View>

        {/* Spend / stats row */}
        <View style={styles.statsRow}>
          <View style={styles.darkCard}>
            <Text style={styles.darkCardLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              Spend this month
            </Text>
            <Text style={styles.darkCardValue}>
              {formatMoney(dashboard.stats.monthTotalMinor, currency)}
            </Text>
            <Text style={styles.darkCardSub} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {monthOptions.find((m) => m.value === CURRENT_MONTH)?.label ?? CURRENT_MONTH}
            </Text>
          </View>
          <View style={styles.statColumn}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                Owed to you
              </Text>
              <Text style={styles.statValue}>
                {formatMoney(owedToUser.amountMinor, currency)}
              </Text>
              <Text style={styles.statCaption} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                Incl. mileage
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                Receipts
              </Text>
              {/* Count of the receipts behind "Owed to you" above, not the
                  unrelated "receipts logged this month" figure — the two cards
                  are stacked together specifically so this reads as "that
                  amount, made up of this many receipts". */}
              <Text style={styles.statValue}>{owedToUser.receiptCount}</Text>
              <Text style={styles.statCaption} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                Pending refund
              </Text>
            </View>
          </View>
        </View>

        {/* Spend over time: mirrors apps/web/components/SpendBarChart.tsx. */}
        <View style={styles.card}>
          <SpendBarChart weeklySpend={dashboard.weeklySpend} currency={currency} />
        </View>

        {/* Category breakdown */}
        <View style={[styles.card, { marginBottom: 0 }]}>
          <View style={styles.breakdownHeader}>
            <Text
              style={[styles.cardTitle, { flexShrink: 1, marginRight: 8 }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              Category breakdown
            </Text>
            <Pressable style={styles.monthPicker} onPress={() => setMonthPickerOpen(true)}>
              <Text style={styles.monthPickerLabel}>{selectedMonthLabel}</Text>
            </Pressable>
          </View>

          <View style={{ gap: 12, marginTop: 8 }}>
            {breakdown.length === 0 ? (
              <Text style={styles.emptyText}>No receipts in {selectedMonthLabel}.</Text>
            ) : (
              breakdown.map((c) => {
                const accent = rn(categoryAccent(c.name));
                return (
                  <View key={c.name}>
                    <View style={styles.breakdownRow}>
                      <View style={styles.breakdownNameGroup}>
                        <View style={[styles.dot, { backgroundColor: accent }]} />
                        <Text style={styles.breakdownName}>{c.name}</Text>
                      </View>
                      <View style={styles.breakdownAmountGroup}>
                        <Text style={styles.breakdownPct}>{Math.round(c.pct)}%</Text>
                        <Text style={styles.breakdownAmount}>{formatMoney(c.amountMinor, currency)}</Text>
                      </View>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.min(100, c.pct)}%`, backgroundColor: accent }]} />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      <PickerSheet
        visible={monthPickerOpen}
        title="Select month"
        options={monthOptions}
        selectedValue={breakdownMonth}
        onSelect={setBreakdownMonth}
        onClose={() => setMonthPickerOpen(false)}
      />

      <SettingsSheet
        visible={settingsOpen}
        workspaceName={workspaceName}
        distanceUnit={distanceUnit}
        rateMilli={settingsRateMilli}
        homeCurrency={currency}
        onClose={() => setSettingsOpen(false)}
        onSignOut={() => {
          setSettingsOpen(false);
          // No navigation call needed — app/_layout.tsx's AuthGate is
          // subscribed to the session and redirects to /(auth)/login itself.
          signOut();
        }}
      />
    </View>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  greeting: {
    fontSize: 13,
    color: rn(color.textMuted),
    fontWeight: "500",
  },
  name: {
    fontSize: 21,
    fontWeight: "800",
    marginTop: 2,
    color: rn(color.text),
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  darkCard: {
    flex: 1.4,
    backgroundColor: rn(color.inkPanel),
    borderRadius: 18,
    padding: 16,
  },
  darkCardLabel: {
    fontSize: 12,
    color: rn(color.inkPanelText),
    fontWeight: "600",
  },
  darkCardValue: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 6,
    color: "#fff",
  },
  darkCardSub: {
    fontSize: 12,
    color: rn(color.brand),
    fontWeight: "700",
    marginTop: 6,
  },
  statColumn: {
    flex: 1,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: rn(color.surface),
    borderRadius: 14,
    padding: 12,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  statLabel: {
    fontSize: 11,
    color: rn(color.textMuted),
    fontWeight: "600",
  },
  // Shared by "Owed to you" (a formatted amount) and "Receipts" (a bare count),
  // so this size has to suit both — the amount is the one that constrains it.
  statValue: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
    color: rn(color.text),
  },
  statCaption: {
    fontSize: 10,
    color: rn(color.textFaint),
    marginTop: 2,
  },
  card: {
    backgroundColor: rn(color.surface),
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: rn(color.text),
  },
  settingsButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: rn(color.avatarBg),
    alignItems: "center",
    justifyContent: "center",
  },
  breakdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthPicker: {
    borderWidth: 1,
    borderColor: rn(color.borderStrong),
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  monthPickerLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: rn(color.text),
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  breakdownNameGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownName: {
    fontSize: 13,
    fontWeight: "600",
    color: rn(color.text),
  },
  breakdownAmountGroup: {
    flexDirection: "row",
    gap: 8,
    alignItems: "baseline",
  },
  breakdownPct: {
    fontSize: 12,
    color: rn(color.textMuted),
    fontWeight: "600",
  },
  breakdownAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: rn(color.text),
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    backgroundColor: rn(color.border),
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
  },
  emptyText: {
    fontSize: 13,
    color: rn(color.textMuted),
    textAlign: "center",
    paddingVertical: 12,
  },
});
