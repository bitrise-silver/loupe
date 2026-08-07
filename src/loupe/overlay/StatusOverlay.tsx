import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface Props {
  state: 'sending' | 'sent';
  /** Name of the sink that handled it, so a connectivity test can tell CI from a local log. */
  destination: string;
}

/** The visible "your feedback is being processed / was sent" clue shown over the app after Send. */
export function StatusOverlay({ state, destination }: Props) {
  const reachedCI = destination === 'bitrise-trigger';
  return (
    <View style={styles.scrim} pointerEvents="auto">
      <View style={styles.card}>
        {state === 'sending' ? (
          <>
            <ActivityIndicator size="large" color="#6d5efc" />
            <Text style={styles.text}>Sending your feedback…</Text>
          </>
        ) : (
          <>
            <View style={styles.check}>
              <Text style={styles.checkMark}>✓</Text>
            </View>
            <Text style={styles.text}>{reachedCI ? 'Sent to CI' : 'Logged on this device'}</Text>
            <Text style={styles.sub}>
              {reachedCI
                ? 'A build is starting — watch for the update.'
                : `"${destination}" sink — nothing was sent off-device.`}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    minWidth: 200,
    paddingVertical: 28,
    paddingHorizontal: 32,
    borderRadius: 20,
    backgroundColor: '#16161d',
    alignItems: 'center',
    gap: 16,
  },
  text: { color: '#f5f5f7', fontSize: 16, fontWeight: '600' },
  sub: { color: '#a1a1aa', fontSize: 13, textAlign: 'center', marginTop: -6 },
  check: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: 'white', fontSize: 26, fontWeight: '800' },
});
