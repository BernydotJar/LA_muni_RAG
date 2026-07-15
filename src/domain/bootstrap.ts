import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { evaluateDomainPack } from "./evaluation.js";
import type { DomainPack } from "./types.js";
import { validateDomainPack } from "./validation.js";
import type { EditableWorkflowTemplateCollection } from "../workflowTemplates/types.js";

export type DomainBootstrapErrorCode =
  | "invalid_arguments"
  | "invalid_id"
  | "reserved_id"
  | "invalid_name"
  | "invalid_language"
  | "target_exists"
  | "invalid_scaffold"
  | "write_failed";

export class DomainBootstrapError extends Error {
  constructor(readonly code: DomainBootstrapErrorCode, message: string) {
    super(message);
    this.name = "DomainBootstrapError";
  }
}

export interface DomainBootstrapOptions {
  id: string;
  name: string;
  language: string;
  dryRun: boolean;
}

export interface DomainPackDraftManifest {
  schemaVersion: 1;
  status: "draft";
  authoritative: false;
  id: string;
  name: string;
  description: string;
  language: string;
  branding: DomainPack["branding"];
  workflowTypes: DomainPack["workflowTypes"];
  sourceAuthorityClasses: DomainPack["sourceAuthorityClasses"];
  classifierRules: DomainPack["classifierRules"];
  governanceRules: DomainPack["governanceRules"];
  feedbackTypes: DomainPack["feedbackTypes"];
  exampleQueries: string[];
  evaluationCases: DomainPack["evaluationCases"];
}

export interface ScaffoldFile {
  path: string;
  content: string;
}

export interface DomainPackScaffold {
  manifest: DomainPackDraftManifest;
  templates: EditableWorkflowTemplateCollection;
  files: ScaffoldFile[];
}

export interface DomainBootstrapResult {
  status: "dry_run" | "created";
  target: string;
  fileCount: number;
  files: string[];
}

const SAFE_ID = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SAFE_LANGUAGE = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;
const RESERVED_IDS = new Set([
  "municipal-antigua",
  "hr",
  "finance",
  "sales-sop",
  "custom",
  "default",
  "system",
  "admin",
  "api",
  "public",
]);

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

export const parseDomainInitArgs = (args: string[]): DomainBootstrapOptions => {
  const values = new Map<string, string>();
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (current === "--dry-run") {
      if (dryRun) {
        throw new DomainBootstrapError("invalid_arguments", "duplicate argument: --dry-run");
      }
      dryRun = true;
      continue;
    }
    if (!current || !current.startsWith("--")) {
      throw new DomainBootstrapError("invalid_arguments", "arguments must use supported --flags");
    }
    if (!["--id", "--name", "--language"].includes(current)) {
      throw new DomainBootstrapError("invalid_arguments", `unsupported argument: ${current}`);
    }
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      throw new DomainBootstrapError("invalid_arguments", `missing value for ${current}`);
    }
    if (values.has(current)) {
      throw new DomainBootstrapError("invalid_arguments", `duplicate argument: ${current}`);
    }
    values.set(current, next);
    index += 1;
  }

  return validateDomainBootstrapOptions({
    id: values.get("--id") ?? "",
    name: values.get("--name") ?? "",
    language: values.get("--language") ?? "en",
    dryRun,
  });
};

export const validateDomainBootstrapOptions = (options: DomainBootstrapOptions): DomainBootstrapOptions => {
  const id = options.id.trim();
  const name = options.name.trim();
  const language = options.language.trim();

  if (!id || id.length > 63 || !SAFE_ID.test(id)) {
    throw new DomainBootstrapError("invalid_id", "id must be a safe lowercase kebab-case value of at most 63 characters");
  }
  if (RESERVED_IDS.has(id)) {
    throw new DomainBootstrapError("reserved_id", `domain pack id is reserved: ${id}`);
  }
  if (!name || name.length > 120) {
    throw new DomainBootstrapError("invalid_name", "name must contain 1 to 120 characters");
  }
  if (!SAFE_LANGUAGE.test(language)) {
    throw new DomainBootstrapError("invalid_language", "language must use a safe language tag such as en or es");
  }
  return { id, name, language, dryRun: Boolean(options.dryRun) };
};

