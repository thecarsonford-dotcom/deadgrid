# Project provenance

## Original game

The project owner reports that the original DEADGRID game was created exclusively with a locally run model identified in the project files as:

- display name: Qwen3.8 27B;
- served model ID: `qwen3.8-27b-256k`;
- quantization: Q4_K_M;
- inference: local, through an OpenAI-compatible llama.cpp-style endpoint;
- coding interface: OpenCode with the repository-local DEADGRID harness.

The checked-in `opencode.json`, `.opencode/`, `.deadgrid/`, and `tools/deadgrid-harness/` files preserve the repeatable parts of that workflow. Model weights are not redistributed by this project.

“Created with” describes the development method; it does not imply endorsement by or affiliation with the Qwen team, Alibaba, OpenCode, or llama.cpp.

## Open-source preparation

On 2026-09-19, external release-engineering assistance was used to audit the folder, verify third-party asset metadata, add licensing and community files, make the local-model launcher portable, configure automated builds and GitHub Pages, and prepare the initial public repository.

This distinction preserves the accurate claim that the original playable game was created with the local Qwen model without falsely attributing later repository administration and documentation to it.

## Verification limits

Model provenance is not cryptographically verifiable from source code. This record is a good-faith account supported by the surviving project configuration and harness files. Historical private prompts, runtime state, caches, and machine-specific files are intentionally excluded from the public repository.

