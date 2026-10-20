import test from "node:test";
import assert from "node:assert/strict";
import { buildEvidenceIndex, classifyEvidencePath, evaluateRules, makeReport, summarize } from "../dist/index.js";
import { coreRules } from "../dist/rules.js";

test("core rules are deterministic for identical evidence", () => {
  const context = { repository: { files: { "README.md": "Install with npm. Run npm test.", "CONTRIBUTING.md": "Contribute here", "SECURITY.md": "Report privately" } } };
  assert.deepEqual(evaluateRules(context, coreRules), evaluateRules(context, coreRules));
});

test("summary is explainable and bounded", () => {
  const findings = evaluateRules({ repository: { files: { "CONTRIBUTING.md": "yes" } } }, coreRules);
  const summary = summarize(findings);
  assert.equal(summary.earned, 0);
  assert.equal(summary.possible, 20);
  assert.equal(summary.percentage, 0);
  assert.equal(summary.scoringVersion, 2);
  assert.equal(summary.unknownRules, 12);
  assert.equal(makeReport("repository", findings).schemaVersion, 2);
  assert.equal(findings.find((finding) => finding.outcome === "unknown").evidenceMissing.length, 1);
  assert.equal(findings.find((finding) => finding.rule.id === "CR-SETUP-002")?.conflictsAssessed, true);
  assert.equal(findings.filter((finding) => finding.rule.id !== "CR-SETUP-002").every((finding) => finding.conflictsAssessed === false), true);
});

test("unknown findings do not count as failed points and an all-unknown score is unavailable", () => {
  const unknownOnly = [{
    rule: { id: "CR-TEST-999", version: 1, area: "testing", name: "unknown", purpose: "unknown", severity: "info", weight: 1, recommendation: "Review evidence", falsePositiveConsiderations: [], falseNegativeLimitations: [] },
    outcome: "unknown", message: "Evidence is inconclusive", evidence: [], evidenceMissing: ["Test output"], conflictingEvidence: [], conflictsAssessed: false, recommendation: "Review evidence",
  }];
  const score = summarize(unknownOnly);
  assert.equal(score.earned, 0);
  assert.equal(score.possible, 0);
  assert.equal(score.percentage, null);
  assert.equal(score.unknownRules, 1);
  assert.equal(score.evaluatedRules, 0);
});

test("evidence classification is deterministic and ignores unknown source files", () => {
  assert.equal(classifyEvidencePath(".github/workflows/ci.yml"), "workflow");
  assert.equal(classifyEvidencePath("tests/example.test.ts"), "test");
  assert.equal(classifyEvidencePath("src/application.ts"), null);
  assert.equal(classifyEvidencePath("uv.lock"), "lockfile");
  assert.equal(classifyEvidencePath("deno.json"), "manifest");
  assert.equal(classifyEvidencePath("Dockerfile"), "manifest");
  assert.deepEqual(buildEvidenceIndex({ "src/application.ts": "secret", "README.md": "read me", "package-lock.json": "{}" }), [
    { path: "package-lock.json", category: "lockfile", bytes: 2 },
    { path: "README.md", category: "readme", bytes: 7 },
  ]);
});

test("expanded ecosystem installation evidence remains static and deterministic", () => {
  const context = { repository: { files: { "pyproject.toml": "[project]", "README.md": "Use uv sync and run pytest." } } };
  const finding = evaluateRules(context, coreRules).find((item) => item.rule.id === "CR-SETUP-003");
  assert.equal(finding.outcome, "pass");
});

test("setup rules distinguish complete, missing, and inapplicable setup evidence", () => {
  const ready = { repository: { files: {
    "README.md": "Getting started: Node.js 20.\n\n```sh\nnpm ci\nnpm test\n```",
    "package.json": "{}",
    "package-lock.json": "{}",
    ".env.example": "API_URL=http://localhost",
    "CONTRIBUTING.md": "Create a branch, run npm test, and open a pull request.",
    "SECURITY.md": "Report vulnerabilities privately using Security → Advisories → Report a vulnerability.",
  } } };
  const readyFindings = evaluateRules(ready, coreRules).filter((finding) => finding.rule.area === "setup");
  assert.deepEqual(readyFindings.map((finding) => finding.outcome), ["pass", "pass", "pass", "pass", "pass"]);

  const incomplete = evaluateRules({ repository: { files: { "README.md": "Project overview", "package.json": "{}" } } }, coreRules);
  const byId = new Map(incomplete.map((finding) => [finding.rule.id, finding.outcome]));
  assert.equal(byId.get("CR-SETUP-003"), "fail");
  assert.equal(byId.get("CR-SETUP-004"), "unknown");
  assert.equal(byId.get("CR-SETUP-005"), "unknown");
});

