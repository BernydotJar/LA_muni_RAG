import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bindCitationLabelToEvidenceIdentity,
  loadProcedureQueryContractValidators,
  mapProcedureWorkflowV1,
  MIXCO_COMPARATIVE_WARNING,
  type ProcedureQueryRequestV1,
} from "../api/v1/index.js";
import type { ProcedureCitation, ProcedureWorkflow } from "../procedure/index.js";
import type { ScopedSearchResult } from "../search.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const CREDENTIAL_ID = "33333333-3333-4333-8333-333333333333";
const AUDIT_ID = "44444444-4444-4444-8444-444444444444";
const DOCUMENT_ID = "66666666-6666-4666-8666-666666666666";
const VERSION_ID = "77777777-7777-4777-8777-777777777777";
const SECTION_ID = "88888888-8888-4888-8888-888888888888";
const RAW_CITATION_LABEL = "Manual de procedimientos, sección 2";

const request: ProcedureQueryRequestV1 = {
  schema_version: "v1",
  direction: "inbound",
  product_boundary: "evidence_and_procedure_request_only",
  request_id: REQUEST_ID,
  tenant_id: TENANT_ID,
  campaign_id: "campaign-antigua",
  community_id: "community-one",
  question: "¿Qué procedimiento documental aplica?",
  jurisdiction: "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala",
  case_context: {
    subject_reference: "case-one",
    community_id: "community-one",
    facts: [],
    provided_documents: [],
    constraints: [],
  },
  requested_depth: "overview",
  requested_output: "procedure_workflow",
  provenance: {
    source_product: "os_electoral",
    generated_by: "integration_client",
    created_at: "2026-07-18T18:00:00.000Z",
    source_refs: [],
    credential_id: CREDENTIAL_ID,
    audit_id: "55555555-5555-4555-8555-555555555555",
  },
};

const citation: ProcedureCitation = {
  citationLabel: bindCitationLabelToEvidenceIdentity(RAW_CITATION_LABEL, {
    documentId: DOCUMENT_ID,
    documentVersionId: VERSION_ID,
    sectionId: SECTION_ID,
  }),
  sourceType: "manual",
  pageStart: 2,
  excerpt: "La referencia describe un paso que requiere validación local.",
  sourceUrl: "https://www.mixco.gob.gt/manual.pdf",
  authorityClass: "external_reference",
  authorityLevel: "comparative",
  evidenceUse: "cited_text",
};

const workflow = (): ProcedureWorkflow => ({
  id: "internal",
  title: "Workflow documental preliminar",
  jurisdiction: "external reference",
  procedureType: "unknown",
  confidence: "low",
  summary: "Referencia pendiente de validación.",
  classification: {
    isProcedural: true,
    procedureType: "unknown",
    asksForExactDeadline: false,
    asksForCurrentStatus: false,
    mentionsExternalMunicipality: true,
    externalMunicipalityName: "Mixco",
    retrievalQueries: ["manual procedimiento"],
  },
  steps: [
    {
      stepNumber: 1,
      title: "Validar referencia",
      action: "Validar la referencia contra documentación oficial de la jurisdicción objetivo.",
      requiredDocuments: [],
      outputDocuments: ["Nota de validación documental"],
      legalBasis: [citation],
      sourceEvidence: [citation],
      confidence: "low",
    },
  ],
  dependencies: [],
  gaps: [],
  citations: [citation],
  validationWarning: "No usar la referencia externa como regla local.",
  metadata: {
    domainPackId: "municipal-antigua",
    domainPackName: "Municipal Antigua",
    query: "consulta",
    retrievalMode: "keyword",
    depth: "overview",
    evidenceCount: 1,
    hasLocalEvidence: false,
    hasExternalReference: true,
    hasAntiguaEvidence: false,
    generatedBy: "procedure_workflow_advisor_mvp",
  },
});

