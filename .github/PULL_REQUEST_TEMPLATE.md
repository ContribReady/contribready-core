<!-- Use real Markdown line breaks. Do not paste escaped \n text. -->

## Summary

<!-- Describe the Core behavior or contract change in 2–4 bullets. -->

- <!-- summary item -->

## Verification

<!-- List the exact checks run and their results. Do not claim checks that were not run. -->

- [ ] `npm run verify`
- [ ] Determinism and public-export checks
- [ ] `git diff --check`

## Security and compatibility

<!-- Confirm Core remains pure, or explain any boundary or contract impact. -->

- Core remains free of filesystem, network, GitHub, CLI, and target-code execution dependencies:
- Compatibility impact:

## Documentation

<!-- Link updated documentation, or explain why no documentation change is needed. -->

- <!-- documentation link or reason not required -->

## Scope

<!-- State important exclusions and any coordinated CLI or release follow-up. -->

- <!-- exclusion or follow-up -->

## Review checklist

- [ ] The change remains deterministic and framework-independent.
- [ ] Public types, rule IDs, scoring, or recommendations are documented.
- [ ] Tests cover the changed contract.
- [ ] No CLI, GitHub transport, secrets, or arbitrary target execution was added.