test("runtime version conflicts are explicit, unresolved, source-attributed, and deterministic", () => {
  const context = { repository: { files: {
    "README.md": "Getting started: use Node.js 20.",
    "CONTRIBUTING.md": "Install Node 18 before running the tests.",
    ".github/workflows/ci.yml": "steps:\n  - uses: actions/setup-node@v5\n    with:\n      node-version: 20",
  } } };
  const [first] = evaluateRules(context, coreRules).filter((finding) => finding.rule.id === "CR-SETUP-002");
  const [second] = evaluateRules(context, coreRules).filter((finding) => finding.rule.id === "CR-SETUP-002");
  assert.equal(first.outcome, "unknown");
  assert.equal(first.rule.version, 2);
  assert.equal(first.conflictsAssessed, true);
  assert.deepEqual(first.evidenceMissing, ["A single, consistent supported runtime/toolchain version"]);
  assert.deepEqual(first.conflictingEvidence.map((item) => [item.source, item.details.version]), [
    [".github/workflows/ci.yml", "20"],
    ["CONTRIBUTING.md", "18"],
    ["README.md", "20"],
  ]);
  assert.ok(first.conflictingEvidence.every((item) => item.excerpt === `node version claim: ${item.details.version}`));
  assert.deepEqual(first, second);
});

test("matching runtime versions do not conflict and insufficient version evidence stays unknown", () => {
  const matching = evaluateRules({ repository: { files: {
    "README.md": "Use Node.js 20.",
    "CONTRIBUTING.md": "Node version 20 is required.",
    ".github/workflows/ci.yml": "node-version: 20.x",
  } } }, coreRules).find((finding) => finding.rule.id === "CR-SETUP-002");
  assert.equal(matching.outcome, "pass");
  assert.equal(matching.conflictsAssessed, true);
  assert.equal(matching.conflictingEvidence.length, 0);

  const missing = evaluateRules({ repository: { files: { "README.md": "Install and test the project." } } }, coreRules)
    .find((finding) => finding.rule.id === "CR-SETUP-002");
  assert.equal(missing.outcome, "unknown");
  assert.equal(missing.conflictsAssessed, true);
  assert.equal(missing.conflictingEvidence.length, 0);

  const ambiguous = evaluateRules({ repository: { files: {
    "README.md": "Node.js 18 was previously supported; the current setup uses Node.js 20.",
    "CONTRIBUTING.md": "Use Node.js 20.",
  } } }, coreRules).find((finding) => finding.rule.id === "CR-SETUP-002");
  assert.equal(ambiguous.outcome, "unknown");
  assert.match(ambiguous.message, /cannot determine whether these are alternatives/);
  assert.equal(ambiguous.conflictingEvidence.length, 0);
});

test("Windows-style workflow paths are normalized and included in runtime conflict evidence", () => {
  const finding = evaluateRules({ repository: { files: {
    "README.md": "Use Node.js 18.",
    ".github\\workflows\\ci.yml": "with:\n  node-version: 20",
  } } }, coreRules).find((item) => item.rule.id === "CR-SETUP-002");
  assert.equal(finding.outcome, "unknown");
  assert.deepEqual(finding.conflictingEvidence.map((item) => [item.source, item.details.version]), [
    [".github/workflows/ci.yml", "20"],
    ["README.md", "18"],
  ]);
});
test("testing rules distinguish commands, reproduction, CI, and expectations", () => {
  const ready = { repository: { files: {
    "README.md": "Run npm test.\n\nSteps to reproduce:\n1. Run the parser with an empty fixture.\n\nExpected result: the test should pass.",
    ".github/workflows/ci.yml": "name: CI\njobs:\n  test:\n    steps:\n      - run: npm test",
    "tests/example.test.ts": "assert(true)",
  } } };
  const findings = evaluateRules(ready, coreRules).filter((finding) => finding.rule.area === "testing");
  assert.deepEqual(findings.map((finding) => finding.outcome), ["pass", "pass", "pass", "pass"]);

  const incomplete = evaluateRules({ repository: { files: { "README.md": "Run npm test." } } }, coreRules);
  const byId = new Map(incomplete.map((finding) => [finding.rule.id, finding.outcome]));
  assert.equal(byId.get("CR-TEST-001"), "pass");
  assert.equal(byId.get("CR-TEST-002"), "unknown");
  assert.equal(byId.get("CR-TEST-003"), "unknown");
  assert.equal(byId.get("CR-TEST-004"), "unknown");
});

