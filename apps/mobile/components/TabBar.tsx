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
 * Custom bottom tab bar: blurred translucent background, Capture as a green
 * circular button in the centre. Passed as the `tabBar` render prop to
 * expo-router's <Tabs>.
 *
 * Departs from the design in one respect: the mockup raises Capture 22px above
 * the bar. That was drawn against a plain 82px bar in a fixed 390x844 frame; on a
 * real device the bar also carries the home-indicator inset, and the raised button
 * read as escaping the bar rather than sitting proud of it. It now sits flush.
 *
 * ICON_SLOT is what keeps all four labels on one baseline. The Capture circle is
 * 36px while the other glyphs are 22px, so without a fixed-height slot each label
 * would sit at a different vertical position.
 */
const CAPTURE_SIZE = 36;
const ICON_SLOT = CAPTURE_SIZE;

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // The capture screen is a full-screen live camera view — this floating bar
  // (82px + the bottom inset) sits on top of every tab screen and was covering
  // its shutter button entirely, not just visually crowding it. Screens opt out
  // via the standard tabBarStyle:{display:"none"} option (set on the capture
  // route in _layout.tsx) rather than hardcoding the route name here, so any
  // future full-screen tab can do the same.
  const focusedOptions = descriptors[state.routes[state.index]!.key]?.options;
  if (focusedOptions?.tabBarStyle && (focusedOptions.tabBarStyle as { display?: string }).display === "none") {
    return null;
  }

  return (
    <View style={[styles.wrap, { height: layout.tabBarHeight + insets.bottom }]}>
      <BlurView intensity={40} tint="light" style={styles.chrome} />
      <View style={[styles.overlay, { borderTopColor: rn(color.border) }]} />
      <View style={[styles.row, { paddingBottom: insets.bottom }]}>
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
              <View style={styles.iconSlot}>
                {isCapture ? (
                  <View style={styles.captureButton}>{meta.icon(tint)}</View>
                ) : (
                  meta.icon(tint)
                )}
              </View>
              <Text style={[styles.tabLabel, { color: isCapture ? rn(color.brandSoftText) : tint }]}>
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
  chrome: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Near-opaque. At 0.75 the blur was not enough to stop scrolling content
    // reading through the bar and colliding with the tab labels on a real device.
    backgroundColor: rnAlpha(color.bgMobile, 0.97),
    borderTopWidth: 1,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    // Centred rather than top-aligned, so the group sits lower in the bar and the
    // home-indicator inset does not push it upward.
    alignItems: "center",
  },
  item: {
    alignItems: "center",
    gap: 5,
    minWidth: 56,
  },
  // Fixed-height slot: this is what puts all four labels on the same baseline
  // despite the Capture circle being larger than the other glyphs.
  iconSlot: {
    height: ICON_SLOT,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  captureButton: {
    width: CAPTURE_SIZE,
    height: CAPTURE_SIZE,
    borderRadius: CAPTURE_SIZE / 2,
    backgroundColor: ACTIVE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ACTIVE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  // Scaled with CAPTURE_SIZE so the glyph keeps its proportion inside the circle.
  captureGlyphBox: {
    width: 18,
    height: 14,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 3,
  },
  captureGlyphBump: {
    position: "absolute",
    top: -4,
    left: 5,
    width: 7,
    height: 3,
    backgroundColor: "#fff",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
});
