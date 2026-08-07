import codePush from '@bitrise/code-push-sdk';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createDecisionSender, type ReviewDecision } from '../sinks';

/**
 * In-app review of a feedback-driven change. When the running CodePush update was published for a
 * feedback PR (its description is "loupe-pr:<N>"), this shows a banner with Keep / Improve / Scrap:
 *   • Keep    → merge the PR to main (ships via OTA)
 *   • Improve → send a follow-up note that refines the SAME PR
 *   • Scrap   → close the PR + roll back to the previous version
 * All three go through the `apply_decision` CI workflow (see createDecisionSender). Renders nothing
 * unless a reviewable change is live AND the build was configured with the trigger token.
 */
export function ReviewBanner() {
  const insets = useSafeAreaInsets();
  const [pr, setPr] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [improving, setImproving] = useState(false);
  const [note, setNote] = useState('');
  const [send] = useState(() => createDecisionSender());

  const detect = useCallback(() => {
    codePush.getUpdateMetadata().then(
      (u) => {
        const m = u?.description?.match(/loupe-pr:(\d+)/);
        setPr(m ? Number(m[1]) : null);
      },
      () => setPr(null),
    );
  }, []);

  useEffect(() => {
    detect();
    // Re-check when the app returns to the foreground (a new preview may have just been applied).
    const sub = AppState.addEventListener('change', (s) => s === 'active' && detect());
    return () => sub.remove();
  }, [detect]);

  if (!send || pr == null) return null;

  const decide = async (decision: ReviewDecision, text?: string) => {
    setBusy(true);
    try {
      await send(pr, decision, text);
      const msg =
        decision === 'keep'
          ? `Merging PR #${pr} — it'll ship to everyone shortly.`
          : decision === 'scrap'
            ? `Scrapping PR #${pr} and rolling back to the previous version.`
            : `Sending your note — the agent will refine PR #${pr}.`;
      Alert.alert('Loupe', msg);
      setPr(null);
      setImproving(false);
      setNote('');
    } catch (err) {
      Alert.alert("Loupe — couldn't submit", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
      <View style={styles.card}>
        <Text style={styles.title}>Reviewing change · PR #{pr}</Text>
        {improving ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="What should be improved?"
              placeholderTextColor="#9ca3af"
              value={note}
              onChangeText={setNote}
              autoFocus
              multiline
            />
            <View style={styles.row}>
              <Pressable style={styles.secondary} onPress={() => setImproving(false)} disabled={busy}>
                <Text style={styles.secondaryText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.improve, !note.trim() && styles.disabled]}
                onPress={() => decide('improve', note.trim())}
                disabled={busy || !note.trim()}
              >
                <Text style={styles.btnText}>Send</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.keep]} onPress={() => decide('keep')} disabled={busy}>
              <Text style={styles.btnText}>👍 Keep</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.improve]} onPress={() => setImproving(true)} disabled={busy}>
              <Text style={styles.btnText}>✏️ Improve</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.scrap]} onPress={() => decide('scrap')} disabled={busy}>
              <Text style={styles.btnText}>🗑 Scrap</Text>
            </Pressable>
          </View>
        )}
        {busy ? <ActivityIndicator style={styles.spin} color="#ffffff" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12 },
  card: { backgroundColor: '#1f2937', borderRadius: 14, padding: 12, gap: 10 },
  title: { color: '#f9fafb', fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10 },
  btnText: { color: 'white', fontWeight: '600' },
  keep: { backgroundColor: '#16a34a' },
  improve: { backgroundColor: '#6d5efc' },
  scrap: { backgroundColor: '#b91c1c' },
  disabled: { opacity: 0.4 },
  input: {
    minHeight: 44,
    backgroundColor: '#0b0b0f',
    borderRadius: 10,
    padding: 10,
    color: '#f5f5f7',
    fontSize: 15,
    textAlignVertical: 'top',
  },
  secondary: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, backgroundColor: '#374151' },
  secondaryText: { color: 'white', fontWeight: '600' },
  spin: { position: 'absolute', right: 14, top: 12 },
});
