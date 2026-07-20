import { useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { color, reimbursementAccent } from "@rr/ui-tokens";
import { formatMoney, type ProcessingSegment } from "@rr/shared";
import { rn } from "../lib/colors";
import { Text } from "./Text";

const TRACK_PATH = "M 20 100 A 80 80 0 0 1 180 100";
// Same reasoning as the arc it replaces: the design normalises its dasharray with
// SVG2's `pathLength="100"`, which react-native-svg's types don't expose, so this
// scales onto the arc's real length (a semicircle of radius 80) instead.
const ARC_LENGTH = Math.PI * 80;

/**
 * Multi-segment semicircular ring for the "Receipt processing" card.
 *
 * Replaces the single-value financial-health arc. Each segment's arc length is
 * its share of totalMinor, drawn in the fixed pending/approved/reimbursed/rejected
 * order (via ReceiptProcessing.segments) so a colour always means the same status
 * regardless of which ones are present this window.
 *
 * Generalises the original single-arc stroke-dasharray trick to several stacked
 * segments using the standard donut-chart formula: segment i's dasharray is
 * [length_i, ARC_LENGTH - length_i], its dashoffset is -(sum of lengths before
 * it). Scaling both by an animated 0->1 progress value reproduces the original's
 * "grow in" animation across every segment at once, rather than counting a single
 * score up.
 */
export function ProcessingRing({
  segments,
  totalMinor,
  currency,
  size = 220,
}: {
  segments: readonly ProcessingSegment[];
  totalMinor: number;
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
  }, [totalMinor, segments.length]);

  const height = size * (108 / 200);
  let cumulative = 0;

  return (
    <View style={{ width: size, alignItems: "center" }}>
      <Svg width={size} height={height} viewBox="0 0 200 108">
        <Path d={TRACK_PATH} fill="none" stroke={rn(color.border)} strokeWidth={14} strokeLinecap="round" />
        {segments.map((seg) => {
          const segLen = (seg.pct / 100) * ARC_LENGTH;
          const offsetBefore = cumulative;
          cumulative += segLen;
          return (
            <Path
              key={seg.status}
              d={TRACK_PATH}
              fill="none"
              stroke={rn(reimbursementAccent[seg.status])}
              strokeWidth={14}
              strokeLinecap="round"
              strokeDasharray={`${segLen * progress} ${ARC_LENGTH - segLen * progress + 0.01}`}
              strokeDashoffset={-offsetBefore * progress}
            />
          );
        })}
      </Svg>
      <View style={styles.overlay} pointerEvents="none">
        <Text style={styles.amountText}>{formatMoney(Math.round(totalMinor * progress), currency)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 6,
    alignItems: "center",
  },
  amountText: {
    fontSize: 24,
    fontWeight: "800",
    color: rn(color.text),
  },
});
