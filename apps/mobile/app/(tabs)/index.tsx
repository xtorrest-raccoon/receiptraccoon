import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, reimbursementAccent, reimbursementChip } from "@rr/ui-tokens";
import { categoryAccent, formatMoney, summarizeProcessingStatus } from "@rr/shared";
import { rn } from "../../lib/colors";
import {
  getAvailableMonths,
  getCurrentUser,
  getDashboard,
  getOwedToUserSummary,
  CURRENT_MONTH,
  CURRENCIES,
  setHomeCurrency,
  getDistanceUnit,
  setDistanceUnit,
  getMileageRateMilli,
  setMileageRateMilli,
} from "../../lib/data";
import type { DistanceUnit } from "@rr/shared";
import { Text } from "../../components/Text";
import { ProcessingRing } from "../../components/ProcessingRing";
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
  // Mirrors the workspace setting so the sheet re-renders on change; the source of
  // truth stays in the data layer, shared with the Mileage screen.
  const [distanceUnit, setDistanceUnitState] = useState<DistanceUnit>(getDistanceUnit());
  const [rateMilli, setRateMilliState] = useState(getMileageRateMilli());

  // Bumped whenever the screen regains focus. Tab screens stay mounted, so
  // without this the dashboard totals would not reflect a receipt edited on the
  // detail screen or a trip added on Mileage.
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(useCallback(() => setRefreshKey((n) => n + 1), []));

  const user = getCurrentUser();
  const dashboard = useMemo(() => getDashboard(CURRENT_MONTH), [refreshKey]);
  const breakdownDashboard = useMemo(
    () => (breakdownMonth === CURRENT_MONTH ? dashboard : getDashboard(breakdownMonth)),
    [breakdownMonth, dashboard],
  );
  const monthOptions = useMemo(() => getAvailableMonths(), []);
  // Not month-scoped: this is a running balance, so it must not drop a pending
  // claim the moment the calendar rolls into a new month. amountMinor and
  // receiptCount come from the same underlying filter (pending + approved,
  // reimbursed and rejected both excluded) so the two boxes below can never
  // describe different sets of receipts.
  const owedToUser = useMemo(() => getOwedToUserSummary(), [refreshKey]);
  const currency = dashboard.currency;
  // One-line status under the ring. The decision (which case, and the raw
  // numbers) comes from shared/processing.ts so mobile and web cannot describe
  // the same data differently — only the money formatting happens here.
  const processingStatus = summarizeProcessingStatus(dashboard.processing);
  const processingStatusText =
    processingStatus.kind === "empty"
      ? "No receipts in the last 30 days."
      : processingStatus.kind === "clear"
        ? "All spend from the last 30 days has been resolved."
        : `${Math.round(processingStatus.pct)}% of spend (${formatMoney(processingStatus.amountMinor, currency)}) is still awaiting reimbursement.`;

  const greeting = getGreeting();
  const breakdown = breakdownDashboard.categoryBreakdown.filter((c) => c.pct > 0);
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
            <Text style={styles.darkCardLabel}>Spend this month</Text>
            <Text style={styles.darkCardValue}>
              {formatMoney(dashboard.stats.monthTotalMinor, currency)}
            </Text>
            <Text style={styles.darkCardSub}>{monthOptions.find((m) => m.value === CURRENT_MONTH)?.label ?? CURRENT_MONTH}</Text>
          </View>
          <View style={styles.statColumn}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Owed to you</Text>
              <Text style={styles.statValue}>
                {formatMoney(owedToUser.amountMinor, currency)}
              </Text>
              <Text style={styles.statCaption}>Incl. mileage</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Receipts</Text>
              {/* Count of the receipts behind "Owed to you" above, not the
                  unrelated "receipts logged this month" figure — the two cards
                  are stacked together specifically so this reads as "that
                  amount, made up of this many receipts". */}
              <Text style={styles.statValue}>{owedToUser.receiptCount}</Text>
              <Text style={styles.statCaption}>Pending reimbursement</Text>
            </View>
          </View>
        </View>

        {/* Ring segments are each status's share of claimed spend in the
            trailing 30 days; the legend below repeats the same figures as text,
            same pairing as the category breakdown card underneath. */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Spending vs Last Month</Text>
          <Text style={styles.cardSubtitle}>Last 30 days</Text>
          <View style={{ alignItems: "center", marginTop: 6 }}>
            <ProcessingRing
              segments={dashboard.processing.segments}
              totalMinor={dashboard.processing.totalMinor}
              currency={currency}
              size={220}
            />
          </View>
          <Text style={styles.statusCaption}>{processingStatusText}</Text>

          {dashboard.processing.segments.length === 0 ? null : (
            <View style={{ gap: 10, marginTop: 8 }}>
              {dashboard.processing.segments.map((seg) => {
                const accent = rn(reimbursementAccent[seg.status]);
                return (
                  <View key={seg.status}>
                    <View style={styles.breakdownRow}>
                      <View style={styles.breakdownNameGroup}>
                        <View style={[styles.dot, { backgroundColor: accent }]} />
                        <Text style={styles.breakdownName}>{reimbursementChip[seg.status].label}</Text>
                      </View>
                      <View style={styles.breakdownAmountGroup}>
                        <Text style={styles.breakdownPct}>{Math.round(seg.pct)}%</Text>
                        <Text style={styles.breakdownAmount}>{formatMoney(seg.amountMinor, currency)}</Text>
                      </View>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${Math.min(100, seg.pct)}%`, backgroundColor: accent }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Category breakdown */}
        <View style={[styles.card, { marginBottom: 0 }]}>
          <View style={styles.breakdownHeader}>
            <Text style={styles.cardTitle}>Category breakdown</Text>
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
        currencies={CURRENCIES}
        initial={{ distanceUnit, rateMilli, homeCurrency: currency }}
        onSave={(draft) => {
          setHomeCurrency(draft.homeCurrency);
          // Unit first: setDistanceUnit converts the stored rate, and the explicit
          // rate below must win over that conversion.
          setDistanceUnit(draft.distanceUnit);
          setMileageRateMilli(draft.rateMilli);

          setDistanceUnitState(draft.distanceUnit);
          setRateMilliState(draft.rateMilli);
          // Currency change re-expresses every amount, so drop memoised totals.
          setRefreshKey((n) => n + 1);
        }}
        onClose={() => setSettingsOpen(false)}
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
    fontSize: 26,
    fontWeight: "800",
    marginTop: 8,
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
  statValue: {
    fontSize: 17,
    fontWeight: "800",
    marginTop: 5,
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
  cardSubtitle: {
    fontSize: 12,
    color: rn(color.textMuted),
    marginTop: 2,
  },
  statusCaption: {
    fontSize: 12,
    color: rn(color.textMuted),
    textAlign: "center",
    marginTop: 4,
    lineHeight: 17,
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
