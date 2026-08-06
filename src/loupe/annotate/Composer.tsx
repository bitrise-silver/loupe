import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { FeedbackCategory, Severity } from '../types';

export interface ComposerResult {
  comment: string;
  category: FeedbackCategory;
  severity?: Severity;
}

interface Props {
  onSubmit: (result: ComposerResult) => void;
  onCancel: () => void;
}

const CATEGORIES: { key: FeedbackCategory; label: string; emoji: string }[] = [
  { key: 'broken', label: 'Broken', emoji: '🐞' },
  { key: 'change', label: 'Change this', emoji: '✏️' },
  { key: 'idea', label: 'Idea', emoji: '💡' },
];

const SEVERITIES: { key: Severity; label: string }[] = [
  { key: 'blocks', label: 'Blocks me' },
  { key: 'annoying', label: 'Annoying' },
  { key: 'minor', label: 'Minor' },
];

/** The lightweight feedback composer: category → message → send. Plain language, no jargon. */
export function Composer({ onSubmit, onCancel }: Props) {
  const [category, setCategory] = useState<FeedbackCategory>('change');
  const [severity, setSeverity] = useState<Severity>('annoying');
  const [comment, setComment] = useState('');
  const canSend = comment.trim().length > 0;

  return (
    <View style={styles.sheet}>
      <View style={styles.row}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => setCategory(c.key)}
            style={[styles.pill, category === c.key && styles.pillActive]}
          >
            <Text style={styles.pillText}>
              {c.emoji} {c.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {category === 'broken' ? (
        <View style={styles.row}>
          {SEVERITIES.map((s) => (
            <Pressable
              key={s.key}
              onPress={() => setSeverity(s.key)}
              style={[styles.sev, severity === s.key && styles.sevActive]}
            >
              <Text style={styles.sevText}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="What should change here?"
        placeholderTextColor="#71717a"
        value={comment}
        onChangeText={setComment}
        autoFocus
        multiline
      />
      {/* TODO(loupe): voice note (hold-to-record + on-device transcription) — see capture design doc §A4. */}

      <View style={styles.actions}>
        <Pressable style={styles.secondary} onPress={onCancel}>
          <Text style={styles.secondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          disabled={!canSend}
          onPress={() =>
            onSubmit({
              comment: comment.trim(),
              category,
              severity: category === 'broken' ? severity : undefined,
            })
          }
          style={[styles.primary, !canSend && styles.primaryDisabled]}
        >
          <Text style={styles.primaryText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    // Android is edge-to-edge on Expo SDK 54, so this sheet draws BEHIND the system nav bar.
    // Clear it, or the Cancel/Send row is untappable (taps hit the nav bar). The robust fix is
    // react-native-safe-area-context's useSafeAreaInsets().bottom — added on the next rebuild.
    paddingBottom: 56,
    gap: 12,
    backgroundColor: '#16161d',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  row: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#23232d',
  },
  pillActive: { backgroundColor: '#6d5efc' },
  pillText: { color: 'white', fontWeight: '600' },
  sev: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#23232d',
  },
  sevActive: { backgroundColor: '#3f3f52' },
  sevText: { color: '#e4e4e7', fontSize: 13 },
  input: {
    minHeight: 64,
    backgroundColor: '#0b0b0f',
    borderRadius: 12,
    padding: 12,
    color: '#f5f5f7',
    fontSize: 16,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', gap: 12 },
  secondary: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#23232d',
  },
  secondaryText: { color: 'white', fontWeight: '600' },
  primary: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6d5efc',
  },
  primaryDisabled: { opacity: 0.4 },
  primaryText: { color: 'white', fontWeight: '700' },
});
