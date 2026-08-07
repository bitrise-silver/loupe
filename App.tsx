import codePush from '@bitrise/code-push-sdk';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { LoupeProvider, LoupeTarget, sinkFromEnv } from './src/loupe';

/**
 * Example host screen. Wrap the parts you want to be feedback-anchorable in <LoupeTarget>.
 * (In a real app, most anchoring comes automatically from the Babel source plugin + testID;
 * LoupeTarget is the explicit, always-release-safe way to register a node.)
 */
function DemoScreen() {
  const [ota, setOta] = useState('checking…');
  useEffect(() => {
    // Show which OTA update is currently running (null = plain binary, no OTA pulled yet).
    codePush.getUpdateMetadata().then(
      (u) => setOta(u?.label ? `on · ${u.label}` : 'binary (no OTA yet)'),
      () => setOta('n/a'),
    );
  }, []);
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <LoupeTarget name="Header">
        <Text style={styles.h1}>Loupe demo</Text>
      </LoupeTarget>

      <LoupeTarget name="IntroCard">
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tap the 🔍 bubble</Text>
          <Text style={styles.cardBody}>
            Then tap any part of this screen and say what you'd change. Loupe captures the
            component, a screenshot, and your comment — and logs the payload.
          </Text>
        </View>
      </LoupeTarget>

      <LoupeTarget name="PrimaryButton">
        <Pressable style={styles.button} onPress={() => {}}>
          <Text style={styles.buttonText}>A button to give feedback on</Text>
        </Pressable>
      </LoupeTarget>

      <Text style={styles.diag}>
        Loupe build {process.env.EXPO_PUBLIC_LOUPE_BUILD ?? '?'} · sink={sinkFromEnv().name} · tok=
        {process.env.EXPO_PUBLIC_LOUPE_TRIGGER_TOKEN ? 'set' : 'MISSING'} · ota:{ota}
      </Text>

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
      {/*
        sinkFromEnv() routes feedback to the `process_feedback` CI workflow (→ agent → PR) when the
        build was made with EXPO_PUBLIC_LOUPE_APP_SLUG + EXPO_PUBLIC_LOUPE_TRIGGER_TOKEN set (CI
        injects the token from a Bitrise Secret). With neither set — e.g. `expo start` locally — it
        falls back to the console sink.
      */}
      <LoupeProvider config={{ enabled: true, sink: sinkFromEnv() }}>
        <DemoScreen />
      </LoupeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

// Wrap the root so CodePush checks Bitrise for a JS update on app start and installs it on the
// next restart. Deployment key + server URL come from app.json (baked into the binary at prebuild).
export default codePush({
  checkFrequency: codePush.CheckFrequency.ON_APP_START,
  installMode: codePush.InstallMode.ON_NEXT_RESTART,
})(App);

const styles = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1, padding: 24, gap: 20, backgroundColor: '#0b0b0f' },
  h1: { fontSize: 28, fontWeight: '700', color: '#f5f5f7', marginTop: 12 },
  card: { backgroundColor: '#16161d', borderRadius: 16, padding: 18, gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#f5f5f7' },
  cardBody: { fontSize: 15, lineHeight: 21, color: '#a1a1aa' },
  button: {
    backgroundColor: '#6d5efc',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  diag: { marginTop: 'auto', textAlign: 'center', fontSize: 12, color: '#6b7280' },
});
