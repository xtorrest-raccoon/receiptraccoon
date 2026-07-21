import { useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, reimbursementChip } from "@rr/ui-tokens";
import { rn, rnAlpha } from "../../lib/colors";
import { setCapturedPhoto } from "../../lib/captureStore";
import { Text } from "../../components/Text";

export default function CaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  // The docs are explicit: taking a picture before onCameraReady fires is
  // unsupported and can fail silently. Without this the shutter was tappable
  // the instant the screen mounted, before the native camera had actually
  // started — the failure mode was a shutter that just does nothing.
  const [cameraReady, setCameraReady] = useState(false);

  const onShutter = async () => {
    if (!cameraRef.current || busy || !cameraReady) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        setCapturedPhoto(photo.uri);
        router.push("/capture/processing");
      }
    } catch (err) {
      // Previously swallowed: a failed takePictureAsync looked identical to a
      // shutter tap that did nothing at all, with no way to tell why.
      Alert.alert("Couldn't take photo", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onPickFromLibrary = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Photo library access needed", "Enable it in Settings to import a receipt photo.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.7 });
      const uri = result.canceled ? null : result.assets[0]?.uri;
      if (uri) {
        setCapturedPhoto(uri);
        router.push("/capture/processing");
      }
    } catch (err) {
      Alert.alert("Couldn't import photo", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const onCancel = () => router.navigate("/");

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.permissionContainer]}>
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionBody}>
          ReceiptRaccoon needs your camera to photograph and scan receipts.
        </Text>
        <Pressable style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonLabel}>Grant access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => setCameraReady(true)}
      />

      <View style={styles.frameArea}>
        <View style={styles.frame} />
      </View>

      <View style={[styles.shutterArea, { paddingBottom: 40 + insets.bottom }]}>
        <View style={styles.shutterRow}>
          <View style={styles.sideSlot} />
          <Pressable
            onPress={onShutter}
            style={[styles.shutterOuter, !cameraReady && { opacity: 0.4 }]}
            disabled={busy || !cameraReady}
          >
            <View style={styles.shutterInner} />
          </Pressable>
          <View style={styles.sideSlot}>
            <Pressable onPress={onPickFromLibrary} style={styles.libraryButton} disabled={busy}>
              <LibraryIcon />
            </Pressable>
          </View>
        </View>
      </View>

      <Pressable onPress={onCancel} style={[styles.cancel, { top: insets.top + 8 }]}>
        <Text style={styles.cancelLabel}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// The design's dashed framing rectangle is amber — the same hue @rr/ui-tokens
// already uses for the "pending" status chip — so this borrows that token rather
// than introducing an untracked colour.
const AMBER_FRAME = rnAlpha(reimbursementChip.pending.text, 0.7);

function LibraryIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={14} rx={2} stroke="#fff" strokeWidth={2} />
      <Circle cx={8.5} cy={10} r={1.5} fill="#fff" />
      <Path d="M4 16 L9 11 L13 14.5 L16.5 11 L20 15" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: rn(color.inkPanel),
  },
  frameArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: "78%",
    aspectRatio: 0.72,
    borderWidth: 2.5,
    borderColor: AMBER_FRAME,
    borderStyle: "dashed",
    borderRadius: 16,
  },
  shutterArea: {
    paddingVertical: 26,
    paddingBottom: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "center",
  },
  // Equal-width slots either side of the shutter keep it centred on screen —
  // the library button lives in the right one, the left is an empty spacer.
  sideSlot: {
    flex: 1,
    alignItems: "center",
  },
  libraryButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    // rnAlpha only parses the app's OKLCH design tokens, not arbitrary hex, so a
    // plain rgba() is used directly here instead of misapplying it to "#000000".
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterOuter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
  },
  cancel: {
    position: "absolute",
    left: 16,
  },
  cancelLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    opacity: 0.85,
  },
  permissionContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 14,
  },
  permissionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  permissionBody: {
    color: rn(color.inkPanelText),
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  permissionButton: {
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: rn(color.brand),
  },
  permissionButtonLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13.5,
  },
});
