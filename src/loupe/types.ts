// Core Loupe types. The payload shape mirrors docs/design/screenshot-feedback-capture.md §B7.
// Every `component` field is nullable because in a release build we may only have coordinates.

export type FeedbackCategory = 'broken' | 'change' | 'idea';
export type Severity = 'blocks' | 'annoying' | 'minor';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What we could resolve about the tapped element. All optional — degrades by build type. */
export interface ComponentAnchor {
  name?: string | null; // dev / unminified only
  testID?: string | null; // release-safe
  source?: string | null; // "app/Foo.tsx:42" via Babel data-loupe-source or testID — release-safe
  measuredRect?: Rect | null; // release-safe (measureInWindow)
  props?: Record<string, string> | null; // dev / registry-captured
}

export interface Annotation {
  id: string;
  kind: 'pin' | 'region' | 'arrow' | 'freehand' | 'text' | 'redact';
  region: Rect; // image-space (pre-zoom) coordinates
  point?: { x: number; y: number };
  comment: string;
  category: FeedbackCategory;
  severity?: Severity;
  component?: ComponentAnchor | null;
}

export interface CaptureContext {
  route?: { name?: string; params?: unknown } | null;
  device?: { model?: string | null; os?: string | null; osVersion?: string | null } | null;
  app?: { version?: string | null; build?: string | null } | null;
  ota?: { label?: string | null; deploymentKey?: string | null; channel?: string | null } | null;
  network?: unknown[];
  logs?: string[];
  errors?: string[];
  createdAt: string; // ISO
}

export interface Screenshot {
  uri: string; // tmpfile uri or data-uri (annotations + redaction already burned in for the final image)
  width: number;
  height: number;
  pixelRatio: number;
  format: 'png' | 'jpg';
}

export interface FeedbackPayload {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  screenshot: Screenshot | null;
  annotations: Annotation[];
  context: CaptureContext;
}

/** A destination for feedback. Implement this to route to a tracker or an AI agent. */
export interface Sink {
  name: string;
  send(payload: FeedbackPayload): Promise<void>;
}

/** 'console' is a shorthand for the built-in dev sink; otherwise pass a Sink implementation. */
export type SinkSpec = 'console' | Sink;

export interface LoupeConfig {
  /** Master switch. Typically `__DEV__` or a remote flag. */
  enabled?: boolean;
  /** Where feedback goes. 'console' logs it; pass a Sink to route to http/agent/etc. */
  sink?: SinkSpec;
  /** POST target when you pass the built-in http sink via createHttpSink(). */
  endpoint?: string;
  /** Optionally provide the current route (e.g. from React Navigation) for the context bundle. */
  getCurrentRoute?: () => { name?: string; params?: unknown } | null;
  /** Called after a payload is sent — hook your own confirmation UI / "My feedback" list. */
  onSent?: (payload: FeedbackPayload) => void;
}
