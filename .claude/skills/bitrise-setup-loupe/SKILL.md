---
name: bitrise-setup-loupe
description: >-
  Set up the full Loupe backend for a React Native (Expo prebuild) app so non-technical
  reviewers can give in-app feedback and receive OTA/build iterations. Provisions Bitrise
  CodePush deployments, configures the mobile app with the deployment key, authors the
  fingerprint-gated Bitrise CI workflows, creates a Bitrise RDE template for the fix-it
  agent, wires notifications, runs a first build, and delivers it. Use when the user says
  "set up Loupe", "set up CodePush + CI + RDE for <app>", "configure the Loupe flow",
  or "bootstrap in-app iteration for <app>".
---

# bitrise-setup-loupe

Bootstraps everything on the **backend/infra side** for a Loupe app: **mobile config → CodePush → CI workflows → RDE template → notifications → first build → deliver.** Expo is the framework; Bitrise is the infra (no EAS/Expo Updates/Expo push).

Design references (read if a step is unclear): [`docs/design/bitrise-codepush-rde-architecture.md`](../../../docs/design/bitrise-codepush-rde-architecture.md), [`bitrise-ci-pipeline.md`](../../../docs/design/bitrise-ci-pipeline.md), [`iterations-and-notifications.md`](../../../docs/design/iterations-and-notifications.md), [`feedback-agent-security.md`](../../../docs/design/feedback-agent-security.md).

## Safety rules (follow these)

1. **Read before you write.** List/get first; show the user what exists before creating anything.
2. **Confirm every mutating step.** Creating deployments, editing `bitrise.yml`, creating an RDE template, triggering builds — state exactly what you'll do and get a "yes."
3. **Never commit secrets.** Deployment keys go in `app.json` (they are *not* secrets); the Bitrise API token, the Slack webhook URL, and signing creds go in **Bitrise Secrets** — never in `bitrise.yml` or the repo.
4. **Apply the prototype security baseline** from the security doc: the RDE agent template gets a git-only push key and **no release secrets**; a human approves PRs before merge/release.

## Prerequisites

- The **Bitrise MCP servers** (`bitrise`, `bitrise-dev-environments`) must be authorized. If calls return `401 / invalid PAT`, tell the user to authorize them (`/mcp` in an interactive Claude Code session, or configure a Bitrise Personal Access Token) and stop.
- A **Bitrise app** connected to the repo (or create one in step 1).
- The mobile app is an **Expo prebuild** app (this repo). CodePush + notifications need a **dev/custom build**, not Expo Go.
- **Platform decides code signing.** **Android needs none** — the release APK is signed with a debug/upload keystore automatically, so you can ship to testers with zero signing setup. **iOS requires code signing** (Apple service connection + distribution certificate + ad-hoc/enterprise provisioning profile + registered device UDIDs). If the user doesn't want to deal with iOS signing yet, set up **Android-only** and add iOS later.
- Optional (for notifications): a **Slack incoming webhook** URL. CI posts new-version messages to Slack for both OTA and native releases; if the webhook isn't set, builds skip the notification (they don't fail).

## Inputs to gather up front

| Input | Example | Notes |
|---|---|---|
| App slug / name | `bitrise-demo` | resolve or create in step 1 |
| Workspace slug | `my-workspace` | for the CodePush server URL |
| Platforms | `android` (start here) or `ios, android` | **iOS pulls in the code-signing step (4b); Android skips it entirely.** Ask this first. |
| Deployment names | `Staging`, `Production` | plus optional per-branch preview channels |
| RDE stack + machine | `osx-xcode-16.x` (iOS) or a Linux stack (Android-only) | enumerate live (step 5) |
| Notification target | **Slack incoming webhook** (optional) | one channel for both OTA + build alerts |
| Fix route policy | e.g. Change/Idea → agent, Broken → human | maps category → sink |
| Agent credentials | `ANTHROPIC_API_KEY`, `GITHUB_API_TOKEN` | user generates; you tell them where to set them (step 5b) |

## Steps

### 1 — Preflight (read-only)
- `mcp__bitrise__me`, `mcp__bitrise__list_apps` → find the app + workspace slug. If missing, offer `register_app` / `create_connected_app` (confirm first).
- Record the CodePush server URL: `https://<workspace-slug>.codepush.bitrise.io`.

### 2 — CodePush deployments
- `mcp__bitrise__codepush_list_deployments(app_id)` to see what exists.
- Create the ones needed with `codepush_create_deployment` (e.g. `Staging`, `Production`) → capture the **deployment keys**.
- (Optional) one lightweight **preview deployment per shareable iteration / branch** — this is how "install any iteration" works (see iterations doc). Keys are not secrets.

### 3 — Configure the mobile app
Edit `app.json` to add the CodePush config plugin, then prebuild (run inside an RDE or locally):
```jsonc
{ "plugins": [
  ["@bitrise/code-push-sdk/expo", {
    "ios":     { "CodePushDeploymentKey": "<STAGING_KEY>", "CodePushServerURL": "https://<ws>.codepush.bitrise.io" },
    "android": { "CodePushDeploymentKey": "<STAGING_KEY>", "CodePushServerURL": "https://<ws>.codepush.bitrise.io" }
  }]
]}
```
Then: `npm install @bitrise/code-push-sdk` → `npx expo prebuild` → `npx expo customize metro.config.js`.
⚠️ Confirm the current package name against Bitrise docs — docs may still show `@code-push-next/react-native-code-push`; prefer the Bitrise-maintained `@bitrise/code-push-sdk`.

