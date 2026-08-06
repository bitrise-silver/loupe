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

/**
 * The "last hop": turn an in-app feedback item into a real CI run of the `process_feedback`
 * workflow, which runs Claude Code headless → makes the smallest change → opens a PR.
 *
 * It POSTs to Bitrise's build-trigger endpoint with the feedback (slimmed) mapped to the
 * `LOUPE_FEEDBACK_PAYLOAD` env var the agent reads. No backend required.
 *
 * Security: the `triggerToken` only starts builds (blast radius = "can start process_feedback,
 * which opens a human-gated PR"). It is injected at BUILD time from a Bitrise Secret and inlined
 * into the JS bundle — never committed to the repo. See docs/design/feedback-agent-security.md.
 */
export function createBitriseTriggerSink(opts: {
  appSlug: string;
  triggerToken: string;
  workflowId?: string;
  branch?: string;
}): Sink {
  return {
    name: 'bitrise-trigger',
    async send(payload) {
      const res = await fetch(`https://app.bitrise.io/app/${opts.appSlug}/build/start.json`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          hook_info: { type: 'bitrise', build_trigger_token: opts.triggerToken },
          build_params: {
            branch: opts.branch ?? 'main',
            workflow_id: opts.workflowId ?? 'process_feedback',
            // Keep the value small: env vars have size limits, and the headless agent only needs
            // the comment + anchor, not the screenshot bytes.
            environments: [
              { mapped_to: 'LOUPE_FEEDBACK_PAYLOAD', value: JSON.stringify(compact(payload)), is_expand: false },
            ],
          },
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`[loupe] bitrise trigger returned ${res.status} ${detail}`.trim());
      }
    },
  };
}

/**
 * Pick the sink from build-time config. Expo inlines `EXPO_PUBLIC_*` env vars into the bundle,
 * so a release APK built with a trigger token routes feedback to CI; without one it logs locally.
 * Set these at build time (CI injects the token from a Bitrise Secret) — never hardcode the token.
 */
export function sinkFromEnv(): Sink {
  const appSlug = process.env.EXPO_PUBLIC_LOUPE_APP_SLUG;
  const triggerToken = process.env.EXPO_PUBLIC_LOUPE_TRIGGER_TOKEN;
  if (appSlug && triggerToken) {
    return createBitriseTriggerSink({
      appSlug,
      triggerToken,
      workflowId: process.env.EXPO_PUBLIC_LOUPE_WORKFLOW_ID || undefined,
      branch: process.env.EXPO_PUBLIC_LOUPE_BRANCH || undefined,
    });
  }
  return consoleSink;
}

/** Resolve the config's `sink` shorthand into a concrete Sink. */
export function resolveSink(spec: SinkSpec | undefined): Sink {
  if (!spec || spec === 'console') return consoleSink;
  return spec;
}

/** Small, agent-ready projection of a payload (drops screenshot bytes; keeps comment + anchor). */
function compact(p: FeedbackPayload) {
  return {
    id: p.id,
    createdAt: p.createdAt,
    annotations: p.annotations.map((a) => ({
      category: a.category,
      severity: a.severity ?? null,
      comment: a.comment,
      // the release-safe anchor the agent uses to locate code, preferred order: source → testID → name
      anchor: a.component?.source ?? a.component?.testID ?? a.component?.name ?? null,
      component: a.component
        ? { name: a.component.name ?? null, testID: a.component.testID ?? null, source: a.component.source ?? null }
        : null,
      region: a.region,
    })),
    context: {
      route: p.context.route ?? null,
      app: p.context.app ?? null,
      device: p.context.device ?? null,
      ota: p.context.ota ?? null,
    },
    screenshot: p.screenshot
      ? { present: true, width: p.screenshot.width, height: p.screenshot.height, format: p.screenshot.format }
      : null,
  };
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
