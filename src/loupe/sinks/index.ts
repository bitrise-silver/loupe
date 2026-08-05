import type { FeedbackPayload, Sink, SinkSpec } from '../types';

/** Logs a readable summary. The default in development. */
export const consoleSink: Sink = {
  name: 'console',
  async send(payload) {
    console.log('[loupe] feedback:', JSON.stringify(summarize(payload), null, 2));
  },
};

/** POST the full payload to your own endpoint (a webhook, a function, a tracker bridge). */
export function createHttpSink(endpoint: string): Sink {
  return {
    name: 'http',
    async send(payload) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`[loupe] http sink returned ${res.status}`);
    },
  };
}

/**
 * Route to an AI coding agent. In the full design this POSTs to an endpoint that spins up a
 * Bitrise RDE, runs a coding agent on {source file:line + comment + props + screenshot}, and
 * opens a PR — never auto-merged. See docs/design/bitrise-codepush-rde-architecture.md and the
 * security model. This scaffold just forwards the payload.
 */
export function createAgentSink(endpoint: string): Sink {
  return {
    name: 'agent',
    async send(payload) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'loupe.feedback', payload }),
      });
      if (!res.ok) throw new Error(`[loupe] agent sink returned ${res.status}`);
    },
  };
}

/** Resolve the config's `sink` shorthand into a concrete Sink. */
export function resolveSink(spec: SinkSpec | undefined): Sink {
  if (!spec || spec === 'console') return consoleSink;
  return spec;
}

function summarize(p: FeedbackPayload) {
  return {
    id: p.id,
    createdAt: p.createdAt,
    annotations: p.annotations.map((a) => ({
      category: a.category,
      severity: a.severity,
      comment: a.comment,
      // the release-safe anchor, preferred order: source → testID → name
      anchor: a.component?.source ?? a.component?.testID ?? a.component?.name ?? '(coordinates only)',
      region: a.region,
    })),
    context: { route: p.context.route, device: p.context.device, app: p.context.app },
    screenshot: p.screenshot ? { uri: p.screenshot.uri, format: p.screenshot.format } : null,
  };
}
