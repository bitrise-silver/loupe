import { Image, StyleSheet, Text, View } from 'react-native';

import type { HitResult } from '../registry/registry';
import type { Rect, Screenshot } from '../types';
import { Composer, type ComposerResult } from './Composer';

interface Props {
  screenshot: Screenshot;
  pick: { hit: HitResult | null; point: { x: number; y: number } };
  onSubmit: (result: ComposerResult) => void;
  onCancel: () => void;
}

const rectStyle = (r: Rect) => ({ left: r.x, top: r.y, width: r.width, height: r.height });

/**
 * Shows the frozen screenshot with the picked part highlighted and a numbered pin, plus the
 * composer. Pins/boxes are in window space, which lines up because the frozen image fills the
 * screen 1:1.
 *
 * TODO(loupe): the drawing/redaction layer (Skia freehand/arrow/rect + destructive block-out),
 * pinch-zoom with image-space pin anchoring, and multi-pin. See capture design doc §B3–B4, §A5–A6.
 */
export function AnnotateSheet({ screenshot, pick, onSubmit, onCancel }: Props) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={{ uri: screenshot.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />

      {pick.hit ? <View style={[styles.box, rectStyle(pick.hit.rect)]} /> : null}
      <View style={[styles.pin, { left: pick.point.x - 14, top: pick.point.y - 14 }]}>
        <Text style={styles.pinText}>1</Text>
      </View>

      <Composer onSubmit={onSubmit} onCancel={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#6d5efc',
    backgroundColor: 'rgba(109,94,252,0.16)',
    borderRadius: 6,
  },
  pin: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#6d5efc',
    borderWidth: 2,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinText: { color: 'white', fontWeight: '700', fontSize: 13 },
});
