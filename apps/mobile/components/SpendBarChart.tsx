import { View, StyleSheet } from "react-native";
import { color, healthChip, radius } from "@rr/ui-tokens";
import { formatMoneyCompact, formatShortDate } from "@rr/shared";
import { rn } from "../lib/colors";
import { Text } from "./Text";

const BAR_MAX_HEIGHT = 110;

/** Mirrors apps/web/components/SpendBarChart.tsx — same data, same shape, RN primitives instead of divs. */
export function SpendBarChart({
  weeklySpend,
  currency,
}: {
  weeklySpend: { weekStart: string; totalMinor: number }[];
  currency: string;
}) {
  const max = Math.max(...weeklySpend.map((w) => w.totalMinor), 1);

  return (
    <View>
      <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        Spend over time
      </Text>
      <Text style={styles.subtitle}>Last {weeklySpend.length} weeks</Text>
      <View style={styles.row}>
        {weeklySpend.map((wk, i) => {
          const heightPx = Math.max(8, Math.round((wk.totalMinor / max) * BAR_MAX_HEIGHT));
          const isLast = i === weeklySpend.length - 1;
          return (
            <View key={wk.weekStart} style={styles.column}>
              <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                {formatMoneyCompact(wk.totalMinor, currency)}
              </Text>
              <View
                style={[
                  styles.bar,
                  { height: heightPx, backgroundColor: rn(isLast ? color.brand : healthChip.onTrack.bg) },
                ]}
              />
              <Text style={styles.weekLabel}>{formatShortDate(wk.weekStart)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: rn(color.text),
  },
  subtitle: {
    fontSize: 12,
    color: rn(color.textMuted),
    marginTop: 2,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: BAR_MAX_HEIGHT + 46,
  },
  column: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
    gap: 6,
  },
  amount: {
    fontSize: 10.5,
    fontWeight: "700",
    color: rn(color.textStrong),
  },
  bar: {
    width: "60%",
    maxWidth: 26,
    borderRadius: radius.lg - 4,
  },
  weekLabel: {
    fontSize: 10,
    color: rn(color.textFaint),
  },
});
