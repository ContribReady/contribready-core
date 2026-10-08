export type EvidenceCategory = "readme" | "manifest" | "lockfile" | "workflow" | "test" | "template" | "policy" | "documentation";

export interface EvidenceFile {
  readonly path: string;
  readonly category: EvidenceCategory;
  readonly bytes: number;
}

const normalize = (path: string): string => path.replaceAll("\\", "/").replace(/^\.\//, "");
const basename = (path: string): string => normalize(path).split("/").at(-1)?.toLowerCase() ?? "";

export function classifyEvidencePath(path: string): EvidenceCategory | null {
  const normalized = normalize(path).toLowerCase();
  const name = basename(normalized);
  if (/^readme(?:\.|$)/.test(name)) return "readme";
  if ([".env.example", ".env.sample", "example.env"].includes(name)) return "documentation";
  if (["package.json", "pyproject.toml", "cargo.toml", "go.mod", "pom.xml", "build.gradle", "build.gradle.kts", "build.sbt", "gradle.properties", "composer.json", "gemfile", "mix.exs", "deno.json", "deno.jsonc", "bunfig.toml", "requirements.txt", "requirements-dev.txt", "environment.yml", "environment.yaml", "flake.nix", "dockerfile", ".python-version", ".ruby-version", ".nvmrc", ".tool-versions"].includes(name)) return "manifest";
  if (["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "pnpm-lock.yaml", "bun.lock", "bun.lockb", "cargo.lock", "go.sum", "poetry.lock", "pdm.lock", "uv.lock", "composer.lock", "gemfile.lock"].includes(name)) return "lockfile";
  if (normalized.includes("/.github/workflows/") || normalized.startsWith(".github/workflows/")) return "workflow";
  if (/(^|\/)(test|tests|spec|specs|__tests__)(\/|$)/.test(normalized) || /(?:\.test|\.spec)\.[^/]+$/.test(name)) return "test";
  if (normalized.includes("/.github/issue_template/") || normalized.includes("/.github/issue-templates/") || normalized.includes("/.github/pull_request_template") || normalized.includes("/pull_request_template") || name === "pull_request_template.md") return "template";
  if (["contributing.md", "security.md", "support.md", "code_of_conduct.md", "governance.md", "maintainers.md", "license", "license.md"].includes(name)) return "policy";
  if (normalized.startsWith("docs/") || normalized.includes("/docs/") || /\.(md|mdx|rst|adoc|txt)$/.test(name)) return "documentation";
  return null;
}

export function buildEvidenceIndex(files: Readonly<Record<string, string>>): readonly EvidenceFile[] {
  return Object.entries(files)
    .map(([path, value]) => { const category = classifyEvidencePath(path); return category ? { path: normalize(path), category, bytes: new TextEncoder().encode(value).byteLength } : null; })
    .filter((file): file is EvidenceFile => file !== null)
    .sort((left, right) => left.path.localeCompare(right.path));
}
