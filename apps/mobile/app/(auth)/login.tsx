import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color } from "@rr/ui-tokens";
import { signInWithPassword } from "@rr/api";
import { rn } from "../../lib/colors";
import { Text } from "../../components/Text";
import { TextInput } from "../../components/TextInput";

/**
 * Sign-in only — no self-registration here. A regular member's account is
 * always created by their admin/owner (see ProvisionMemberPanel on the web
 * app), with a temporary password relayed to them directly; starting a
 * brand-new paid workspace is still a public flow, but only on the web app.
 */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(email.trim(), password);
      // No navigation here on purpose — app/_layout.tsx's AuthGate is
      // subscribed to the session and redirects itself once it changes.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: rn(color.bgMobile) }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 60 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={require("../../assets/images/logo.png")} style={styles.logo} contentFit="contain" />
        <Text style={styles.title}>ReceiptRaccoon</Text>
        <Text style={styles.subtitle}>Sign in</Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={rn(color.textFaint)}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={rn(color.textFaint)}
          style={styles.input}
          secureTextEntry
          autoComplete="password"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submitButton, !canSubmit && { opacity: 0.5 }]}
          onPress={onSubmit}
          disabled={!canSubmit}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitLabel}>Sign in</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 30,
    paddingBottom: 40,
    alignItems: "center",
  },
  logo: {
    width: 110,
    height: 110,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: rn(color.text),
  },
  subtitle: {
    fontSize: 14,
    color: rn(color.textMuted),
    marginTop: 4,
    marginBottom: 28,
  },
  input: {
    width: "100%",
    fontSize: 15,
    fontWeight: "600",
    backgroundColor: rn(color.surface),
    borderWidth: 1,
    borderColor: rn(color.borderStrong),
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    color: rn(color.text),
    marginBottom: 12,
  },
  error: {
    fontSize: 12.5,
    color: rn(color.up),
    textAlign: "center",
    marginBottom: 10,
  },
  submitButton: {
    width: "100%",
    marginTop: 6,
    backgroundColor: rn(color.brand),
    alignItems: "center",
    paddingVertical: 15,
    borderRadius: 14,
  },
  submitLabel: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
