# Contributing to DEADGRID

Thanks for helping DEADGRID grow. Small, focused pull requests are easiest to review.

## Before you start

1. Read the [Local-model contribution policy](LOCAL_MODEL_POLICY.md) and [Code of Conduct](CODE_OF_CONDUCT.md).
2. Search existing Issues and Discussions.
3. For a large gameplay, architecture, or art-direction change, open a proposal first.
4. Only add assets you created or can redistribute. Record the creator, exact source URL, license, and any changes in `THIRD_PARTY_NOTICES.md`.

## Your first contribution

1. On GitHub, **fork** the repository to create your own copy.
2. Clone your fork and create a focused branch: `git switch -c short-description`.
3. Make and test your change.
4. Commit with a sign-off: `git commit -s -m "Describe the change"`.
5. Push the branch to your fork and open a pull request against `deadgrid:main`.

A pull request proposes a change; it does not directly alter the official game. Automated checks run first, then a maintainer reviews the code, licensing, local-model disclosure, and player-visible result. Review may result in questions or requested revisions. Once accepted, the maintainer merges the contribution and it becomes part of the official project.

If you are unsure where to begin, open a GitHub Discussion. Maintainers and other contributors can help shape an idea before you spend significant time implementing it.

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
- Sign off every commit with `git commit -s`. The sign-off records your agreement with the [Developer Certificate of Origin](DCO.md); it is not a transfer of your copyright.

Maintainers may ask for revisions or close work that cannot be licensed, cannot be reproduced, breaks the local-model policy, or conflicts with the project direction.

If you forgot the sign-off on your latest commit, run `git commit --amend --signoff` and push the amended commit to your branch. For a multi-commit pull request, ask in the pull request if you need help correcting older commits.

## Ownership and project identity

Contributors retain copyright in their original work while licensing it under Apache-2.0. Project decisions follow [GOVERNANCE.md](GOVERNANCE.md). The DEADGRID name and official branding are covered by [TRADEMARKS.md](TRADEMARKS.md), which encourages clearly identified community forks while preventing confusion with the official game.
