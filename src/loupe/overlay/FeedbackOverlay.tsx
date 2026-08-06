import { AnnotateSheet } from '../annotate/AnnotateSheet';
import type { ComposerResult } from '../annotate/Composer';
import type { LoupeMode } from '../context';
import type { HitResult } from '../registry/registry';
import type { Screenshot } from '../types';
import { InspectLayer } from './InspectLayer';
import { StatusOverlay } from './StatusOverlay';

interface Props {
  mode: LoupeMode;
  screenshot: Screenshot | null;
  pick: { hit: HitResult | null; point: { x: number; y: number } } | null;
  onPick: (hit: HitResult | null, point: { x: number; y: number }) => void;
  onSubmit: (result: ComposerResult) => void;
  onCancel: () => void;
}

/** Renders the right stage of the capture flow. 'capturing' renders nothing so the screenshot is clean. */
export function FeedbackOverlay({ mode, screenshot, pick, onPick, onSubmit, onCancel }: Props) {
  if (mode === 'inspecting') {
    return <InspectLayer onPick={onPick} onCancel={onCancel} />;
  }
  if (mode === 'annotating' && screenshot && pick) {
    return (
      <AnnotateSheet screenshot={screenshot} pick={pick} onSubmit={onSubmit} onCancel={onCancel} />
    );
  }
  if (mode === 'sending' || mode === 'sent') {
    return <StatusOverlay state={mode} />;
  }
  return null;
}