const renderReadme = (options: DomainBootstrapOptions): string => `# ${options.name}\n\n> DRAFT PLACEHOLDER — not registered, published, or authoritative.\n\nThis scaffold must be reviewed by a domain owner before integration. Replace all placeholder descriptions, queries, evaluation cases, authority classes, governance rules, and branding with verified organizational content.\n\nDo not add fabricated laws, policies, deadlines, approvals, organizations, or responsible roles. Add workflow templates only after evidence and governance requirements are defined.\n\nFiles:\n\n- \`domain-pack.json\`: draft pack metadata and placeholders.\n- \`workflow-templates.json\`: empty, non-authoritative workflow collection.\n- \`starter.test.ts\`: focused starter contract test.\n`;

const renderStarterTest = (options: DomainBootstrapOptions): string => `import assert from "node:assert/strict";\nimport test from "node:test";\n\ntest("${options.id} scaffold remains draft and non-authoritative", async () => {\n  const manifest = await import("./domain-pack.json", { with: { type: "json" } });\n  const templates = await import("./workflow-templates.json", { with: { type: "json" } });\n  assert.equal(manifest.default.status, "draft");\n  assert.equal(manifest.default.authoritative, false);\n  assert.deepEqual(templates.default.templates, []);\n});\n`;

export const renderDomainPackScaffold = (input: DomainBootstrapOptions): DomainPackScaffold => {
  const options = validateDomainBootstrapOptions(input);
  const manifest: DomainPackDraftManifest = {
    schemaVersion: 1,
    status: "draft",
    authoritative: false,
    id: options.id,
    name: options.name,
    description: "DRAFT PLACEHOLDER: describe the verified scope of this domain pack.",
    language: options.language,
    branding: {
      productName: `${options.name} — Draft`,
      assistantName: "Draft Workflow Assistant",
      primaryLabel: "Draft placeholder — evidence required",
    },
    workflowTypes: [
      {
        id: "draft_workflow",
        label: "Draft workflow placeholder",
        description: "DRAFT PLACEHOLDER: replace with a verified workflow type.",
        retrievalHints: ["draft placeholder evidence workflow"],
      },
    ],
    sourceAuthorityClasses: [
      {
        id: "draft-source",
        label: "Draft source placeholder",
        description: "DRAFT PLACEHOLDER: define verified source authority and provenance.",
        authorityLevel: "unknown",
        titleKeywords: ["draft", "placeholder"],
        sourceTypes: ["draft"],
      },
    ],
    classifierRules: [
      {
        id: "draft-workflow-rule",
        workflowType: "draft_workflow",
        keywords: ["draft", "placeholder"],
        retrievalQueries: ["draft placeholder evidence workflow"],
      },
    ],
    governanceRules: [
      {
        id: "draft-evidence-required",
        label: "Draft evidence required",
        warning: "DRAFT PLACEHOLDER: do not treat generated content as authoritative; require human review and verified evidence.",
      },
    ],
    feedbackTypes: [],
    exampleQueries: ["DRAFT PLACEHOLDER: What verified process should this assistant support?"],
    evaluationCases: [
      {
        id: "draft-workflow-placeholder",
        query: "draft placeholder workflow",
        expectedWorkflowType: "draft_workflow",
        notes: "DRAFT PLACEHOLDER: replace with a verified clean-room evaluation case.",
      },
    ],
  };
  const templates: EditableWorkflowTemplateCollection = {
    schemaVersion: 1,
    domainPackId: options.id,
    templates: [],
  };
  const files = [
    { path: "README.md", content: renderReadme(options) },
    { path: "domain-pack.json", content: json(manifest) },
    { path: "starter.test.ts", content: renderStarterTest(options) },
    { path: "workflow-templates.json", content: json(templates) },
  ].sort((left, right) => left.path.localeCompare(right.path));

  const scaffold = { manifest, templates, files };
  validateDomainPackScaffold(scaffold);
  return scaffold;
};

