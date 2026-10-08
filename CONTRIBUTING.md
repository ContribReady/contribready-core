# Contributing

Work on deterministic domain contracts, evidence classification, rules, scoring, and reports here. Keep filesystem, CLI, HTTP, GitHub, and target-repository execution out of Core. Add deterministic tests for every behavior and update the main project documentation when public contracts change.

## Workflow

Use Node.js 20, 22, or 24. Run `npm ci`, `npm run verify`, and inspect `npm pack --dry-run` before opening a focused branch and pull request. A pull request must explain the contract/rule change, include test and fixture evidence, and preserve the Core → adapter independence boundary.

Review requires passing CI and maintainer approval. Ask usage questions through `SUPPORT.md`; report vulnerabilities privately through `SECURITY.md`.