const record = (overrides: Partial<ScopedSearchResult> = {}): ScopedSearchResult => ({
  documentTitle: "Manual de procedimientos de la Municipalidad de Mixco",
  documentType: "manual",
  citationLabel: RAW_CITATION_LABEL,
  pageStart: citation.pageStart,
  keywordScore: 0.7,
  snippet: citation.excerpt,
  sourceUrl: citation.sourceUrl,
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
  ...overrides,
});

describe("ProcedureWorkflow v1 mapping", () => {
  it("labels Mixco as comparative with the mandatory warning and null operational assignments", async () => {
    const collision = record({
      documentId: "99999999-9999-4999-8999-999999999999",
      documentVersionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      sectionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    const output = mapProcedureWorkflowV1({
      request,
      workflow: workflow(),
      evidenceRecords: [collision, record()],
      auditId: AUDIT_ID,
      credentialId: CREDENTIAL_ID,
      createdAt: "2026-07-18T18:00:00.000Z",
    });
    const validators = await loadProcedureQueryContractValidators();
    assert.equal(validators.workflow(output), true, JSON.stringify(validators.workflow.errors));
    const source = (output.sources as Array<Record<string, unknown>>)[0];
    assert.equal(source?.municipality, "mixco");
    assert.equal(source?.document_id, DOCUMENT_ID);
    assert.equal(source?.authority_status, "comparative");
    assert.equal(source?.official_source, true);
    assert.equal(source?.official_for_target_jurisdiction, false);
    assert.ok((source?.limitations as string[]).includes(MIXCO_COMPARATIVE_WARNING));
    const step = (output.steps as Array<Record<string, unknown>>)[0];
    assert.equal(step?.evidence_status, "comparative_reference");
    assert.equal(step?.responsible_actor, null);
    assert.equal(step?.responsible_unit, null);
    assert.equal(step?.deadline, null);
    assert.equal(step?.external_system, null);
  });

  it("drops untraceable citations and explicitly downgrades the step to missing evidence", async () => {
    const output = mapProcedureWorkflowV1({
      request,
      workflow: workflow(),
      evidenceRecords: [record({ sectionId: undefined })],
      auditId: AUDIT_ID,
      credentialId: CREDENTIAL_ID,
      createdAt: "2026-07-18T18:00:00.000Z",
    });
    const validators = await loadProcedureQueryContractValidators();
    assert.equal(validators.workflow(output), true, JSON.stringify(validators.workflow.errors));
    assert.deepEqual(output.sources, []);
    assert.deepEqual(output.citations, []);
    const step = (output.steps as Array<Record<string, unknown>>)[0];
    assert.equal(step?.evidence_status, "missing_evidence");
    assert.deepEqual(step?.citation_refs, []);
    assert.match(JSON.stringify(output.gaps), /document_id.*document_version_id.*section_id.*source_url/);
  });

  it("refuses inactive documents and unprocessed versions even when a compiler supplies them", async () => {
    for (const unsafeRecord of [
      record({ documentStatus: "repealed" }),
      record({ versionExtractionStatus: "queued" }),
      record({ documentMetadata: { confidentiality: "internal" } }),
      record({ documentMetadata: {} }),
    ]) {
      const output = mapProcedureWorkflowV1({
        request,
        workflow: workflow(),
        evidenceRecords: [unsafeRecord],
        auditId: AUDIT_ID,
        credentialId: CREDENTIAL_ID,
        createdAt: "2026-07-18T18:00:00.000Z",
      });
      const validators = await loadProcedureQueryContractValidators();
      assert.equal(validators.workflow(output), true, JSON.stringify(validators.workflow.errors));
      assert.deepEqual(output.sources, []);
      assert.deepEqual(output.citations, []);
      assert.equal(
        (output.steps as Array<Record<string, unknown>>)[0]?.evidence_status,
        "missing_evidence"
      );
    }
  });

  it("does not call an Antigua source official for an arbitrary caller jurisdiction", async () => {
    const foreignRequest: ProcedureQueryRequestV1 = {
      ...request,
      jurisdiction: "Municipio de Quetzaltenango, Guatemala",
    };
    const antiguaCitation: ProcedureCitation = {
      ...citation,
      sourceUrl: "https://muniantigua.gob.gt/manual.pdf",
    };
    const antiguaWorkflow = workflow();
    antiguaWorkflow.citations = [antiguaCitation];
    antiguaWorkflow.steps[0]!.legalBasis = [antiguaCitation];
    antiguaWorkflow.steps[0]!.sourceEvidence = [antiguaCitation];
    const antiguaRecord = record({
      documentTitle: "Manual oficial de La Antigua Guatemala",
      sourceUrl: antiguaCitation.sourceUrl,
      municipalityName: "Municipalidad de La Antigua Guatemala",
      municipalitySlug: "antigua-guatemala",
    });
    const output = mapProcedureWorkflowV1({
      request: foreignRequest,
      workflow: antiguaWorkflow,
      evidenceRecords: [antiguaRecord],
      auditId: AUDIT_ID,
      credentialId: CREDENTIAL_ID,
      createdAt: "2026-07-18T18:00:00.000Z",
    });
    const validators = await loadProcedureQueryContractValidators();
    assert.equal(validators.workflow(output), true, JSON.stringify(validators.workflow.errors));
    const source = (output.sources as Array<Record<string, unknown>>)[0];
    assert.equal(source?.source_jurisdiction, request.jurisdiction);
    assert.equal(source?.target_jurisdiction, foreignRequest.jurisdiction);
    assert.equal(source?.authority_status, "comparative");
    assert.equal(source?.official_for_target_jurisdiction, false);
    assert.equal(
      (output.steps as Array<Record<string, unknown>>)[0]?.evidence_status,
      "comparative_reference"
    );
  });

  it("recognizes only exact Antigua municipality identities as target authority", async () => {
    const antiguaCitation: ProcedureCitation = {
      ...citation,
      sourceUrl: "https://muniantigua.gob.gt/manual.pdf",
    };
    const antiguaWorkflow = workflow();
    antiguaWorkflow.citations = [antiguaCitation];
    antiguaWorkflow.steps[0]!.legalBasis = [antiguaCitation];
    antiguaWorkflow.steps[0]!.sourceEvidence = [antiguaCitation];

    const exact = mapProcedureWorkflowV1({
      request,
      workflow: antiguaWorkflow,
      evidenceRecords: [
        record({
          documentTitle: "Manual oficial de La Antigua Guatemala",
          sourceUrl: antiguaCitation.sourceUrl,
          municipalityName: "Municipalidad de La Antigua Guatemala",
          municipalitySlug: "la-antigua-guatemala-sacatepequez",
        }),
      ],
      auditId: AUDIT_ID,
      credentialId: CREDENTIAL_ID,
      createdAt: "2026-07-18T18:00:00.000Z",
    });
    const exactSource = (exact.sources as Array<Record<string, unknown>>)[0];
    assert.equal(exactSource?.authority_status, "official_target_jurisdiction");
    assert.equal(exactSource?.official_for_target_jurisdiction, true);

    const deceptive = mapProcedureWorkflowV1({
      request,
      workflow: antiguaWorkflow,
      evidenceRecords: [
        record({
          documentTitle: "Manual de otra jurisdicción",
          sourceUrl: antiguaCitation.sourceUrl,
          municipalityName: "Nueva Antigua Guatemala Experimental",
          municipalitySlug: "nueva-antigua-guatemala-experimental",
        }),
      ],
      auditId: AUDIT_ID,
      credentialId: CREDENTIAL_ID,
      createdAt: "2026-07-18T18:00:00.000Z",
    });
    const deceptiveSource = (deceptive.sources as Array<Record<string, unknown>>)[0];
    assert.equal(deceptiveSource?.authority_status, "comparative");
    assert.equal(deceptiveSource?.official_for_target_jurisdiction, false);
  });
});
