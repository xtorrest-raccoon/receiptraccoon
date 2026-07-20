import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    // Required for any gesture-handler component to receive touches — without it
    // the swipe-to-delete rows silently do nothing.
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="receipt/[id]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="capture/processing" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="capture/confirm" options={{ animation: "slide_from_right", gestureEnabled: false }} />
        <Stack.Screen name="capture/saved" options={{ animation: "fade", gestureEnabled: false }} />
      </Stack>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
