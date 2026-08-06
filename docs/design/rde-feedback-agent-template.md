# RDE template — Loupe feedback→PR agent

The concrete, reproducible spec of the **Bitrise RDE (Remote Dev Environment) template** that turns
one in-app feedback item into a branch + PR via Claude Code. This is the runtime, disposable
counterpart to the fingerprint-gated delivery pipeline in [`bitrise-ci-pipeline.md`](bitrise-ci-pipeline.md)
and the security posture in [`feedback-agent-security.md`](feedback-agent-security.md).

> **No secrets live here.** The scripts reference `$GIT_SSH_PRIVATE_KEY` and `$ANTHROPIC_API_KEY` as
> environment variables only. Their values come from **encrypted saved inputs** (pre-filled at session
> start) — never from this file, the template body, or the repo. This document is safe to commit.

## What it is

An **ephemeral fix-it environment**. The runtime loop instantiates one session **per feedback item**:
the reviewer's annotated comment arrives as `LOUPE_FEEDBACK_PAYLOAD`, Claude Code makes the smallest
change that addresses it, pushes a branch, and a human approves the PR before anything merges or ships.

There are **two interchangeable ways** to run this same agent loop; they share the same script logic:

| Path | Where it runs | When to use |
|---|---|---|
| **RDE template** (this doc) | A disposable RDE box, one per item | Interactive/among-humans debugging, longer sessions, a box you can SSH into |
| **`process_feedback` CI workflow** | A Bitrise CI build | Headless, fire-and-forget, triggered straight from the app or a webhook |

The [`process_feedback`](../../bitrise.yml) workflow in `bitrise.yml` is the CI mirror of this template —
same install-Claude-Code → `npm ci` → payload→branch→PR flow, minus the RDE box lifecycle.

## Security baseline (prototype tier)

- **git-only push key.** The agent gets a **git-only SSH deploy key** (`GIT_SSH_PRIVATE_KEY`) — it can
  push branches, nothing else. **No CodePush token, no Slack webhook, no signing files** in the box.
- **Human-in-the-loop.** Keep `main` branch-protected. The agent opens a PR; a human reviews and merges.
- **Least-privilege agent credential.** `ANTHROPIC_API_KEY` is the agent's *own* credential, not a
  release secret. Blast radius of a compromised session = "can open a PR," which a human still gates.

See [`feedback-agent-security.md`](feedback-agent-security.md) for the full threat model.

## Template spec (live values)

| Field | Value |
|---|---|
| Name | `Loupe feedback→PR agent (Android)` |
| Workspace | `1Silvercast` |
| Stack | `ubuntu-resolute-26.04-bitrise-2026-android` |
| Image | `linux-bitvirt-2026` |
| Machine type | `g2.linux.amd-zen4.4c-16g` |
| Working directory | `/bitrise/loupe` |
| Workspace link | `Loupe repo` → `/bitrise/loupe` |

A Linux/Android stack is enough — the agent edits JS/TS and pushes; it does not build a signed binary.
Swap to a macOS Xcode stack only if the agent must also produce an iOS build in-session.

## Session inputs

Pre-fill the two secret inputs from **encrypted saved inputs** of the same name so a session needs no
manual secret entry. All four are exposed as environment variables.

| Key | Required | Secret | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | yes | ✅ | Authenticates the Claude Code fix-it agent (its own credential, not a release secret). |
| `GIT_SSH_PRIVATE_KEY` | yes | ✅ | Git-only push deploy key. **No** GitHub API scope, **no** release secrets. |
| `LOUPE_FEEDBACK_PAYLOAD` | no (default `{}`) | — | The annotated feedback item (JSON: component/testID/`file:line`, screenshot ref, comment, CodePush label + deployment + app version). The agent turns this into a branch + PR. |
| `REPO_URL` | no (default `git@github.com:bitrise-silver/loupe.git`) | — | SSH git URL the agent pushes branches to. |

## Warmup script (runs once at session creation)

Installs the agent toolchain and does the first clone + install.

```bash
#!/usr/bin/env bash
# Runs ONCE at session creation. Installs the agent toolchain and does the first clone + install.
set -euxo pipefail

# --- Claude Code CLI (the fix-it agent) ---
curl -fsSL https://claude.ai/install.sh | bash || npm i -g @anthropic-ai/claude-code
export PATH="$HOME/.local/bin:$PATH"

# --- ensure git + gh are present (Android/Linux stack usually ships them) ---
command -v git >/dev/null || { sudo apt-get update && sudo apt-get install -y git; }
command -v gh  >/dev/null || { sudo apt-get update && sudo apt-get install -y gh || true; }

# --- git-only push identity: SSH deploy key ONLY (no GitHub API token, no release secrets) ---
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
printf '%s\n' "$GIT_SSH_PRIVATE_KEY" > "$HOME/.ssh/id_ed25519"
chmod 600 "$HOME/.ssh/id_ed25519"
ssh-keyscan -t ed25519 github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null || true
git config --global user.name  "Loupe Agent"
git config --global user.email "loupe-agent@users.noreply.github.com"

# --- first clone + JS deps ---
WORKDIR=/bitrise/loupe
sudo mkdir -p /bitrise && sudo chown -R "$(id -u):$(id -g)" /bitrise
if [ ! -d "$WORKDIR/.git" ]; then
  git clone "$REPO_URL" "$WORKDIR"
fi
cd "$WORKDIR"
npm ci
echo "warmup complete: toolchain installed, repo cloned, deps installed."
```

## Startup script (runs every session start — idempotent)

Re-materializes the key on a recycled box, resets the repo to a clean `main`, and echoes the payload.

```bash
#!/usr/bin/env bash
# Runs EVERY session start. Idempotent: safe to re-run on a recycled box.
set -euxo pipefail
export PATH="$HOME/.local/bin:$PATH"
WORKDIR=/bitrise/loupe

# Re-materialize the SSH deploy key if the box was recycled
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
if [ ! -f "$HOME/.ssh/id_ed25519" ]; then
  printf '%s\n' "$GIT_SSH_PRIVATE_KEY" > "$HOME/.ssh/id_ed25519"
  chmod 600 "$HOME/.ssh/id_ed25519"
  ssh-keyscan -t ed25519 github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null || true
fi
git config --global user.name  "Loupe Agent"
git config --global user.email "loupe-agent@users.noreply.github.com"

# Refresh the repo to a clean main (idempotent)
if [ -d "$WORKDIR/.git" ]; then
  cd "$WORKDIR"
  git fetch origin --prune
  git checkout main
  git reset --hard origin/main
else
  sudo mkdir -p /bitrise && sudo chown -R "$(id -u):$(id -g)" /bitrise
  git clone "$REPO_URL" "$WORKDIR"
  cd "$WORKDIR"
fi
npm ci

# The feedback item this session should act on (JSON). The agent reads this and opens a PR.
echo "--- LOUPE_FEEDBACK_PAYLOAD ---"
echo "$LOUPE_FEEDBACK_PAYLOAD"
```

## Recreating the template

The `bitrise-setup-loupe` skill provisions this in **step 5** (`bitrise_devenv_create_saved_input` for
the git-only key + `bitrise_devenv_create_template`), and **step 5b** tells the user to generate and
place `ANTHROPIC_API_KEY` and `GITHUB_API_TOKEN` themselves. To recreate by hand: create the two
encrypted saved inputs, then create a template with the stack/machine/scripts above and the four
session inputs. The agent's actual per-item reasoning prompt lives in the `process_feedback` step in
[`bitrise.yml`](../../bitrise.yml).
