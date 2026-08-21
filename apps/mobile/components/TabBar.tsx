import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import Svg, { Path, Circle, Rect, Line } from "react-native-svg";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
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
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        fill={tint}
        d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"
      />
    </Svg>
  );
}

function AnalyticsIcon({ tint }: { tint: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={13} width={4} height={7} rx={1} fill={tint} />
      <Rect x={10} y={9} width={4} height={11} rx={1} fill={tint} />
      <Rect x={16} y={5} width={4} height={15} rx={1} fill={tint} />
    </Svg>
  );
}

function CaptureIcon({ tint }: { tint: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 6.5l.9-1.7a1.4 1.4 0 0 1 1.24-.75h5.72a1.4 1.4 0 0 1 1.24.75L17 6.5h2a1.6 1.6 0 0 1 1.6 1.6v9.3A1.6 1.6 0 0 1 19 19H5a1.6 1.6 0 0 1-1.6-1.6V8.1A1.6 1.6 0 0 1 5 6.5h2z"
        stroke={tint}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12.5} r={3.4} stroke={tint} strokeWidth={1.7} />
    </Svg>
  );
}

// Route name -> translation key under "tabs.*" (route names don't line up
// 1:1 with the key names -- "index" is the Home tab).
const TAB_TRANSLATION_KEY: Record<string, "home" | "analytics" | "capture" | "receipts" | "mileage"> = {
  index: "home",
  analytics: "analytics",
  capture: "capture",
  receipts: "receipts",
  mileage: "mileage",
};

const TAB_ICON: Record<string, (tint: string) => ReactNode> = {
  index: (t) => <HomeIcon tint={t} />,
  analytics: (t) => <AnalyticsIcon tint={t} />,
  capture: (t) => <CaptureIcon tint={t} />,
  receipts: (t) => <ReceiptsIcon tint={t} />,
  mileage: (t) => <MileageIcon tint={t} />,
};

/**
 * Custom bottom tab bar: blurred translucent background. Passed as the
 * `tabBar` render prop to expo-router's <Tabs>.
 *
 * ICON_SLOT keeps all four labels on one baseline regardless of whether the
 * focused pill is showing behind the glyph.
 */
const ICON_SLOT = 36;

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
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
          const translationKey = TAB_TRANSLATION_KEY[route.name];
          const icon = TAB_ICON[route.name];
          if (!translationKey || !icon) return null;
          const focused = state.index === index;
          // Icon glyphs stay a single neutral grey always -- focus is shown by
          // the green circle behind them, not by recoloring the glyph itself.
          const labelTint = focused ? ACTIVE : INACTIVE;

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable key={route.key} onPress={onPress} style={styles.item} accessibilityRole="button">
              <View style={styles.iconSlot}>
                {focused ? (
                  <View style={styles.activeIconCircle}>{icon(INACTIVE)}</View>
                ) : (
                  icon(INACTIVE)
                )}
              </View>
              <Text style={[styles.tabLabel, { color: labelTint }]}>{t(`tabs.${translationKey}`)}</Text>
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
  // Fixed-height slot: keeps all four labels on the same baseline regardless
  // of whether the focused pill is showing behind a given icon.
  iconSlot: {
    height: ICON_SLOT,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "700",
  },
  // The focused indicator behind a tab's icon -- a soft green pill behind
  // the (still-grey) glyph, rather than recoloring the glyph itself. A
  // shade darker than @rr/ui-tokens' own brandSoft (93% lightness), which
  // read as too faint to notice against the bar's background.
  activeIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: rn("oklch(84% 0.09 152)"),
    alignItems: "center",
    justifyContent: "center",
  },
});
