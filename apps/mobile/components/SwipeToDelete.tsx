import { useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { useTranslation } from "react-i18next";
import { color } from "@rr/ui-tokens";
import { rn } from "../lib/colors";
import { Text } from "./Text";

/**
 * iOS-style swipe-left-to-delete row.
 *
 * Uses gesture-handler's legacy Swipeable, which is built on React Native's own
 * Animated. The newer ReanimatedSwipeable would need react-native-reanimated,
 * which is not installed — adding it means a babel config change and a rebuild,
 * and would risk the working Expo Go preview for no visible gain here.
 *
 * `enabled` is false for receipts that cannot be deleted, in which case the row
 * simply does not swipe rather than revealing a button that then refuses.
 */
export function SwipeToDelete({
  children,
  onDelete,
  enabled = true,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  enabled?: boolean;
}) {
  const { t } = useTranslation();
  const ref = useRef<Swipeable>(null);

  if (!enabled) return <>{children}</>;

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    // Label slides in with the drag rather than appearing fully formed, which is
    // what makes it feel native.
    const scale = dragX.interpolate({
      inputRange: [-96, -48, 0],
      outputRange: [1, 0.9, 0.6],
      extrapolate: "clamp",
    });

    return (
      <View style={styles.actionWrap}>
        <Pressable
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={t("common.delete")}
          onPress={() => {
            ref.current?.close();
            onDelete();
          }}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <Text style={styles.actionLabel}>{t("common.delete")}</Text>
          </Animated.View>
        </Pressable>
      </View>
    );
  };

  return (
    <Swipeable
      ref={ref}
      renderRightActions={renderRightActions}
      // Deliberately no full-swipe-to-delete: deleting a receipt is destructive
      // and irreversible, so it takes a tap on the revealed button.
      rightThreshold={40}
      overshootRight={false}
      friction={2}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actionWrap: {
    justifyContent: "center",
    marginLeft: 8,
  },
  action: {
    backgroundColor: rn(color.up),
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    width: 88,
    height: "100%",
  },
  actionLabel: {
    color: "#fff",
    fontSize: 13.5,
    fontWeight: "700",
  },
});
