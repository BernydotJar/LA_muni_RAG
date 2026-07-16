import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { municipalAntiguaDomainPack } from "../domain/packs/municipal-antigua.js";
import { composeProcedureWorkflow } from "../procedure/procedureComposer.js";
import type { ProcedureQueryClassification } from "../procedure/types.js";
import {
  convertDomainWorkflowTemplate,
  validateEditableWorkflowTemplate,
  validateEditableWorkflowTemplateCollection,
  WorkflowTemplateValidationError,
  type EditableWorkflowTemplate,
} from "../workflowTemplates/index.js";

const sourceTemplate = municipalAntiguaDomainPack.workflowTemplates.find(
  (template) => template.workflowType === "public_works"
)!;

const validTemplate = (): EditableWorkflowTemplate =>
  convertDomainWorkflowTemplate(sourceTemplate, municipalAntiguaDomainPack);

const expectValidationError = (run: () => unknown, pattern: RegExp): void => {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof WorkflowTemplateValidationError);
    assert.match(error.message, pattern);
    return true;
  });
};

describe("workflow template editor foundation", () => {
  it("converts the existing municipal template without changing step semantics", () => {
    const converted = validTemplate();

    assert.equal(converted.domainPackId, "municipal-antigua");
    assert.equal(converted.workflowType, sourceTemplate.workflowType);
    assert.equal(converted.title, sourceTemplate.title);
    assert.deepEqual(
      converted.steps.map((step) => step.label),
      sourceTemplate.steps.map((step) => step.title)
    );
    assert.deepEqual(
      converted.steps.map((step) => step.action),
      sourceTemplate.steps.map((step) => step.action)
    );
    assert.deepEqual(
      validateEditableWorkflowTemplate(converted, municipalAntiguaDomainPack),
      converted
    );
  });

  it("preserves municipal workflow composition behavior", () => {
    const classification: ProcedureQueryClassification = {
      isProcedural: true,
      procedureType: "public_works",
      asksForExactDeadline: false,
      asksForCurrentStatus: false,
      mentionsExternalMunicipality: false,
      retrievalQueries: [],
    };

    const workflow = composeProcedureWorkflow(
      "¿Qué hay que hacer para construir un estadio municipal?",
      "keyword",
      classification,
      [],
      municipalAntiguaDomainPack
    );

    assert.equal(workflow.title, sourceTemplate.title);
    assert.deepEqual(
      workflow.steps.map((step) => step.title),
      sourceTemplate.steps.map((step) => step.title)
    );
    assert.equal(workflow.metadata.domainPackId, "municipal-antigua");
  });

  it("rejects unsafe ids and wrong domain ownership", () => {
    const unsafe = structuredClone(validTemplate());
    unsafe.workflowId = "../unsafe";
    expectValidationError(
      () => validateEditableWorkflowTemplate(unsafe, municipalAntiguaDomainPack),
      /workflowId must be safe kebab-case/
    );

    const wrongOwner = structuredClone(validTemplate());
    wrongOwner.domainPackId = "hr";
    expectValidationError(
      () => validateEditableWorkflowTemplate(wrongOwner, municipalAntiguaDomainPack),
      /does not match owning pack/
    );
  });

  it("rejects duplicate step ids and non-contiguous order", () => {
    const duplicateId = structuredClone(validTemplate());
    duplicateId.steps[1]!.id = duplicateId.steps[0]!.id;
    expectValidationError(
      () => validateEditableWorkflowTemplate(duplicateId, municipalAntiguaDomainPack),
      /duplicate ids/
    );

    const badOrder = structuredClone(validTemplate());
    badOrder.steps[1]!.order = 99;
    expectValidationError(
      () => validateEditableWorkflowTemplate(badOrder, municipalAntiguaDomainPack),
      /order must be contiguous/
    );
  });

  it("rejects unknown authorities and governance rules", () => {
    const badAuthority = structuredClone(validTemplate());
    badAuthority.steps[0]!.allowedSourceAuthorities = ["invented-authority"];
    expectValidationError(
      () => validateEditableWorkflowTemplate(badAuthority, municipalAntiguaDomainPack),
      /unknown source authority/
    );

    const badGovernance = structuredClone(validTemplate());
    badGovernance.governanceRules = ["invented-rule"];
    expectValidationError(
      () => validateEditableWorkflowTemplate(badGovernance, municipalAntiguaDomainPack),
      /unknown governance rule/
    );
  });

  it("requires explicit evidence configuration", () => {
    const authoritative = structuredClone(validTemplate());
    authoritative.authoritative = true;
    authoritative.evidenceRequirement = "recommended";
    expectValidationError(
      () => validateEditableWorkflowTemplate(authoritative, municipalAntiguaDomainPack),
      /authoritative templates must require evidence/
    );

    const missingPatterns = structuredClone(validTemplate());
    missingPatterns.steps[0]!.evidencePatterns = [];
    expectValidationError(
      () => validateEditableWorkflowTemplate(missingPatterns, municipalAntiguaDomainPack),
      /must define evidencePatterns when evidence is required/
    );
  });

  it("rejects duplicate workflow ids in a collection", () => {
    const template = validTemplate();
    expectValidationError(
      () =>
        validateEditableWorkflowTemplateCollection(
          {
            schemaVersion: 1,
            domainPackId: "municipal-antigua",
            templates: [template, structuredClone(template)],
          },
          municipalAntiguaDomainPack
        ),
      /duplicate workflow ids/
    );
  });

  it("keeps the CLI read-only and JSON-only", async () => {
    const source = await readFile(new URL("../cli/validateWorkflowTemplate.ts", import.meta.url), "utf8");

    assert.match(source, /only \.json files are allowed/);
    assert.match(source, /path\.relative/);
    assert.match(source, /readFile/);
    assert.doesNotMatch(source, /writeFile|appendFile|eval\(|new Function|import\(/);
  });
});
