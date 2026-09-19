# Contributing to DEADGRID

Thanks for helping DEADGRID grow. Small, focused pull requests are easiest to review.

## Before you start

1. Read the [Local-model contribution policy](LOCAL_MODEL_POLICY.md) and [Code of Conduct](CODE_OF_CONDUCT.md).
2. Search existing Issues and Discussions.
3. For a large gameplay, architecture, or art-direction change, open a proposal first.
4. Only add assets you created or can redistribute. Record the creator, exact source URL, license, and any changes in `THIRD_PARTY_NOTICES.md`.

## Development setup

```bash
npm ci
npm run dev
```

Before submitting:

```bash
npm run check
```

Then play the affected flow in a browser. Automated checks cannot validate pacing, lighting, navigation, weapon feel, or overall composition.

## Local-model workflow

You may use any capable local model and runtime. The repository includes an optional Qwen/OpenCode workflow:

```powershell
.\tools\deadgrid-harness\launch.ps1
```

See [the harness guide](tools/deadgrid-harness/README.md) for configuration. You do not need to use OpenCode or the included harness to contribute.

## Pull requests

- Keep unrelated changes out of the same pull request.
- Explain the player-visible result and how you tested it.
- Include screenshots or a short capture for visual changes.
- Update docs when behavior, controls, setup, or asset attribution changes.
- Complete the local-model provenance declaration in the pull-request template.
- By submitting a contribution, you agree that it is provided under Apache-2.0 and that you have the right to submit it.

Maintainers may ask for revisions or close work that cannot be licensed, cannot be reproduced, breaks the local-model policy, or conflicts with the project direction.

