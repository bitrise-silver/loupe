import type { Annotation, CaptureContext, FeedbackPayload, Screenshot } from '../types';

let counter = 0;
const genId = () => `loupe_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export function buildPayload(args: {
  screenshot: Screenshot | null;
  annotations: Annotation[];
  context: CaptureContext;
}): FeedbackPayload {
  return {
    schemaVersion: 1,
    id: genId(),
    createdAt: new Date().toISOString(),
    screenshot: args.screenshot,
    annotations: args.annotations,
    context: args.context,
  };
}
