import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadDomainPack } from "../domain/registry.js";
import { validateEditableWorkflowTemplateCollection } from "../workflowTemplates/index.js";

const fail = (message: string): never => {
  console.error(`workflow-template validation failed: ${message}`);
  process.exit(1);
};

const input = process