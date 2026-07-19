import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, healthChip } from "@rr/ui-tokens";
import { categoryAccent, formatMoney } from "@rr/shared";
import { rn } from "../../lib/colors";
import {
  getAvailableMonths,
  getCurrentUser,
  getDashboard,
  getReimbursableInclMileageMinor,
  CURRENT_MONTH,
} from "../../lib/data";
import { Text } from "../../components/Text";
import { ArcGauge } from "../../components/ArcGauge";
import { RaccoonMark } from "../../components/RaccoonMark";
import { PickerSheet } from "../../components/PickerSheet";

const HEALTH_CHIP: Record<string, { bg: string; text: string }> = {
  "On track": healthChip.onTrack,
  "Needs attention": healthChip.needsAttention,
  "At risk": healthChip.atRisk,
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [breakdownMonth, setBreakdownMonth] = useState(CURRENT_MONTH);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  const user = getCurrentUser();
  const dashboard = useMemo(() => getDashboard(CURRENT_MONTH), []);
  const breakdownDashboard = useMemo(
    () => (breakdownMonth === CURRENT_MONTH ? dashboard : getDashboard(breakdownMonth)),
    [breakdownMonth, dashboard],
  );
  const monthOptions = useMemo(() => getAvailableMonths(), []);
  const reimbursableInclMileage = useMemo(() => getReimbursableInclMileageMinor(CURRENT_MONTH), []);
  const currency = dashboard.currency;

  const greeting = getGreeting();
  const chip = HEALTH_CHIP[dashboard.health.label] ?? healthChip.needsAttention;
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
          <View style={styles.logoTile}>
            <RaccoonMark size={34} />
          </View>
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
                {formatMoney(reimbursableInclMileage, currency)}
              </Text>
              <Text style={styles.statCaption}>Incl. mileage</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Receipts</Text>
              <Text style={styles.statValue}>{dashboard.stats.receiptCount}</Text>
            </View>
          </View>
        </View>

        {/* Financial health */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Financial health</Text>
          <View style={{ alignItems: "center", marginTop: 6 }}>
            <ArcGauge score={dashboard.health.score} size={220} />
          </View>
          <View style={{ alignItems: "center", marginTop: 2 }}>
            <View style={[styles.healthChip, { backgroundColor: rn(chip.bg) }]}>
              <Text style={[styles.healthChipLabel, { color: rn(chip.text) }]}>{dashboard.health.label}</Text>
            </View>
          </View>
          <Text style={styles.explanation}>{dashboard.health.explanation}</Text>

          {dashboard.health.factors.length > 0 && (
            <View style={styles.factorList}>
              {dashboard.health.factors.map((f) => (
                <View key={f.key} style={styles.factorRow}>
                  <Text style={styles.factorLabel}>
                    {f.label} ({f.weight}%)
                  </Text>
                  <Text style={styles.factorScore}>{Math.round(f.score)}</Text>
                </View>
              ))}
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
  logoTile: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: rn(color.brandSoft),
    alignItems: "center",
    justifyContent: "center",
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
  healthChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  healthChipLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  explanation: {
    fontSize: 12,
    color: rn(color.textMuted),
    textAlign: "center",
    marginTop: 10,
    lineHeight: 18,
  },
  factorList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: rn(color.borderSubtle),
    gap: 8,
  },
  factorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  factorLabel: {
    fontSize: 11.5,
    color: rn(color.text),
    fontWeight: "500",
  },
  factorScore: {
    fontSize: 11.5,
    color: rn(color.textMuted),
    fontWeight: "700",
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
