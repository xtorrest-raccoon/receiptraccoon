import { useRef } from "react";
import { Animated, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Image } from "expo-image";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

/**
 * Pinch-to-zoom, drag-to-pan-when-zoomed, and double-tap, for the receipt
 * photo viewer. Built on gesture-handler's plain JS-thread callbacks driving
 * React Native's own Animated API — react-native-reanimated is deliberately
 * not installed (see SwipeToDelete's comment: it would need a babel config
 * change and a rebuild for one screen).
 *
 * Scale/pan are tracked in refs rather than read back from the Animated
 * values (which has no simple synchronous getter) — each gesture computes
 * its own next value and stores it as the new baseline on release.
 */
export function ZoomableImage({ uri, style }: { uri: string; style?: StyleProp<ViewStyle> }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translate = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const baseScale = useRef(1);
  const pinchStartScale = useRef(1);
  const currentScale = useRef(1);
  const baseTranslate = useRef({ x: 0, y: 0 });
  const panStartTranslate = useRef({ x: 0, y: 0 });
  const currentTranslate = useRef({ x: 0, y: 0 });

  const resetZoom = () => {
    baseScale.current = 1;
    currentScale.current = 1;
    baseTranslate.current = { x: 0, y: 0 };
    currentTranslate.current = { x: 0, y: 0 };
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translate, { toValue: { x: 0, y: 0 }, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      pinchStartScale.current = baseScale.current;
    })
    .onUpdate((e) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchStartScale.current * e.scale));
      currentScale.current = next;
      scale.setValue(next);
    })
    .onEnd(() => {
      if (currentScale.current < 1.05) {
        resetZoom();
        return;
      }
      baseScale.current = currentScale.current;
    });

  const pan = Gesture.Pan()
    .onStart(() => {
      panStartTranslate.current = { ...baseTranslate.current };
    })
    .onUpdate((e) => {
      // No panning at rest — only meaningful once zoomed in past 1x.
      if (baseScale.current <= 1.001) return;
      const next = { x: panStartTranslate.current.x + e.translationX, y: panStartTranslate.current.y + e.translationY };
      currentTranslate.current = next;
      translate.setValue(next);
    })
    .onEnd(() => {
      if (baseScale.current <= 1.001) return;
      baseTranslate.current = currentTranslate.current;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((_e, success) => {
      if (!success) return;
      if (baseScale.current > 1.01) {
        resetZoom();
      } else {
        baseScale.current = DOUBLE_TAP_SCALE;
        currentScale.current = DOUBLE_TAP_SCALE;
        Animated.timing(scale, { toValue: DOUBLE_TAP_SCALE, duration: 200, useNativeDriver: true }).start();
      }
    });

  const composed = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[style, { transform: [{ scale }, ...translate.getTranslateTransform()] }]}
      >
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      </Animated.View>
    </GestureDetector>
  );
}
