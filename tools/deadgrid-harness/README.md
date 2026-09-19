# DEADGRID local-model harness

This optional workflow runs OpenCode against a Qwen model served entirely on contributor-controlled hardware. It is not required to build or play the game.

## Requirements

- Windows PowerShell;
- [OpenCode](https://opencode.ai/) available as `opencode` on `PATH`;
- an OpenAI-compatible local inference server;
- a locally available model whose served ID matches `qwen3.8-27b-256k`, or an override supplied through `DEADGRID_MODEL`.

The checked-in `opencode.json` points the `llamacpp-local` provider at `http://127.0.0.1:11435/v1`. No API key or hosted inference service is used.

## Start

Start your local model server, then from the repository root run:

```powershell
.\tools\deadgrid-harness\launch.ps1
```

The launcher validates project state, confirms the model is advertised by `GET /v1/models`, performs a small warm-up request, and opens OpenCode with isolated project-local state.

## Configuration

These optional environment variables avoid editing repository files:

| Variable | Purpose |
| --- | --- |
| `DEADGRID_QWEN_URL` | Local server base URL without `/v1`; default `http://127.0.0.1:11435` |
| `DEADGRID_MODEL` | Served model ID; default `qwen3.8-27b-256k` |
| `DEADGRID_REAL_OPENCODE` | Full path to the OpenCode executable if it is not on `PATH` |
| `DEADGRID_ROUTER_SCRIPT` | Optional local router script that the launcher may start |
| `DEADGRID_PYTHON` | Python or Pythonw executable used with the optional router script |

If you change the endpoint or model ID, also update your local copy of the provider block in `opencode.json`. Do not commit machine-specific paths or credentials.

## What the harness does

The repository plugin classifies the task, creates a concise session context, limits broad/repeated reads, enforces task-specific file allowlists, runs TypeScript and production-build checkpoints, and records human QA still needed. Local runtime state is ignored by Git.

Useful commands inside OpenCode are `/deadgrid-status`, `/deadgrid-checkpoint`, and `/deadgrid-handoff`.

Manual maintenance commands:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/deadgrid-harness/validate-state.ps1
node tools/deadgrid-harness/self-test.mjs
node tools/deadgrid-harness/loop-test.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File tools/deadgrid-harness/checkpoint.ps1 -Kind all
```

The harness deliberately leaves visual composition, gameplay pacing, navigation feel, weapon feel, lighting, and readability to human play-testing.

