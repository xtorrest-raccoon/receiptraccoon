import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import Svg, { Path, Circle, Rect, Line } from "react-native-svg";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, layout } from "@rr/ui-tokens";
import { rn, rnAlpha } from "../lib/colors";
import { Text } from "./Text";

const ACTIVE = rn(color.brand);
const INACTIVE = rn(color.textFaint);

function HomeIcon({ tint }: { tint: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 11 L12 4 L20 11 V20 H14 V14 H10 V20 H4 Z" stroke={tint} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

function ReceiptsIcon({ tint }: { tint: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={5} y={3} width={14} height={18} rx={2} stroke={tint} strokeWidth={2} />
      <Line x1={8.5} y1={8} x2={15.5} y2={8} stroke={tint} strokeWidth={2} />
      <Line x1={8.5} y1={12} x2={15.5} y2={12} stroke={tint} strokeWidth={2} />
      <Line x1={8.5} y1={16} x2={12.5} y2={16} stroke={tint} strokeWidth={2} />
    </Svg>
  );
}

function MileageIcon({ tint }: { tint: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={tint} strokeWidth={2} />
      <Path d="M8 13 L11 10 L13 12 L16 8" stroke={tint} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function CaptureGlyph() {
  return (
    <View style={styles.captureGlyphBox}>
      <View style={styles.captureGlyphBump} />
    </View>
  );
}

const TAB_META: Record<string, { label: string; icon: (tint: string) => ReactNode }> = {
  index: { label: "Home", icon: (t) => <HomeIcon tint={t} /> },
  capture: { label: "Capture", icon: () => <CaptureGlyph /> },
  receipts: { label: "Receipts", icon: (t) => <ReceiptsIcon tint={t} /> },
  mileage: { label: "Mileage", icon: (t) => <MileageIcon tint={t} /> },
};

/**
 * Custom bottom tab bar matching the design: blurred translucent background,
 * 82px tall, Capture raised as a green circular button in the centre with a
 * glow shadow. Passed as the `tabBar` render prop to expo-router's <Tabs>.
 */
/**
 * How far the Capture button rises above the bar. The wrap is extended upward by
 * this much and left transparent, rather than letting the button overflow the
 * container: a negative margin escaping its parent gets clipped, and even with
 * clipping disabled React Native does not reliably deliver touches outside a
 * parent's bounds — the top of the button would look right but not respond.
 */
const CAPTURE_OVERHANG = 22;

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      // box-none so the transparent overhang strip does not swallow taps meant
      // for the screen content behind it.
      pointerEvents="box-none"
      style={[styles.wrap, { height: layout.tabBarHeight + insets.bottom + CAPTURE_OVERHANG }]}
    >
      <BlurView intensity={40} tint="light" style={[styles.chrome, { top: CAPTURE_OVERHANG }]} />
      <View style={[styles.overlay, { top: CAPTURE_OVERHANG, borderTopColor: rn(color.border) }]} />
      <View
        pointerEvents="box-none"
        style={[styles.row, { paddingTop: CAPTURE_OVERHANG + 10, paddingBottom: insets.bottom }]}
      >
        {state.routes.map((route, index) => {
          const meta = TAB_META[route.name];
          if (!meta) return null;
          const focused = state.index === index;
          const tint = focused ? ACTIVE : INACTIVE;
          const isCapture = route.name === "capture";

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable key={route.key} onPress={onPress} style={styles.item} accessibilityRole="button">
              {isCapture ? (
                <View style={styles.captureButton}>{meta.icon(tint)}</View>
              ) : (
                meta.icon(tint)
              )}
              <Text style={[styles.tabLabel, { color: isCapture ? rn(color.brandSoftText) : tint, marginTop: isCapture ? 4 : 4 }]}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  // Blur and tint cover only the bar itself, not the transparent overhang above it.
  chrome: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: rnAlpha(color.bgMobile, 0.75),
    borderTopWidth: 1,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
  },
  item: {
    alignItems: "center",
    gap: 4,
    minWidth: 56,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  captureButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ACTIVE,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -22,
    shadowColor: ACTIVE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  captureGlyphBox: {
    width: 22,
    height: 18,
    borderWidth: 2.5,
    borderColor: "#fff",
    borderRadius: 4,
  },
  captureGlyphBump: {
    position: "absolute",
    top: -5,
    left: 6,
    width: 8,
    height: 4,
    backgroundColor: "#fff",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
});
