<div align="center">

# 🔍 Loupe

**Let non-technical people point at your running app and say what to change — then ship the fix over-the-air in seconds.**

*In-app, component-anchored feedback for React Native · fingerprint-gated OTA on Bitrise · Expo as the framework, no Expo cloud required.*

`experimental` · React Native / Expo SDK 54 · MIT

</div>

---

## What it is

Loupe is an open-source boilerplate for the **iterate-in-production loop**: a founder, designer, or early tester opens your app, **taps the part they want changed, says what they mean** (typing or by voice), and hits send. The feedback carries the exact **component + `file:line` + a screenshot + device/build context** — so a developer *or* an AI coding agent can fix it, and the fix ships back via **over-the-air update** without an app-store round-trip.

The one thing Loupe does that no native feedback SDK does: it **anchors a comment to a real React component**, not to a pixel on a dead screenshot. That precise anchor is what makes the loop fast — and what makes the AI-agent path possible.

```
tap the part → say what to change → (human or AI) fixes → fingerprint decides:
   JS-only  → CodePush OTA  (seconds, same binary)
   native   → Bitrise CI build + install  (new binary)
→ tester gets a push, taps the pin, verifies in seconds ✅
```

## Why these choices

- **Component-anchored, not pixel-anchored** — the differentiator. See [`docs/design/screenshot-feedback-capture.md`](docs/design/screenshot-feedback-capture.md).
- **Expo as *framework*, Bitrise as *infra*** — Expo (via `expo prebuild`/CNG) for the app; **Bitrise CodePush** for OTA + **Bitrise CI** for builds + **Bitrise RDE** for the fix-it compute. No EAS, no Expo Updates, no Expo push. See [`docs/architecture.md`](docs/architecture.md).
- **The `@expo/fingerprint` hash is the release router** — unchanged native layer ⇒ OTA; changed ⇒ full build. See [`docs/design/bitrise-ci-pipeline.md`](docs/design/bitrise-ci-pipeline.md).
- **No backend required** to start — the iterations list is a static manifest written by CI; notifications are FCM-topic sends from CI. See [`docs/design/iterations-and-notifications.md`](docs/design/iterations-and-notifications.md).
- **Security right-sized to your stage** — a 6-control baseline for a <5-person team, graduating as you grow. See [`docs/design/feedback-agent-security.md`](docs/design/feedback-agent-security.md).

## Quickstart

> Loupe uses native modules, so it runs in a **dev/custom build**, not Expo Go.

```bash
npm install
npx expo install --fix       # pin native deps to Expo SDK 54
npx expo prebuild            # generate native projects (CNG)
npx expo run:android         # Android needs no code signing — start here
# iOS later: `npx expo run:ios` (simulator is fine; a device/tester build needs Apple signing)
```

Wrap your app once:

```tsx
import { LoupeProvider } from './src/loupe';

export default function App() {
  return (
    <LoupeProvider config={{ sink: 'console' }}>
      <YourApp />
    </LoupeProvider>
  );
}
```

Tap the floating 🔍 bubble → tap the part you want to change → say what to change → **Send**. The assembled feedback payload is logged (or POSTed / routed to an agent, depending on the sink). Full setup — including CodePush, CI, RDE, and notifications — is automated by the **[`bitrise-setup-loupe` skill](.claude/skills/bitrise-setup-loupe/SKILL.md)**.

## Repo layout

| Path | What |
|---|---|
| [`App.tsx`](App.tsx) · [`index.ts`](index.ts) | Example host app wrapped with `LoupeProvider` |
| [`src/loupe/`](src/loupe) | The Loupe SDK — provider, bubble, overlay/inspect, capture, registry, annotate, payload, sinks |
| [`babel-plugin-loupe-source/`](babel-plugin-loupe-source) | Babel plugin that injects `data-loupe-source="file:line"` (the release-safe source anchor) |
| [`bitrise.yml`](bitrise.yml) | The fingerprint-gated delivery pipeline (OTA vs build) |
| [`.claude/skills/bitrise-setup-loupe/`](.claude/skills/bitrise-setup-loupe) | Claude skill: one-command setup of mobile + RDE + CodePush + CI |
| [`docs/architecture.md`](docs/architecture.md) | High-level system architecture |
| [`docs/mobile-architecture.md`](docs/mobile-architecture.md) | Mobile app / SDK architecture |
| [`docs/design/`](docs/design) | The deep-dive design research the above is built on |

## Documentation

- **[High-level architecture](docs/architecture.md)** — the whole loop, Bitrise-side and mobile-side.
- **[Mobile app architecture](docs/mobile-architecture.md)** — how the SDK is structured and how capture works.
- **[Design deep-dives](docs/design/)** — six researched docs: the [framework](docs/design/in-app-iteration-framework.md), the [Bitrise architecture](docs/design/bitrise-codepush-rde-architecture.md), the [CI pipeline](docs/design/bitrise-ci-pipeline.md), the [security model](docs/design/feedback-agent-security.md), the [iterations/notifications no-backend design](docs/design/iterations-and-notifications.md), and the [capture UX+tech](docs/design/screenshot-feedback-capture.md).

## Status

**Experimental.** The plumbing (provider, bubble, capture, registry, payload, sinks) is real and runnable; the heaviest parts (Skia freehand drawing, dev-only element inspector integration) are scoped stubs with the approach documented inline and in `docs/design/`. This is a starting point for the experiment, not a finished product.

## License

[MIT](LICENSE)
