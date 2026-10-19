<div align="center">
  <img src="assets/banner.svg" alt="ContribReady Core — deterministic analysis engine" width="100%" />
</div>

<div align="center">
  <a href="https://github.com/ContribReady/contribready-core/actions/workflows/ci.yml"><img src="https://github.com/ContribReady/contribready-core/actions/workflows/ci.yml/badge.svg?branch=main" alt="Core CI" /></a>
  <a href="https://github.com/ContribReady/contribready"><img src="https://img.shields.io/badge/Product-ContribReady-16a085" alt="ContribReady product repository" /></a>
  <a href="https://github.com/ContribReady/contribready-cli"><img src="https://img.shields.io/badge/Used%20by-CLI-6875f5" alt="ContribReady CLI repository" /></a>
</div>

# @contribready/core

The reusable deterministic ContribReady engine. It owns evidence-neutral contracts, path classification, setup/testing/contribution/issue rule metadata and evaluation, weighted scoring, recommendations, findings, summaries, and reports. Its evidence index and rules are pure and receive file contents from an adapter; it has no CLI, filesystem, GitHub, HTTP, or target-repository execution dependency.

The product-level source of truth is maintained in the main [`contribready`](https://github.com/ContribReady/contribready) repository. Its architecture and rule documentation define how this package fits into the complete product. The user-facing executable lives in [`contribready-cli`](https://github.com/ContribReady/contribready-cli).

## What Core owns

- Evidence-neutral data contracts and deterministic classification
- Setup, testing, contribution, and issue-readiness rules
- Weighted scoring, findings, summaries, and recommendations
- Pure behavior that does not access files, GitHub, HTTP, or target-repository code

```mermaid
flowchart LR
  A[CLI or another adapter] --> B[Core contracts]
  B --> C[Rules]
  C --> D[Findings + score + recommendations]
```

For contribution and support paths, see [CONTRIBUTING.md](CONTRIBUTING.md) and [SUPPORT.md](SUPPORT.md).

The npm package is not published yet. From this repository, run `npm ci && npm run verify` to lint/typecheck, build and test, and validate the npm package contents without publishing. The CLI declares Core as a registry dependency; before publication, the coordinated CI/release rehearsal packs Core and installs that tarball into CLI rather than importing a sibling source checkout. The proposal branch passed CI on Node.js 20, 22, and 24 on Ubuntu, Windows, and macOS; this does not imply npm publication or release.

Reports use schema/scoring version 2. Unknown findings are excluded from the determinate percentage and counted separately; read `coveragePercentage`, `unknownRules`, and `notApplicableRules` with the score. The score is the result produced by the documented rules against available evidence, not a claim about actual contributor success. Rule `CR-SETUP-002` now compares explicit runtime/toolchain version mentions across contributor-facing documentation and GitHub workflow files. When different requirement versions are found across sources, the result is `unknown`, source paths and normalized version claims are reported, and the analyzer does not choose an authoritative document. Multiple incompatible mentions within a single source also remain `unknown` without being asserted as a cross-document conflict. This bounded heuristic does not interpret version ranges, aliases, compatibility matrices, or migration intent; `conflictsAssessed: true` means only that this check ran, not that all contradictory documentation has been detected. Other rules still report `conflictsAssessed: false`. Core remains pure and deterministic; the local CLI consumes its public package contract, and the release process packs Core before CLI.

Phase 15 expands static evidence classification for Deno, Bun, uv/PDM, SBT/Gradle, Docker, Nix, and version/toolchain files. Classification remains pure and does not execute any ecosystem tooling.
