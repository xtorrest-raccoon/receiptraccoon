import { Pressable, StyleSheet, View } from "react-native";
import { color } from "@rr/ui-tokens";
import { rn } from "../lib/colors";
import { signOut } from "../lib/data";
import { Text } from "./Text";

/**
 * Blocks the whole app for an admin/owner-provisioned account that hasn't
 * set its own password yet — see AuthGate's mustChangePassword check and
 * 0008_admin_provisioned_accounts.sql. That screen only exists on the web
 * app (built once, not duplicated here), so mobile just points there rather
 * than trying to replicate it.
 */
export function FinishSetupScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Finish setting up your account</Text>
      <Text style={styles.body}>
        Your account was created with a temporary password. Sign in to the web app once to choose your own password,
        then come back here.
      </Text>
      <Pressable style={styles.signOutButton} onPress={() => signOut()}>
        <Text style={styles.signOutLabel}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: rn(color.bgMobile),
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: rn(color.text),
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    fontSize: 13.5,
    color: rn(color.textMuted),
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 22,
  },
  signOutButton: {
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: rn(color.surfaceMuted),
  },
  signOutLabel: {
    fontSize: 13.5,
    fontWeight: "700",
    color: rn(color.textMuted),
  },
});
