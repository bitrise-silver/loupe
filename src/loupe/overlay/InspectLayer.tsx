import { useContext, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { LoupeContext } from '../context';
import type { HitResult } from '../registry/registry';
import type { Rect } from '../types';

interface Props {
  onPick: (hit: HitResult | null, point: { x: number; y: number }) => void;
  onCancel: () => void;
}

const rectStyle = (r: Rect) => ({ left: r.x, top: r.y, width: r.width, height: r.height });

/** Height of the bottom strip the action bar covers: its `bottom: 40` offset + button height. */
const BAR_STRIP = 96;

/**
 * Transparent inspect layer. Tap a component → we hit-test the registry and highlight the box,
 * so the reviewer can SEE what they picked before committing (self-correcting). Confirm → onPick.
 *
 * TODO(loupe): in dev builds, also call getInspectorDataForViewAtPoint(rootRef, x, y, cb) to
 * enrich the hit with component name + props + source. It's dev-only (throws in release), so the
 * registry hit-test above is the release-safe path. See docs/mobile-architecture.md.
 */
export function InspectLayer({ onPick, onCancel }: Props) {
  const ctx = useContext(LoupeContext);
  const [sel, setSel] = useState<{ hit: HitResult | null; point: { x: number; y: number } } | null>(
    null,
  );

  const { height } = useWindowDimensions();

  const onTap = async (x: number, y: number) => {
    const hit = ctx ? await ctx.registry.hitTest(x, y) : null;
    // The action bar owns the bottom strip, but its Confirm button only exists once something is
    // picked — so until then a tap aimed at that row falls through to this full-screen Pressable.
    // Recording it would pin a spot the bar hides, and put Confirm right under the finger that just
    // tapped, so the next tap commits a meaningless pick. Real component hits still count.
    if (!hit && y > height - BAR_STRIP) return;
    setSel({ hit, point: { x, y } });
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={(e) => onTap(e.nativeEvent.pageX, e.nativeEvent.pageY)}
      >
        <View style={styles.scrim} />
        <View style={styles.banner}>
          <Text style={styles.bannerText}>Tap the part you want to change</Text>
        </View>
        {sel?.hit ? <View style={[styles.box, rectStyle(sel.hit.rect)]} /> : null}
        {sel ? <View style={[styles.dot, { left: sel.point.x - 7, top: sel.point.y - 7 }]} /> : null}
      </Pressable>

      <View style={styles.bar}>
        <Pressable style={styles.cancel} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        {sel ? (
          <Pressable style={styles.confirm} onPress={() => onPick(sel.hit, sel.point)}>
            <Text style={styles.confirmText}>
              {sel.hit ? `Comment on ${sel.hit.name ?? 'this'}` : 'Comment on this spot'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.12)' },
  banner: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    backgroundColor: 'rgba(20,20,28,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bannerText: { color: 'white', fontWeight: '600' },
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#6d5efc',
    backgroundColor: 'rgba(109,94,252,0.16)',
    borderRadius: 6,
  },
  dot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#6d5efc',
    borderWidth: 2,
    borderColor: 'white',
  },
  bar: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 12,
  },
  cancel: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(20,20,28,0.92)',
  },
  cancelText: { color: 'white', fontWeight: '600' },
  confirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#6d5efc',
  },
  confirmText: { color: 'white', fontWeight: '700' },
});
