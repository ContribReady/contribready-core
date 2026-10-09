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
  assert.equal(summary.earned, 13.75);
  assert.equal(summary.possible, 100);
  assert.equal(summary.percentage, 14);
  assert.equal(summary.scoringVersion, 1);
  assert.equal(summary.unknownRules, 6);
  assert.equal(makeReport("repository", findings).schemaVersion, 1);
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
  const context = { repository: { files: { "pyproject.toml": "[project]", "README.md": "Use uv install and run pytest." } } };
  const finding = evaluateRules(context, coreRules).find((item) => item.rule.id === "CR-SETUP-003");
  assert.equal(finding.outcome, "pass");
});

test("setup rules distinguish complete, missing, and inapplicable setup evidence", () => {
  const ready = { repository: { files: {
    "README.md": "Getting started: Node.js 20. Run npm install. Set the environment variable API_URL.",
    "package.json": "{}",
    ".env.example": "API_URL=http://localhost",
    "CONTRIBUTING.md": "Contribute here",
    "SECURITY.md": "Report privately",
  } } };
  const readyFindings = evaluateRules(ready, coreRules).filter((finding) => finding.rule.area === "setup");
  assert.deepEqual(readyFindings.map((finding) => finding.outcome), ["pass", "pass", "pass", "pass", "pass"]);

  const incomplete = evaluateRules({ repository: { files: { "README.md": "Project overview", "package.json": "{}" } } }, coreRules);
  const byId = new Map(incomplete.map((finding) => [finding.rule.id, finding.outcome]));
  assert.equal(byId.get("CR-SETUP-003"), "fail");
  assert.equal(byId.get("CR-SETUP-004"), "fail");
  assert.equal(byId.get("CR-SETUP-005"), "not-applicable");
});

test("testing rules distinguish commands, reproduction, CI, and expectations", () => {
  const ready = { repository: { files: {
    "README.md": "Run npm test. To reproduce, use this minimal example. Expected result: the test should pass.",
    ".github/workflows/ci.yml": "name: CI",
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

test("contribution rules distinguish workflow, review, and support guidance", () => {
  const ready = { repository: { files: {
    "CONTRIBUTING.md": "Create a branch and open a pull request. Maintainer review and required checks are needed.",
    "SUPPORT.md": "Ask questions in the community discussion forum.",
  } } };
  const findings = evaluateRules(ready, coreRules).filter((finding) => finding.rule.area === "contribution");
  assert.deepEqual(findings.map((finding) => finding.outcome), ["pass", "pass", "pass", "pass"]);

  const incomplete = evaluateRules({ repository: { files: { "CONTRIBUTING.md": "Contribute here" } } }, coreRules);
  const byId = new Map(incomplete.map((finding) => [finding.rule.id, finding.outcome]));
  assert.equal(byId.get("CR-CONTRIB-001"), "pass");
  assert.equal(byId.get("CR-CONTRIB-002"), "fail");
  assert.equal(byId.get("CR-CONTRIB-003"), "fail");
  assert.equal(byId.get("CR-CONTRIB-004"), "unknown");
});

test("issue rules distinguish actionable and vague issue evidence", () => {
  const ready = { issue: {
    title: "Parser fails on empty input",
    body: "Context: the parser crashes. Steps to reproduce: run the command with an empty fixture. Expected behavior: return an empty result. Affected module: src/parser. Acceptance criteria: the fixture passes. Definition of done: tests pass and documentation is updated.",
    source: "issue.md",
  } };
  const readyFindings = evaluateRules(ready, coreRules).filter((finding) => finding.rule.area === "issue");
  assert.deepEqual(readyFindings.map((finding) => finding.outcome), ["pass", "pass", "pass", "pass", "pass", "pass"]);

  const vague = evaluateRules({ issue: { title: "Something is wrong", body: "Please fix this.", source: "vague.md" } }, coreRules);
  assert.equal(vague.filter((finding) => finding.rule.area === "issue" && finding.outcome === "fail").length, 6);
});

test("empty issue template labels are not treated as evidence and failures are described accurately", () => {
  const emptyTemplate = evaluateRules({ issue: {
    title: "Bug report",
    body: "## Problem\n\n### Steps to reproduce:\n\n**Expected behavior:**\n\nActual behavior:\n\nAffected component:\n\nAcceptance criteria:\n\nDefinition of done:",
    source: "template.md",
  } }, coreRules).filter((finding) => finding.rule.area === "issue");
  assert.deepEqual(emptyTemplate.map((finding) => finding.outcome), ["pass", "fail", "fail", "fail", "fail", "fail"]);
  assert.equal(emptyTemplate[0].message, "Evidence indicates a concrete problem or goal.");
  for (const finding of emptyTemplate.slice(1)) {
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
