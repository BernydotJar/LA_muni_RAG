import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bindCitationLabelToEvidenceIdentity,
  loadProcedureQueryContractValidators,
  mapProcedureWorkflowV1,
  MIXCO_COMPARATIVE_WARNING,
  type ProcedureQueryRequestV1,
} from "../api/v1/index.js";
import { municipalAntiguaDomainPack } from "../domain/packs/municipal-antigua.js";
import type { EvidenceItem } from "../evidence.js";
import { classifyProcedureQuery } from "../procedure/procedureClassifier.js";
import { composeProcedureWorkflow } from "../procedure/procedureComposer.js";
import type { ScopedSearchResult } from "../search.js";

const QUERY = "Usa el manual de Mixco para explicar contratación de obra";
const TARGET_JURISDICTION =
  "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala";
const DOCUMENT_ID = "66666666-6666-4666-8666-666666666666";
const VERSION_ID = "77777777-7777-4777-8777-777777777777";
const SECTION_ID = "88888888-8888-4888-8888-888888888888";
const RAW_CITATION_LABEL = "Manual Mixco, página 30";
const EXCERPT =
  "Procedimiento de cotización y licitación pública para obras registradas en SNIP.";
const SOURCE_URL = "https://www.mixco.gob.gt/manual.pdf";
const SOURCE_TITLE =
  "Manual de Normas y Procedimientos de Adquisiciones y Contrataciones Municipalidad de Mixco";

const request: ProcedureQueryRequestV1 = {
  schema_version: "v1",
  direction: "inbound",
  product_boundary: "evidence_and_procedure_request_only",
  request_id: "11111111-1111-4111-8111-111111111111",
  tenant_id: "22222222-2222-4222-8222-222222222222",
  campaign_id: "campaign-reference-only",
  community_id: "community-reference-only",
  question: QUERY,
  jurisdiction: TARGET_JURISDICTION,
  case_context: {
    subject_reference: "mixco-comparative-procurement",
    community_id: "community-reference-only",
    facts: [],
    provided_documents: [],
    constraints: [],
  },
  requested_depth: "deep_dive",
  requested_output: "procedure_workflow",
  provenance: {
    source_product: "os_electoral",
    generated_by: "integration_client",
    created_at: "2026-07-21T12:00:00.000Z",
    source_refs: [],
    credential_id: "33333333-3333-4333-8333-333333333333",
    audit_id: "44444444-4444-4444-8444-444444444444",
  },
};

const identity = {
  documentId: DOCUMENT_ID,
  documentVersionId: VERSION_ID,
  sectionId: SECTION_ID,
};

const evidence = (): EvidenceItem[] => [
  {
    documentTitle: SOURCE_TITLE,
    sourceType: "manual",
    citationLabel: bindCitationLabelToEvidenceIdentity(
      RAW_CITATION_LABEL,
      identity
    ),
    pageStart: 30,
    excerpt: EXCERPT,
    score: 0.9,
    retrievalMode: "keyword",
    sourceUrl: SOURCE_URL,
  },
];

const evidenceRecords = (): ScopedSearchResult[] => [
  {
    documentTitle: SOURCE_TITLE,
    documentType: "manual",
    citationLabel: RAW_CITATION_LABEL,
    pageStart: 30,
    keywordScore: 0.9,
    snippet: EXCERPT,
    sourceUrl: SOURCE_URL,
    documentId: DOCUMENT_ID,
    documentVersionId: VERSION_ID,
    sectionId: SECTION_ID,
    contentSha256: "a".repeat(64),
    officialSource: true,
    documentScope: "municipal",
    documentStatus: "active",
    versionExtractionStatus: "processed",
    documentMetadata: { confidentiality: "public" },
    municipalityName: "Municipalidad de Mixco",
    municipalitySlug: "mixco",
  },
];

const classification = () => classifyProcedureQuery(QUERY, municipalAntiguaDomainPack);

const workflow = () =>
  composeProcedureWorkflow(
    QUERY,
    "keyword",
    classification(),
    evidence(),
    municipalAntiguaDomainPack,
    "deep_dive"
  );

const mappedWorkflow = () =>
  mapProcedureWorkflowV1({
    request,
    workflow: workflow(),
    evidenceRecords: evidenceRecords(),
    auditId: "55555555-5555-4555-8555-555555555555",
    credentialId: request.provenance.credential_id,
    createdAt: "2026-07-21T12:00:00.000Z",
  });

