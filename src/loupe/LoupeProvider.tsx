import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import type { ComposerResult } from './annotate/Composer';
import { captureContextBundle } from './capture/context';
import { captureScreenshot } from './capture/screenshot';
import { LoupeContext, type LoupeMode } from './context';
import { FeedbackBubble } from './FeedbackBubble';
import { FeedbackOverlay } from './overlay/FeedbackOverlay';
import { buildPayload } from './payload/buildPayload';
import { createRegistry, type HitResult } from './registry/registry';
import { resolveSink } from './sinks';
import type { Annotation, CaptureContext, LoupeConfig, Screenshot } from './types';

interface Props {
  config?: LoupeConfig;
  children: ReactNode;
}

type Pick = { hit: HitResult | null; point: { x: number; y: number } };

/**
 * Root wrapper. Owns the capture state machine (idle → inspecting → capturing → annotating),
 * mounts the floating bubble and the overlay, and ships the assembled payload to the sink.
 */
export function LoupeProvider({ config = {}, children }: Props) {
  const enabled = config.enabled ?? __DEV__;
  const registry = useMemo(() => createRegistry(), []);
  const sink = useMemo(() => resolveSink(config.sink), [config.sink]);

  const [mode, setMode] = useState<LoupeMode>('idle');
  const [pick, setPick] = useState<Pick | null>(null);
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null);
  const contextRef = useRef<CaptureContext | null>(null);

  const reset = useCallback(() => {
    setMode('idle');
    setPick(null);
    setScreenshot(null);
    contextRef.current = null;
  }, []);

  const open = useCallback(() => setMode('inspecting'), []);

  const onPick = useCallback(
    async (hit: HitResult | null, point: { x: number; y: number }) => {
      setPick({ hit, point });
      // Hide Loupe chrome so it isn't in the screenshot, then give React a frame to unmount it.
      setMode('capturing');
      await new Promise((r) => setTimeout(r, 60));
      try {
        const [shot, ctxBundle] = await Promise.all([
          captureScreenshot(),
          captureContextBundle(config),
        ]);
        contextRef.current = ctxBundle;
        setScreenshot(shot);
      } catch (err) {
        console.warn('[loupe] capture failed', err);
        contextRef.current = await captureContextBundle(config);
        setScreenshot(null);
      }
      setMode('annotating');
    },
    [config],
  );

  const onSubmit = useCallback(
    async (result: ComposerResult) => {
      const p = pick;
      const fallbackRect = {
        x: (p?.point.x ?? 0) - 22,
        y: (p?.point.y ?? 0) - 22,
        width: 44,
        height: 44,
      };
      const annotation: Annotation = {
        id: 'a1',
        kind: p?.hit ? 'region' : 'pin',
        region: p?.hit?.rect ?? fallbackRect,
        point: p?.point,
        comment: result.comment,
        category: result.category,
        severity: result.severity,
        component: p?.hit
          ? {
              name: p.hit.name ?? null,
              testID: p.hit.testID ?? null,
              source: p.hit.source ?? null,
              measuredRect: p.hit.rect,
            }
          : null,
      };

      const context = contextRef.current ?? (await captureContextBundle(config));
      const payload = buildPayload({ screenshot, annotations: [annotation], context });

      setMode('sending'); // visible "processing" clue
      try {
        await Promise.all([
          sink.send(payload).then(() => config.onSent?.(payload)),
          // keep the spinner on screen long enough to notice, even for an instant sink
          new Promise((resolve) => setTimeout(resolve, 500)),
        ]);
        setMode('sent'); // visible "done" clue
        await new Promise((resolve) => setTimeout(resolve, 900));
      } catch (err) {
        // Surface the failure on-device — reviewers test the installed app with no Metro attached,
        // so a swallowed error looks like "nothing happened". Show the real reason.
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[loupe] sink failed', err);
        Alert.alert("Loupe — couldn't send feedback", message);
      }
      reset();
    },
    [pick, screenshot, sink, config, reset],
  );

  const value = useMemo(
    () => ({ config: { ...config, enabled }, mode, open, cancel: reset, registry }),
    [config, enabled, mode, open, reset, registry],
  );

  return (
    <LoupeContext.Provider value={value}>
      {children}
      {enabled ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {mode === 'idle' ? (
            <FeedbackBubble onPress={open} />
          ) : (
            <FeedbackOverlay
              mode={mode}
              screenshot={screenshot}
              pick={pick}
              onPick={onPick}
              onSubmit={onSubmit}
              onCancel={reset}
            />
          )}
        </View>
      ) : null}
    </LoupeContext.Provider>
  );
}
