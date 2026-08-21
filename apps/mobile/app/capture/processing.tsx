import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { color } from "@rr/ui-tokens";
import { rn } from "../../lib/colors";
import { RetakePhotoError, TODAY, blankDraftReceipt, extractReceiptFromPhoto } from "../../lib/data";
import { getCapturedPhoto, setDraftReceipt } from "../../lib/captureStore";
import { Spinner } from "../../components/Spinner";
import { Text } from "../../components/Text";

/**
 * Real extraction takes 3-8 seconds and sometimes longer (see OCR_PLAN.md) —
 * unlike the design mockup's fixed 1.4s timeout, this screen has to handle a
 * slow response without looking stuck, hence the "still working" message after
 * 10 seconds.
 */
const STILL_WORKING_AFTER_MS = 10_000;

export default function ProcessingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [stillWorking, setStillWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsRetake, setNeedsRetake] = useState(false);
  // Bumped to retry: re-running the same effect body rather than duplicating it.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const photoUri = getCapturedPhoto();
    if (!photoUri) {
      router.replace("/capture/confirm");
      return;
    }

    setError(null);
    setNeedsRetake(false);
    setStillWorking(false);
    const stillWorkingTimer = setTimeout(() => setStillWorking(true), STILL_WORKING_AFTER_MS);

    let cancelled = false;
    extractReceiptFromPhoto(photoUri, TODAY)
      .then((draft) => {
        if (cancelled) return;
        setDraftReceipt(draft);
        router.replace("/capture/confirm");
      })
      .catch((err) => {
        // Previously unhandled: a failed extraction left this screen spinning
        // forever with no way forward. See OCR_PLAN.md §9 — "a hung extraction
        // should surface as failed with a retry, not leave the Processing
        // screen spinning".
        if (cancelled) return;
        // A blurry/unreadable photo can't be fixed by retrying the same
        // upload or by asking the user to type numbers off a photo they
        // can't read either — the only fix is a new photo.
        setNeedsRetake(err instanceof RetakePhotoError);
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
      clearTimeout(stillWorkingTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const onEnterManually = () => {
    const photoUri = getCapturedPhoto();
    if (photoUri) setDraftReceipt(blankDraftReceipt(photoUri, TODAY));
    router.replace("/capture/confirm");
  };

  const onRetake = () => router.replace("/capture");

  if (needsRetake) {
    return (
      <View style={[styles.container, { backgroundColor: rn(color.bgMobile) }]}>
        <Text style={styles.title}>{t("processing.tooUnclearTitle")}</Text>
        <Text style={styles.subtitle}>{error}</Text>
        <View style={styles.actionsRow}>
          <Pressable style={styles.retryButton} onPress={onRetake}>
            <Text style={styles.retryButtonLabel}>{t("processing.retakePhoto")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: rn(color.bgMobile) }]}>
        <Text style={styles.title}>{t("processing.couldntReadTitle")}</Text>
        <Text style={styles.subtitle}>{error}</Text>
        <View style={styles.actionsRow}>
          <Pressable style={styles.retryButton} onPress={() => setAttempt((a) => a + 1)}>
            <Text style={styles.retryButtonLabel}>{t("common.retry")}</Text>
          </Pressable>
          <Pressable style={styles.manualButton} onPress={onEnterManually}>
            <Text style={styles.manualButtonLabel}>{t("processing.enterManually")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: rn(color.bgMobile) }]}>
      <Spinner size={56} />
      <Text style={styles.title}>{t("processing.readingReceipt")}</Text>
      <Text style={styles.subtitle}>{t("processing.extractingDetails")}</Text>
      {stillWorking && <Text style={styles.stillWorking}>{t("processing.stillWorking")}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    color: rn(color.text),
  },
  subtitle: {
    fontSize: 12.5,
    color: rn(color.textMuted),
    textAlign: "center",
    lineHeight: 18,
  },
  stillWorking: {
    fontSize: 12,
    color: rn(color.textFaint),
    textAlign: "center",
    lineHeight: 17,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: rn(color.brand),
  },
  retryButtonLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13.5,
  },
  manualButton: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: rn(color.surfaceMuted),
  },
  manualButtonLabel: {
    color: rn(color.text),
    fontWeight: "700",
    fontSize: 13.5,
  },
});
