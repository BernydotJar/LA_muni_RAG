import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadDomainPack } from "../domain/registry.js";
import { validateEditableWorkflowTemplateCollection } from "../workflowTemplates/index.js";

const fail = (message: string): never => {
  console.error(`workflow-template validation failed: ${message}`);
  process.exit(1);
};

const requireDomainPackId = (value: unknown): string => {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      fail("collection domainPackId is required");
    }

    return normalized;
  }

  return fail("collection domainPackId is required");
};

const input = process.argv[2];
if (!input) fail("provide a repository-relative .json file path");
if (path.isAbsolute(input)) fail("absolute paths are not allowed");
if (path.extname(input).toLowerCase() !== ".json") fail("only .json files are allowed");

const cwd = path.resolve(process.cwd());
const candidate = path.resolve(cwd, input);
const relative = path.relative(cwd, candidate);
if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
  fail("path must resolve to a repository-local JSON file");
}

try {
  const source = await readFile(candidate, "utf8");
  const parsed: unknown = JSON.parse(source);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail("JSON root must be an object");
  }

  const domainPackId = requireDomainPackId(
    (parsed as Record<string, unknown>).domainPackId
  );
  const domainPack = loadDomainPack(domainPackId);
  const validated = validateEditableWorkflowTemplateCollection(parsed, domainPack);

  console.log(
    JSON.stringify(
      {
        status: "valid",
        schemaVersion: validated.schemaVersion,
        domainPackId: validated.domainPackId,
        templateCount: validated.templates.length,
        workflowIds: validated.templates.map((template) => template.workflowId),
      },
      null,
      2
    )
  );
} catch (error) {
  fail(error instanceof Error ? error.message : "unknown validation error");
}