### 4 — CI workflows (the fingerprint gate)
- `get_bitrise_yml(app_slug)` → merge in the delivery workflows + trigger map from [`bitrise-ci-pipeline.md`](../../../docs/design/bitrise-ci-pipeline.md) (this repo's [`bitrise.yml`](../../../bitrise.yml) is the source to copy). → `validate_bitrise_yml` → `update_bitrise_yml`.
- **Only wire the platforms requested.** Android-only ⇒ add just `deliver_android` and point the trigger at it — **no signing needed**. Add `deliver_ios` (and the `both` pipeline) **only after step 4b**, since its native route archives a *signed* device build and will fail without signing.
- Register the incoming webhook if not present (`register_webhook`).
- The pipeline also includes **`build_apk`** (on-demand native APK for testers) and **`process_feedback`** (the orchestrator that turns an in-app feedback item into a branch + PR via Claude Code — its credentials are step 5b).

### 4b — Code signing (iOS targets only — SKIP for Android)
**If the platform list is Android-only, skip this entire step.** Android's release APK is signed automatically with a debug/upload keystore, so `deliver_android` needs no signing setup and can ship to testers as-is.

**If iOS is a target**, ask the user for — and confirm before uploading — the following, then set them up on Bitrise:
- an **Apple service connection** (App Store Connect API key) on the workspace;
- a **distribution certificate** + an **ad-hoc** (or enterprise) **provisioning profile**, with the testers' **device UDIDs** registered in the profile.

These feed the `manage-ios-code-signing@3` + `xcode-archive@5` steps in `deliver_ios`. Signing files are **secrets** — they live in Bitrise, never in the repo. Do **not** trigger an iOS native build until this is done, or the archive step fails.

### 5 — RDE template (the fix-it environment)
- Enumerate: `bitrise_devenv_list_stacks`, `bitrise_devenv_list_machine_types` → pick a **macOS Xcode** stack if iOS is a target; a **Linux** stack is enough for Android-only.
- `bitrise_devenv_create_saved_input` for a **git-only push SSH key** (no GitHub API, no release secrets — security baseline).
- `bitrise_devenv_create_template`: warmup installs Claude Code + git/gh + `npm ci`; startup is idempotent; session inputs = repo URL + the feedback payload. This is the environment the runtime feedback→PR loop instantiates per item.

### 5b — Agent credentials (ASK the user to generate these; never enter secrets yourself)
The fix-it agent (RDE template **and** the `process_feedback` CI orchestrator) needs two credentials. **Ask the user to generate each and paste them into the right store — you must not handle the secret values (Safety rule 3).** Explain *where* each goes, because RDE saved inputs and Bitrise Secrets are **isolated stores**.

**1. `ANTHROPIC_API_KEY`** — authenticates the Claude Code agent.
- Generate: **https://console.anthropic.com → API keys → Create key**.
- Set it in **both** stores that read it:
  - **RDE saved input** `ANTHROPIC_API_KEY` (for agent runs inside an RDE session) — `bitrise_devenv_create_saved_input`, marked secret.
  - **Bitrise Secrets** `ANTHROPIC_API_KEY` (for the `process_feedback` CI workflow).

**2. `GITHUB_API_TOKEN`** — lets the agent push its branch **and open the PR**.
- Generate a **fine-grained personal access token** (least privilege): GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
  - **Resource owner** = the repo's org (e.g. `bitrise-silver`); the org may need to allow fine-grained tokens / approve the request.
  - **Repository access** = Only select repositories → the Loupe repo.
  - **Permissions**: **Contents → Read and write** (push branches) + **Pull requests → Read and write** (open PRs). (Metadata → Read is auto.)
- Set it in **Bitrise Secrets** as `GITHUB_API_TOKEN`.
- **More-locked-down alternative:** skip the token and give the agent only the **git-only `GIT_SSH_PRIVATE_KEY`** deploy key — it pushes a branch and a human opens the PR.
- Either way, **keep `main` branch-protected (require a PR review)** so the agent can open a PR but never merge — the human-in-the-loop guarantee from the security model holds even with the token.

### 6 — Distribution + notifications
- `create_tester_group` + `add_testers_to_tester_group` (toggle auto-notify) for native builds.
- **Notifications go to Slack** — the single comm channel for both OTA and native (simpler than push: no client SDK, no device tokens, and both CodePush and CI can post). Create a **Slack incoming webhook**, store it as **`SLACK_WEBHOOK_URL`** in **Bitrise Secrets**, and the release workflow's final `script` step posts to it (there is **no CodePush webhook**, so the workflow does it). The step is **guarded** — if `SLACK_WEBHOOK_URL` is unset it skips instead of failing the build. Confirm the webhook with the user first.

### 7 — First build + deliver
- `trigger_bitrise_build(workflow=deliver_android)` for the first build — **no signing, the best Android-first starting point**. (Use `deliver_ios` only once step 4b is complete.) → poll `get_build` → `list_installable_artifacts` → `set_installable_artifact_public_install_page` → share the install link with the user (or notify the tester group).

## Output (report back to the user)
- Deployment names + which key went into `app.json` (and where Production's key lives).
- The workflows added to `bitrise.yml`.
- The RDE template id.
- The tester group + the Slack channel used for alerts.
- The first build's public install link.
- A checklist of anything requiring the user, all set by them (never by you): authorizing MCP; **iOS code signing — only if iOS is a target**; **generating `ANTHROPIC_API_KEY` + `GITHUB_API_TOKEN` for the fix-it agent (step 5b)**; `SLACK_WEBHOOK_URL` for Slack alerts; `CODEPUSH_APP_ID` + `CODEPUSH_API_TOKEN` for OTA — the last four in Bitrise Secrets.

## Verify
Trigger one JS-only change and one native change; confirm the fingerprint gate routes them to CodePush vs a full build respectively, and that a device receives the OTA update and the push.
