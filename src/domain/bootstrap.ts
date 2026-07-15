import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { evaluateDomainPack } from "./evaluation.js";
import type { DomainPack } from "./types.js";
import { validateDomainPack } from "./validation.js";
import type { EditableWorkflowTemplateCollection } from "../workflowTemplates/types.js";

export type DomainBootstrapErrorCode =
  | "invalid_arguments"
  | "invalid_id"
 