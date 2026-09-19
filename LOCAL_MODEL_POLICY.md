# Local-model contribution policy

DEADGRID is an experiment in community development with locally run models. This policy applies to contributions submitted to this repository.

## The rule

Human-only contributions are welcome. If AI assists with a contribution, every model inference used to produce or materially revise that contribution must run on hardware controlled by the contributor or their team.

Allowed examples:

- llama.cpp, Ollama, LM Studio, vLLM, or another local runtime on your own machine;
- a model served from a workstation or server that you or your team directly control;
- local code completion, local agents, and local vision models;
- ordinary non-AI hosted tools such as GitHub, CI, package registries, search, and documentation sites.

Not allowed for submitted work:

- commercial or free hosted model APIs;
- web chat products that perform model inference remotely;
- cloud coding agents or cloud IDE features backed by remote models;
- routing a request through a local client when the actual inference happens on a third-party service.

## Pull-request disclosure

Every pull request must state one of the following:

1. `Human-only: no AI model was used`, or
2. the model name and quantization, runtime, hardware class, and confirmation that inference stayed local.

Prompt transcripts are welcome when useful for review but are not required. Never include private data, credentials, or unrelated conversation history.

This policy relies on contributor honesty; there is no reliable technical detector for model provenance. A false disclosure can result in a pull request being closed and future contributions being declined.

## Why this exists

The goal is to make capable, private, reproducible local development visible and approachable—not to reject human creativity or turn model choice into a purity test. Maintainers may refine the policy as the community learns what works.

## Project-origin exception

The original playable game was developed with the local model alias `qwen3.8-27b-256k` (Q4_K_M) recorded in this repository. Initial open-source packaging and governance files were prepared with external release-engineering assistance and are disclosed in [docs/PROVENANCE.md](docs/PROVENANCE.md). The local-only rule governs community contributions after publication.

