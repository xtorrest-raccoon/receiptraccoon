import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color } from "@rr/ui-tokens";
import { signInWithPassword, signUp } from "@rr/api";
import { rn } from "../../lib/colors";
import { Text } from "../../components/Text";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "signUp") {
        const { session } = await signUp(email.trim(), password, name.trim() || undefined);
        // With email confirmation on (Supabase's default), signUp succeeds but
        // returns no session — without this, nothing visibly happens at all,
        // since AuthGate only reacts once a session actually appears.
        if (!session) {
          setConfirmPending(true);
          return;
        }
      } else {
        await signInWithPassword(email.trim(), password);
      }
      // No navigation here on purpose — app/_layout.tsx's AuthGate is
      // subscribed to the session and redirects itself once it changes.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  if (confirmPending) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 60, flex: 1, justifyContent: "center" }]}>
        <Text style={styles.title}>ReceiptRaccoon</Text>
        <Text style={[styles.subtitle, { textAlign: "center", marginBottom: 0 }]}>
          Check {email.trim()} for a confirmation link, then sign in.
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: rn(color.bgMobile) }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 60 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>ReceiptRaccoon</Text>
        <Text style={styles.subtitle}>{mode === "signUp" ? "Create your workspace" : "Sign in"}</Text>

        {mode === "signUp" && (
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={rn(color.textFaint)}
            style={styles.input}
            autoCapitalize="words"
          />
        )}
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
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitLabel}>{mode === "signUp" ? "Create account" : "Sign in"}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => setMode(mode === "signUp" ? "signIn" : "signUp")} style={{ marginTop: 18 }}>
          <Text style={styles.switchLabel}>
            {mode === "signUp" ? "Already have an account? Sign in" : "New here? Create an account"}
          </Text>
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
  switchLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: rn(color.brand),
  },
});