test("setup documentation is distinct from static metadata consistency and execution", () => {
  const matching = evaluateRules({ repository: { files: {
    "CONTRIBUTING.md": "Install dependencies with pnpm i, then run pnpm test.",
    "package.json": JSON.stringify({ packageManager: "pnpm@12.14.0" }),
    "pnpm-lock.yaml": "lockfileVersion: '9.0'",
  } } }, coreRules).find((finding) => finding.rule.id === "CR-SETUP-003");
  assert.equal(matching.outcome, "pass");
  assert.deepEqual(matching.instructionVerification, { documentation: "documented", metadataConsistency: "consistent", execution: "not-run" });

  const conflicting = evaluateRules({ repository: { files: {
    "CONTRIBUTING.md": "Install dependencies with pnpm i.",
    "package.json": JSON.stringify({ packageManager: "npm@10.0.0" }),
    "package-lock.json": "{}",
  } } }, coreRules).find((finding) => finding.rule.id === "CR-SETUP-003");
  assert.equal(conflicting.outcome, "unknown");
  assert.equal(conflicting.instructionVerification.metadataConsistency, "conflicting");
  assert.equal(conflicting.instructionVerification.execution, "not-run");
});

test("historical and example documentation cannot satisfy contributor setup or test rules", () => {
  const findings = evaluateRules({ repository: { files: {
    "CHANGES.rst": "To install use pip install package. Run pytest. Expected result: success.",
    "examples/demo/pyproject.toml": "[project]",
    "examples/demo/README.md": "Run uv sync and pytest.",
    "pyproject.toml": "[project]\nname = 'sample'",
    ".github/workflows/labeler.yml": "name: labeler\nsteps:\n  - run: echo label",
  } } }, coreRules);
  const byId = new Map(findings.map((finding) => [finding.rule.id, finding]));
  assert.notEqual(byId.get("CR-SETUP-001").outcome, "pass");
  assert.notEqual(byId.get("CR-SETUP-003").outcome, "pass");
  assert.notEqual(byId.get("CR-TEST-001").outcome, "pass");
  assert.notEqual(byId.get("CR-TEST-003").outcome, "pass");
});

test("primary README content remains usable when it has headings but no recognized contributor heading", () => {
  const finding = evaluateRules({ repository: { files: {
    "README.md": "# Project overview\nA TypeScript project.\n\n## Getting started\nUse Node.js 20 and install dependencies with npm ci.",
    "package.json": "{}",
    "package-lock.json": "{}",
  } } }, coreRules).find((item) => item.rule.id === "CR-SETUP-003");
  assert.equal(finding.outcome, "pass");
  assert.deepEqual(finding.instructionVerification, { documentation: "documented", metadataConsistency: "consistent", execution: "not-run" });
});

test("contribution rules distinguish workflow, review, and support guidance", () => {
  const ready = { repository: { files: {
    "CONTRIBUTING.md": "Create a branch and open a pull request. Maintainer review and required checks are needed.",
    "SUPPORT.md": "Ask questions in the community discussion forum at https://example.test/support.",
  } } };
  const findings = evaluateRules(ready, coreRules).filter((finding) => finding.rule.area === "contribution");
  assert.deepEqual(findings.map((finding) => finding.outcome), ["pass", "pass", "pass", "pass"]);

  const incomplete = evaluateRules({ repository: { files: { "CONTRIBUTING.md": "Contribute here" } } }, coreRules);
  const byId = new Map(incomplete.map((finding) => [finding.rule.id, finding.outcome]));
  assert.equal(byId.get("CR-CONTRIB-001"), "unknown");
  assert.equal(byId.get("CR-CONTRIB-002"), "unknown");
  assert.equal(byId.get("CR-CONTRIB-003"), "unknown");
  assert.equal(byId.get("CR-CONTRIB-004"), "unknown");
});

