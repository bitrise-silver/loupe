// Loupe SDK — public API.

export { LoupeProvider } from './LoupeProvider';
export { LoupeTarget } from './registry/LoupeTarget';
export { useLoupe } from './hooks/useLoupe';

export { consoleSink, createHttpSink, createAgentSink, resolveSink } from './sinks';

export type {
  LoupeConfig,
  Sink,
  SinkSpec,
  FeedbackPayload,
  Annotation,
  ComponentAnchor,
  CaptureContext,
  Screenshot,
  Rect,
  FeedbackCategory,
  Severity,
} from './types';
