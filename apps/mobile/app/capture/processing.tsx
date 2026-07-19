import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { color } from "@rr/ui-tokens";
import { rn } from "../../lib/colors";
import { TODAY, simulateExtraction } from "../../lib/data";
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
  const router = useRouter();
  const [stillWorking, setStillWorking] = useState(false);

  useEffect(() => {
    const photoUri = getCapturedPhoto();
    if (!photoUri) {
      router.replace("/capture/confirm");
      return;
    }

    const stillWorkingTimer = setTimeout(() => setStillWorking(true), STILL_WORKING_AFTER_MS);

    let cancelled = false;
    simulateExtraction(photoUri, TODAY).then((draft) => {
      if (cancelled) return;
      setDraftReceipt(draft);
      router.replace("/capture/confirm");
    });

    return () => {
      cancelled = true;
      clearTimeout(stillWorkingTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: rn(color.bgMobile) }]}>
      <Spinner size={56} />
      <Text style={styles.title}>Reading your receipt…</Text>
      <Text style={styles.subtitle}>Extracting vendor, date, total, tax, and line items.</Text>
      {stillWorking && <Text style={styles.stillWorking}>Still working — this can take a little longer…</Text>}
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
});
