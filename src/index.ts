export type Area = "setup" | "testing" | "contribution" | "security" | "issue";
export type Severity = "info" | "low" | "medium" | "high";
export type Outcome = "pass" | "fail" | "unknown" | "not-applicable";

export interface Evidence {
  readonly kind: string;
  readonly source: string;
  readonly excerpt?: string;
  readonly details?: Readonly<Record<string, string>>;
}

export interface RepositoryEvidence {
  readonly files: Readonly<Record<string, string>>;
  readonly inventory?: readonly import("./evidence.js").EvidenceFile[];
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface IssueEvidence {
  readonly title: string;
  readonly body: string;
  readonly source: string;
  readonly details?: Readonly<Record<string, string>>;
}

export interface RuleMetadata {
  readonly id: string;
  readonly version: 1 | 2;
  readonly area: Area;
  readonly name: string;
  readonly purpose: string;
  readonly severity: Severity;
  readonly weight: number;
  readonly recommendation: string;
  readonly falsePositiveConsiderations: readonly string[];
  readonly falseNegativeLimitations: readonly string[];
}

export interface Finding {
  readonly rule: RuleMetadata;
  readonly outcome: Outcome;
  readonly message: string;
  readonly evidence: readonly Evidence[];
  readonly evidenceMissing: readonly string[];
  readonly conflictingEvidence: readonly Evidence[];
  readonly conflictsAssessed: boolean;
  readonly instructionVerification?: InstructionVerification;
  readonly recommendation: string;
}

export interface InstructionVerification {
  readonly documentation: "documented" | "not-found" | "external-link-only" | "unclear";
  readonly metadataConsistency: "not-assessed" | "consistent" | "conflicting";
  readonly execution: "not-run";
}

export interface RuleContext {
  readonly repository?: RepositoryEvidence;
  readonly issue?: IssueEvidence;
}

export type RuleEvaluation = Omit<Finding, "evidenceMissing" | "conflictingEvidence" | "conflictsAssessed"> & Partial<Pick<Finding, "evidenceMissing" | "conflictingEvidence" | "conflictsAssessed">>;
export type RuleEvaluator = (context: RuleContext) => RuleEvaluation;

export interface Rule { readonly metadata: RuleMetadata; readonly evaluate: RuleEvaluator; }

export interface Report {
  readonly schemaVersion: 2;
  readonly subject: "repository" | "issue";
  readonly findings: readonly Finding[];
  readonly score: ScoreSummary;
  readonly recommendations: readonly Recommendation[];
}

export interface CategoryScore {
  readonly area: Area;
  readonly weight: number;
  readonly earned: number;
  readonly possible: number;
  readonly percentage: number | null;
  readonly coveragePercentage: number | null;
  readonly passedRules: number;
  readonly failedRules: number;
  readonly unknownRules: number;
  readonly notApplicableRules: number;
}

export interface ScoreSummary {
  readonly earned: number;
  readonly possible: number;
  readonly percentage: number | null;
  readonly coveragePercentage: number | null;
  readonly unknownRules: number;
  readonly notApplicableRules: number;
  readonly evaluatedRules: number;
  readonly scoringVersion: 2;
  readonly categoryScores: readonly CategoryScore[];
}

export interface Recommendation {
  readonly ruleId: string;
  readonly area: Area;
  readonly outcome: "fail" | "unknown";
  readonly priority: "high" | "medium";
  readonly text: string;
}

export const AREA_WEIGHTS: Readonly<Record<Area, number>> = { setup: 30, testing: 25, contribution: 25, security: 20, issue: 100 };

export const RULES: readonly Rule[] = [];

export function evaluateRules(context: RuleContext, rules: readonly Rule[] = RULES): readonly Finding[] {
  return rules.map((rule) => {
    const finding = rule.evaluate(context);
    return {
      ...finding,
      evidenceMissing: finding.evidenceMissing ?? (finding.outcome === "fail" || finding.outcome === "unknown" ? [finding.rule.purpose] : []),
      conflictingEvidence: finding.conflictingEvidence ?? [],
      conflictsAssessed: finding.conflictsAssessed ?? false,
    };
  });
}

const round = (value: number): number => Math.round(value * 100) / 100;

export function summarize(findings: readonly Finding[]): ScoreSummary {
  const areas = (Object.keys(AREA_WEIGHTS) as Area[]).filter((area) => findings.some((finding) => finding.rule.area === area));
  const categoryScores = areas.map((area): CategoryScore => {
    const category = findings.filter((finding) => finding.rule.area === area);
    const applicable = category.filter((finding) => finding.outcome !== "not-applicable");
    const determinate = applicable.filter((finding) => finding.outcome === "pass" || finding.outcome === "fail");
    const pointsPerRule = applicable.length === 0 ? 0 : AREA_WEIGHTS[area] / applicable.length;
    const earned = determinate.filter((finding) => finding.outcome === "pass").length * pointsPerRule;
    const possible = determinate.length * pointsPerRule;
    return { area, weight: AREA_WEIGHTS[area], earned: round(earned), possible: round(possible), percentage: possible === 0 ? null : Math.round((earned / possible) * 100), coveragePercentage: applicable.length === 0 ? null : Math.round((determinate.length / applicable.length) * 100), passedRules: determinate.filter((finding) => finding.outcome === "pass").length, failedRules: determinate.filter((finding) => finding.outcome === "fail").length, unknownRules: applicable.filter((finding) => finding.outcome === "unknown").length, notApplicableRules: category.filter((finding) => finding.outcome === "not-applicable").length };
  });
  const earned = round(categoryScores.reduce((sum, category) => sum + category.earned, 0));
  const possible = categoryScores.reduce((sum, category) => sum + category.possible, 0);
  const evaluatedRules = findings.filter((finding) => finding.outcome === "pass" || finding.outcome === "fail").length;
  const applicableRules = findings.filter((finding) => finding.outcome !== "not-applicable").length;
  return { earned, possible, percentage: possible === 0 ? null : Math.round((earned / possible) * 100), coveragePercentage: applicableRules === 0 ? null : Math.round((evaluatedRules / applicableRules) * 100), unknownRules: findings.filter((finding) => finding.outcome === "unknown").length, notApplicableRules: findings.filter((finding) => finding.outcome === "not-applicable").length, evaluatedRules, scoringVersion: 2, categoryScores };
}

export function buildRecommendations(findings: readonly Finding[]): readonly Recommendation[] {
  const areaOrder: Record<Area, number> = { setup: 0, testing: 1, contribution: 2, security: 3, issue: 4 };
  return findings.filter((finding): finding is Finding & { outcome: "fail" | "unknown" } => finding.outcome === "fail" || finding.outcome === "unknown").map((finding): Recommendation => ({ ruleId: finding.rule.id, area: finding.rule.area, outcome: finding.outcome, priority: finding.outcome === "fail" ? "high" : "medium", text: finding.recommendation })).sort((left, right) => (left.priority === right.priority ? areaOrder[left.area] - areaOrder[right.area] || left.ruleId.localeCompare(right.ruleId) : left.priority === "high" ? -1 : 1));
}

export function makeReport(subject: Report["subject"], findings: readonly Finding[]): Report {
  return { schemaVersion: 2, subject, findings, score: summarize(findings), recommendations: buildRecommendations(findings) };
}

export { coreRules } from "./rules.js";
export { buildEvidenceIndex, classifyEvidencePath } from "./evidence.js";
export type { EvidenceCategory, EvidenceFile } from "./evidence.js";