test("conventional policy filenames with vague text do not pass actionability rules", () => {
  const findings = evaluateRules({ repository: { files: {
    "README.md": "Project overview. Runtime configuration and getting started are important.",
    "CONTRIBUTING.md": "Contribute here.",
    "SECURITY.md": "Report privately.",
    "SUPPORT.md": "Ask in the community.",
  } } }, coreRules);
  const byId = new Map(findings.map((finding) => [finding.rule.id, finding]));
  for (const id of ["CR-SETUP-001", "CR-CONTRIB-001", "CR-CONTRIB-004", "CR-SECURITY-001"]) {
    assert.notEqual(byId.get(id).outcome, "pass", `${id} must not pass from a filename/phrase alone`);
  }
});

test("issue rules distinguish actionable and vague issue evidence", () => {
  const ready = { issue: {
    title: "Parser fails on empty input",
    body: "Context: the parser crashes because an empty document causes an exception.\n\nSteps to reproduce:\n1. Run the parser with an empty fixture.\n\nExpected behavior: return an empty result.\nActual behavior: the parser crashes.\n\nAffected module: src/parser.\n\nAcceptance criteria:\n- The empty fixture returns an empty result.\n\nDefinition of done:\n- Tests pass and documentation is updated.",
    source: "issue.md",
  } };
  const readyFindings = evaluateRules(ready, coreRules).filter((finding) => finding.rule.area === "issue");
  assert.deepEqual(readyFindings.map((finding) => finding.outcome), ["pass", "pass", "pass", "pass", "pass", "pass"]);

  const vague = evaluateRules({ issue: { title: "Something is wrong", body: "Please fix this.", source: "vague.md" } }, coreRules);
  assert.equal(vague.filter((finding) => finding.rule.area === "issue" && finding.outcome === "fail").length, 6);
});

test("issue rules accept Markdown headings and spacing before populated lists", () => {
  const body = `## Context
The parser crashes for empty input.

## Steps to reproduce

- Run the parser with the empty fixture.

## Expected behavior: return an empty result.

## Actual behavior: the parser throws an exception.

## Technical scope
Affected module: src/parser.ts.

## Acceptance criteria:

- Empty input returns an empty result.

## Definition of done:

- Regression tests pass.
`;
  const findings = evaluateRules({ issue: { title: "Parser fails for empty input", body, source: "issue.md" } }, coreRules)
    .filter((finding) => finding.rule.area === "issue");
  assert.deepEqual(findings.map((finding) => finding.outcome), ["pass", "pass", "pass", "pass", "pass", "pass"]);
});

test("empty issue template labels are not treated as evidence and failures are described accurately", () => {
  const emptyTemplate = evaluateRules({ issue: {
    title: "Bug report",
    body: "## Problem\n\n### Steps to reproduce:\n\n**Expected behavior:**\n\nActual behavior:\n\nAffected component:\n\nAcceptance criteria:\n\nDefinition of done:",
    source: "template.md",
  } }, coreRules).filter((finding) => finding.rule.area === "issue");
  assert.deepEqual(emptyTemplate.map((finding) => finding.outcome), ["fail", "fail", "fail", "fail", "fail", "fail"]);
  for (const finding of emptyTemplate) {
    assert.match(finding.message, /^No /);
    assert.equal(finding.evidence.length, 0);
  }
});

test("scoring recommendations are deterministic and prioritize failures", () => {
  const findings = evaluateRules({ repository: { files: { "CONTRIBUTING.md": "Contribute here" } } }, coreRules);
  const report = makeReport("repository", findings);
  assert.equal(report.recommendations[0].priority, "high");
  assert.equal(report.recommendations.some((recommendation) => recommendation.outcome === "unknown"), true);
  assert.deepEqual(report.recommendations, makeReport("repository", findings).recommendations);
});