export const validateDomainPackScaffold = (scaffold: DomainPackScaffold): DomainPackScaffold => {
  const { manifest, templates, files } = scaffold;
  if (manifest.status !== "draft" || manifest.authoritative !== false) {
    throw new DomainBootstrapError("invalid_scaffold", "generated manifest must remain draft and non-authoritative");
  }
  if (templates.domainPackId !== manifest.id || templates.templates.length !== 0) {
    throw new DomainBootstrapError("invalid_scaffold", "generated workflow template collection must be empty and owned by the draft pack");
  }
  const required = ["README.md", "domain-pack.json", "starter.test.ts", "workflow-templates.json"];
  if (files.map((file) => file.path).join("|") !== required.join("|")) {
    throw new DomainBootstrapError("invalid_scaffold", "generated scaffold file set is invalid");
  }
  const combined = files.map((file) => file.content).join("\n").toLowerCase();
  if (!combined.includes("draft") || !combined.includes("placeholder")) {
    throw new DomainBootstrapError("invalid_scaffold", "generated scaffold must clearly identify draft placeholder content");
  }
  return scaffold;
};

export const buildStarterEvaluationPack = (scaffold: DomainPackScaffold): DomainPack =>
  validateDomainPack({
    id: scaffold.manifest.id as DomainPack["id"],
    name: scaffold.manifest.name,
    description: scaffold.manifest.description,
    language: scaffold.manifest.language,
    branding: scaffold.manifest.branding,
    workflowTypes: scaffold.manifest.workflowTypes,
    sourceAuthorityClasses: scaffold.manifest.sourceAuthorityClasses,
    classifierRules: scaffold.manifest.classifierRules,
    workflowTemplates: [
      {
        workflowType: "draft_workflow",
        title: "Draft workflow evaluation adapter",
        defaultSummary: "DRAFT PLACEHOLDER: evaluation-only workflow.",
        validationWarning: "Human review and verified evidence are required.",
        steps: [
          {
            title: "Validate draft source",
            action: "Replace placeholders with verified evidence before use.",
            requiredDocuments: ["Verified source placeholder"],
            outputDocuments: ["Reviewed draft placeholder"],
            evidencePatterns: ["draft", "placeholder"],
          },
        ],
      },
    ],
    governanceRules: scaffold.manifest.governanceRules,
    feedbackTypes: scaffold.manifest.feedbackTypes,
    exampleQueries: scaffold.manifest.exampleQueries,
    evaluationCases: scaffold.manifest.evaluationCases,
  });

export const runStarterEvaluation = (scaffold: DomainPackScaffold) => evaluateDomainPack(buildStarterEvaluationPack(scaffold));

const exists = async (target: string): Promise<boolean> => {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
};

const isAlreadyExistsError = (error: unknown): boolean =>
  Boolean(error && typeof error === "object" && "code" in error && error.code === "EEXIST");

export const initializeDomainPack = async (
  input: DomainBootstrapOptions,
  dependencies: { workspaceRoot?: string } = {}
): Promise<DomainBootstrapResult> => {
  const options = validateDomainBootstrapOptions(input);
  const workspaceRoot = path.resolve(dependencies.workspaceRoot ?? process.cwd());
  const parent = path.join(workspaceRoot, "domain-packs");
  const target = path.join(parent, options.id);
  const relativeTarget = path.relative(workspaceRoot, target).split(path.sep).join("/");
  const scaffold = renderDomainPackScaffold(options);
  const files = scaffold.files.map((file) => `${relativeTarget}/${file.path}`);

  if (await exists(target)) {
    throw new DomainBootstrapError("target_exists", `target already exists: ${relativeTarget}`);
  }
  if (options.dryRun) {
    return { status: "dry_run", target: relativeTarget, fileCount: files.length, files };
  }

  let createdTarget = false;
  try {
    await mkdir(parent, { recursive: true });
    await mkdir(target);
    createdTarget = true;
    for (const file of scaffold.files) {
      await writeFile(path.join(target, file.path), file.content, { encoding: "utf8", flag: "wx" });
    }
    return { status: "created", target: relativeTarget, fileCount: files.length, files };
  } catch (error) {
    if (createdTarget) await rm(target, { recursive: true, force: true });
    if (error instanceof DomainBootstrapError) throw error;
    if (isAlreadyExistsError(error)) {
      throw new DomainBootstrapError("target_exists", `target already exists: ${relativeTarget}`);
    }
    throw new DomainBootstrapError("write_failed", "failed to create domain pack scaffold");
  }
};
