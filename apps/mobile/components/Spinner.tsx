import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";
import { color } from "@rr/ui-tokens";
import { rn } from "../lib/colors";

/** Ports the design's `rr-spin` CSS keyframe: a partial ring rotating at 0.9s/turn. */
export function Spinner({ size = 56 }: { size?: number }) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.max(3, size * 0.09),
          transform: [{ rotate }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  ring: {
    borderColor: rn(color.brandSoft),
    borderTopColor: rn(color.brand),
  },
});
