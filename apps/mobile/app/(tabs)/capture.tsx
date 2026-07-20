import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
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

  const onShutter = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        setCapturedPhoto(photo.uri);
        router.push("/capture/processing");
      }
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
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      <View style={styles.frameArea}>
        <View style={styles.frame} />
      </View>

      <View style={styles.shutterArea}>
        <Pressable onPress={onShutter} style={styles.shutterOuter} disabled={busy}>
          <View style={styles.shutterInner} />
        </Pressable>
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