describe("EVAL-MIXCO-001", () => {
  it("identifies Mixco and classifies the query as comparative procurement research", () => {
    const result = classification();

    assert.equal(result.isProcedural, true);
    assert.equal(result.procedureType, "procurement");
    assert.equal(result.mentionsExternalMunicipality, true);
    assert.equal(result.externalMunicipalityName, "Mixco");
    assert.ok(
      result.retrievalQueries.some((item) =>
        /Mixco manual normas procedimientos adquisiciones contrataciones obra/i.test(item)
      )
    );
  });

  it("keeps the official Mixco source external to Antigua and requires local corroboration", () => {
    const result = workflow();

    assert.equal(result.procedureType, "procurement");
    assert.equal(result.jurisdiction, "external reference");
    assert.equal(result.confidence, "low");
    assert.equal(result.metadata.hasExternalReference, true);
    assert.equal(result.metadata.hasLocalEvidence, false);
    assert.equal(result.metadata.hasAntiguaEvidence, false);
    assert.match(
      result.summary,
      /referencia procedimental de otra municipalidad.*Antigua Guatemala/i
    );
    assert.equal(result.citations.length, 1);
    assert.equal(result.citations[0]?.authorityClass, "external_reference");
    assert.equal(result.citations[0]?.authorityLevel, "comparative");
    assert.deepEqual(
      result.steps.filter((step) => step.sourceEvidence.length > 0).map((step) => step.title),
      ["Definir modalidad"]
    );
    assert.equal(
      result.steps.find((step) => step.title === "Definir modalidad")?.sourceAttribution?.status,
      "comparative"
    );
    assert.equal(result.steps.filter((step) => step.evidenceStatus === "insufficient").length, 3);
    assert.ok(
      result.gaps.some(
        (gap) =>
          gap.severity === "blocking" &&
          gap.missingItem === "Documento oficial de Antigua Guatemala sobre el procedimiento"
      )
    );
    assert.ok(
      result.gaps.some(
        (gap) =>
          gap.severity === "important" &&
          gap.missingItem === "Validación contra normativa/documentos oficiales de Antigua"
      )
    );
  });

  it("maps the Mixco source as official for Mixco, comparative for Antigua, with the mandatory warning", async () => {
    const output = mappedWorkflow();
    const validators = await loadProcedureQueryContractValidators();

    assert.equal(validators.workflow(output), true, JSON.stringify(validators.workflow.errors));
    assert.equal(output.approval_status, "draft");
    assert.equal(output.product_boundary, "evidence_and_procedure_only");
    assert.equal(output.authority_status, "comparative");
    assert.ok((output.limitations as string[]).includes(MIXCO_COMPARATIVE_WARNING));

    const sources = output.sources as Array<Record<string, unknown>>;
    assert.equal(sources.length, 1);
    assert.equal(sources[0]?.municipality, "mixco");
    assert.equal(sources[0]?.source_jurisdiction, "Municipalidad de Mixco, Guatemala");
    assert.equal(sources[0]?.target_jurisdiction, TARGET_JURISDICTION);
    assert.equal(sources[0]?.authority_status, "comparative");
    assert.equal(sources[0]?.official_source, true);
    assert.equal(sources[0]?.official_for_target_jurisdiction, false);
    assert.deepEqual(sources[0]?.limitations, [MIXCO_COMPARATIVE_WARNING]);

    const citations = output.citations as Array<Record<string, unknown>>;
    assert.equal(citations.length, 1);
    assert.equal(citations[0]?.authority_status, "comparative");
    assert.equal(citations[0]?.jurisdiction, "Municipalidad de Mixco, Guatemala");
    assert.equal(citations[0]?.evidence_status, "comparative_reference");

    const steps = output.steps as Array<Record<string, unknown>>;
    const comparativeSteps = steps.filter(
      (step) => step.evidence_status === "comparative_reference"
    );
    assert.equal(comparativeSteps.length, 1);
    assert.equal(comparativeSteps[0]?.sequence, 2);
    assert.equal(comparativeSteps[0]?.authority_status, "comparative");
    assert.equal(comparativeSteps[0]?.jurisdiction, "Municipalidad de Mixco, Guatemala");
    assert.equal((comparativeSteps[0]?.citation_refs as unknown[]).length, 1);
    assert.equal(
      steps.filter((step) => step.evidence_status === "missing_evidence").length,
      3
    );
    for (const step of steps) {
      assert.equal(step.responsible_actor, null);
      assert.equal(step.responsible_unit, null);
      assert.equal(step.external_system, null);
      assert.equal(step.deadline, null);
    }

    const gaps = output.gaps as Array<Record<string, unknown>>;
    assert.ok(gaps.some((gap) => gap.severity === "blocking" && /Antigua Guatemala/.test(String(gap.description))));
    assert.ok(gaps.some((gap) => /Validación contra normativa/.test(String(gap.description))));
  });

  it("rejects silent promotion of the Mixco source or removal of its canonical warning", async () => {
    const validators = await loadProcedureQueryContractValidators();

    const promoted = structuredClone(mappedWorkflow());
    const promotedSource = (promoted.sources as Array<Record<string, unknown>>)[0];
    assert.ok(promotedSource);
    promotedSource.authority_status = "official_target_jurisdiction";
    promotedSource.official_for_target_jurisdiction = true;
    assert.equal(validators.workflow(promoted), false);

    const warningRemoved = structuredClone(mappedWorkflow());
    const warningSource = (warningRemoved.sources as Array<Record<string, unknown>>)[0];
    assert.ok(warningSource);
    warningSource.limitations = ["Referencia externa."];
    assert.equal(validators.workflow(warningRemoved), false);
  });
});
