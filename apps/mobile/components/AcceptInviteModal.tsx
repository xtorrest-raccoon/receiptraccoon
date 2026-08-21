import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { color } from "@rr/ui-tokens";
import { rn, rnAlpha } from "../lib/colors";
import { useAcceptInvite, useMyPendingInvite } from "../lib/queries";
import { Text } from "./Text";

/**
 * Blocking modal, not a dismissible banner — accepting migrates the caller's
 * entire workspace (their own receipts and mileage move with them), so it
 * shouldn't be something to miss. "Not now" just closes it for this app
 * session; it reappears next launch since the invite itself stays pending.
 */
export function AcceptInviteModal() {
  const { t } = useTranslation();
  const { data: invite } = useMyPendingInvite();
  const acceptInvite = useAcceptInvite();
  const [dismissed, setDismissed] = useState(false);

  if (!invite || dismissed) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{t("invite.title")}</Text>
          <Text style={styles.body}>{t("invite.body", { workspace: invite.workspaceName, role: invite.role })}</Text>
          {acceptInvite.isError ? <Text style={styles.error}>{t("invite.couldntAccept")}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={styles.notNow} onPress={() => setDismissed(true)} disabled={acceptInvite.isPending}>
              <Text style={styles.notNowLabel}>{t("invite.notNow")}</Text>
            </Pressable>
            <Pressable
              style={[styles.accept, acceptInvite.isPending && { opacity: 0.6 }]}
              onPress={() => acceptInvite.mutate(invite.id)}
              disabled={acceptInvite.isPending}
            >
              {acceptInvite.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.acceptLabel}>{t("invite.accept")}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: rnAlpha(color.text, 0.45),
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: rn(color.surface),
    borderRadius: 18,
    padding: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: rn(color.text),
    marginBottom: 8,
  },
  body: {
    fontSize: 13.5,
    lineHeight: 19,
    color: rn(color.textMuted),
  },
  error: {
    fontSize: 12,
    color: rn(color.up),
    marginTop: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  notNow: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: rn(color.avatarBg),
  },
  notNowLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: rn(color.textMuted),
  },
  accept: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: rn(color.brand),
  },
  acceptLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
