import { useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { color } from "@rr/ui-tokens";
import { formatMoneyCompact } from "@rr/shared";
import { rn } from "../lib/colors";
import { Text } from "./Text";

const TRACK_PATH = "M 20 100 A 80 80 0 0 1 180 100";
const ARC_RADIUS = 80;
const ARC_CENTRE = { x: 100, y: 100 };
// The design normalises its dasharray with SVG2's `pathLength="100"`, which
// react-native-svg's types don't expose, so this scales onto the arc's real
// length (a semicircle of radius 80) instead.
const ARC_LENGTH = Math.PI * ARC_RADIUS;

/**
 * Where a 0-1 fraction sits along the semicircular track, for the pace marker.
 * The arc sweeps from (20,100) at angle PI round to (180,100) at angle 0.
 */
function pointOnArc(fraction: number): { x: number; y: number } {
  const angle = Math.PI * (1 - Math.min(1, Math.max(0, fraction)));
  return {
    x: ARC_CENTRE.x + ARC_RADIUS * Math.cos(angle),
    y: ARC_CENTRE.y - ARC_RADIUS * Math.sin(angle),
  };
}

/**
 * Spending pacing ring.
 *
 * The full arc is LAST MONTH'S TOTAL, so the ring's 100% means something
 * concrete rather than being an arbitrary scale: a full ring means this month
 * has already matched everything spent last month. The fill is this month's
 * spend so far.
 *
 * The tick mark is where the fill would sit if spending were perfectly flat —
 * i.e. how far through the month we are. Fill past the marker means running
 * ahead of last month; short of it means running behind. That comparison is the
 * whole point of the card, and it is why the marker matters more than the exact
 * fill percentage.
 */
export function SpendPacingRing({
  monthToDateMinor,
  prevMonthTotalMinor,
  deltaPct,
  elapsedFraction,
  currency,
  size = 220,
}: {
  monthToDateMinor: number;
  prevMonthTotalMinor: number;
  deltaPct: number;
  elapsedFraction: number;
  currency: string;
  size?: number;
}) {
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    setProgress(0);
    timer.current = setInterval(() => {
      setProgress((cur) => {
        const next = cur + 1 / 32;
        if (next >= 1) {
          if (timer.current) clearInterval(timer.current);
          return 1;
        }
        return next;
      });
    }, 25);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthToDateMinor, prevMonthTotalMinor]);

  // With no previous month to compare against, a full ring would imply "matched
  // last month" when there is nothing to match — show it empty instead.
  const rawFill = prevMonthTotalMinor > 0 ? monthToDateMinor / prevMonthTotalMinor : 0;
  const fill = Math.min(1, rawFill);
  const fillLen = fill * ARC_LENGTH;

  const height = size * (108 / 200);
  // Spend up is bad, flat-or-down is good — same boundary used for this figure
  // everywhere else it appears.
  const deltaColor = deltaPct > 0 ? color.up : color.down;
  const marker = pointOnArc(elapsedFraction);

  return (
    <View style={{ width: size, alignItems: "center" }}>
      <Svg width={size} height={height} viewBox="0 0 200 108">
        <Path d={TRACK_PATH} fill="none" stroke={rn(color.border)} strokeWidth={14} strokeLinecap="round" />
        <Path
          d={TRACK_PATH}
          fill="none"
          stroke={rn(deltaColor)}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={`${fillLen * progress} ${ARC_LENGTH - fillLen * progress + 0.01}`}
          strokeDashoffset={0}
        />
        {/* Pace marker: where a flat month would have reached by today. */}
        <Circle cx={marker.x} cy={marker.y} r={4.5} fill={rn(color.surface)} />
        <Circle
          cx={marker.x}
          cy={marker.y}
          r={4.5}
          fill="none"
          stroke={rn(color.textMuted)}
          strokeWidth={2}
        />
      </Svg>
      <View style={styles.overlay} pointerEvents="none">
        {/* Compact (no cents): inside a ring this is a sense-of-scale figure,
            not an amount anyone reconciles against — the exact total is on the
            "Spend this month" card above. */}
        <Text style={styles.amountText}>
          {formatMoneyCompact(Math.round(monthToDateMinor * progress), currency)}
        </Text>
        <Text style={styles.caption}>of {formatMoneyCompact(prevMonthTotalMinor, currency)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 2,
    alignItems: "center",
  },
  amountText: {
    fontSize: 19,
    fontWeight: "800",
    color: rn(color.text),
  },
  caption: {
    fontSize: 11,
    color: rn(color.textMuted),
    fontWeight: "600",
    marginTop: 1,
  },
});
