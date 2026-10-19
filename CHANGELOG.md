# Changelog

## Unreleased

- Versioned `CR-SETUP-002` as rule v2 and detect explicit runtime/toolchain version disagreements across documentation and GitHub workflows. Conflicts remain `unknown`, include source-attributed normalized claims, and are not resolved by guessing; ambiguous multiple versions within one source remain unknown without being labeled a cross-document conflict. Version ranges and compatibility-matrix intent remain outside the heuristic.
- Preserve optional missing/conflicting evidence and conflict-assessment fields returned by rule evaluators instead of replacing them with empty defaults.
- Added scoring/report schema version 2 with determinate coverage; unknown findings are excluded from score points and remain explicit rather than being converted to failures.
- Added finding fields for missing/conflicting evidence and explicit conflict-assessment status; contradiction detection is not yet implemented and remains a documented gap.
- Tightened setup, contribution, security, and issue heuristics so conventional file names and empty headings alone do not establish actionable evidence.
- Issue readiness now treats empty template labels as prompts rather than evidence, searches issue-body evidence separately from the title, and reports accurate messages for failed checks.
- Added initial typed evidence, rule, finding, report, and score contracts.
- Added initial deterministic setup, testing, contribution, and security rules.
- Exported the core rule registry for CLI consumption.
- Added pure contributor-evidence path classification and deterministic inventory indexing.
- Added deterministic setup-readiness rules for runtime, installation, development steps, and environment configuration.
- Added deterministic testing/reproduction rules for commands, reproduction guidance, CI, and expected results.
- Added deterministic contribution workflow, pull-request, review, and support-path rules.
- Added deterministic issue-readiness rules for context, reproduction, behavior, scope, acceptance, and completion evidence.
- Added scoring version 1, category weighting, explicit unknown handling, and deterministic recommendations.
- Added repository-specific contributor and support guidance for independent Core onboarding.
- Expanded pure evidence classification and installation recognition for Deno, Bun, uv/PDM, SBT/Gradle, Docker, Nix, and additional toolchain files.
