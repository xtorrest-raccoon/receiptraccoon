import { useEffect, useRef, useState } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { color } from "@rr/ui-tokens";
import { rn } from "../lib/colors";
import { Text } from "./Text";

const TRACK_PATH = "M 20 100 A 80 80 0 0 1 180 100";
// The design normalises its dasharray with SVG2's `pathLength="100"`, which
// react-native-svg's type definitions don't expose. Scaling the 0-100 score onto
// the arc's real length (a semicircle of radius 80) gets the identical result.
const ARC_LENGTH = Math.PI * 80;

/**
 * The financial-health semicircular arc, ported from the design's SVG. The design
 * counts the score up with a setInterval-driven state tick (25ms steps of +/-3)
 * rather than a CSS transition; this mirrors that exactly since there's no CSS
 * transition equivalent worth reaching for react-native-reanimated over.
 */
export function ArcGauge({ score, size = 220 }: { score: number; size?: number }) {
  const [animated, setAnimated] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    const step = score >= animated ? 3 : -3;
    timer.current = setInterval(() => {
      setAnimated((cur) => {
        const next = cur + step;
        if ((step > 0 && next >= score) || (step < 0 && next <= score)) {
          if (timer.current) clearInterval(timer.current);
          return score;
        }
        return next;
      });
    }, 25);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  const height = size * (108 / 200);

  return (
    <View style={{ width: size, alignItems: "center" }}>
      <Svg width={size} height={height} viewBox="0 0 200 108">
        <Path d={TRACK_PATH} fill="none" stroke={rn(color.border)} strokeWidth={14} strokeLinecap="round" />
        <Path
          d={TRACK_PATH}
          fill="none"
          stroke={rn(color.brand)}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={`${(animated / 100) * ARC_LENGTH} ${ARC_LENGTH}`}
          strokeDashoffset={0}
        />
      </Svg>
      <View style={styles.scoreOverlay} pointerEvents="none">
        <Text style={styles.scoreText}>{animated}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scoreOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 6,
    alignItems: "center",
  },
  scoreText: {
    fontSize: 30,
    fontWeight: "800",
    color: rn(color.text),
  },
});
