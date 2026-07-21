import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bindCitationLabelToEvidenceIdentity,
  loadProcedureQueryContractValidators,
  mapProcedureWorkflowV1,
  type ProcedureQueryRequestV1,
} from "../api/v1/index.js";
import { municipalAntiguaDomainPack } from "../domain/packs/municipal-antigua.js";
import type { EvidenceItem } from "../evidence.js";
import { classifyProcedureQuery } from "../procedure/procedureClassifier.js";
import { composeProcedureWorkflow } from "../procedure/procedureComposer.js";
import type { ScopedSearchResult } from "../search.js";

const QUERY = "¿Cuál es el procedimiento para realizar X?";
const TARGET_JURISDICTION =
  "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala";

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
    subject_reference: "unclassified-procedure-x",
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

const identities = [
  {
    documentId: "66666666-6666-4666-8666-666666666661",
    documentVersionId: "77777777-7777-4777-8777-777777777771",
    sectionId: "88888888-8888-4888-8888-888888888881",
  },
  {
    documentId: "66666666-6666-4666-8666-666666666662",
    documentVersionId: "77777777-7777-4777-8777-777777777772",
    sectionId: "88888888-8888-4888-8888-888888888882",
  },
  {
    documentId: "66666666-6666-4666-8666-666666666663",
    documentVersionId: "77777777-7777-4777-8777-777777777773",
    sectionId: "88888888-8888-4888-8888-888888888883",
  },
] as const;

const evidenceDefinitions = [
  {
    title: "Manual de procedimientos de Antigua Guatemala",
    sourceType: "manual",
    label: "Manual, sección 1",
    excerpt: "El manual define el procedimiento municipal aplicable.",
    url: "https://muniantigua.gob.gt/source-1.pdf",
  },
  {
    title: "MOF de Antigua Guatemala",
    sourceType: "mof",
    label: "MOF, sección 2",
    excerpt: "Se enumeran requisitos y responsable institucional.",
    url: "https://muniantigua.gob.gt/source-2.pdf",
  },
  {
    title: "Acta de validación municipal",
    sourceType: "acta",
    label: "Acta, punto 3",
    excerpt: "La autoridad municipal deja constancia de la validación.",
    url: "https://muniantigua.gob.gt/source-3.pdf",
  },
] as const;

const evidence = (): EvidenceItem[] =>
  evidenceDefinitions.map((definition, index) => ({
    documentTitle: definition.title,
    sourceType: definition.sourceType,
    citationLabel: bindCitationLabelToEvidenceIdentity(
      definition.label,
      identities[index]!
    ),
    pageStart: index + 1,
    excerpt: definition.excerpt,
    score: 0.9 - index * 0.01,
    retrievalMode: index === 0 ? "phrase" : "keyword",
    sourceUrl: definition.url,
  }));

const evidenceRecords = (): ScopedSearchResult[] =>
  evidenceDefinitions.map((definition, index) => ({
    documentTitle: definition.title,
    documentType: definition.sourceType,
    citationLabel: definition.label,
    pageStart: index + 1,
    keywordScore: 0.9 - index * 0.01,
    snippet: definition.excerpt,
    sourceUrl: definition.url,
    documentId: identities[index]!.documentId,
    documentVersionId: identities[index]!.documentVersionId,
    sectionId: identities[index]!.sectionId,
    contentSha256: String(index + 1).repeat(64),
    officialSource: true,
    documentScope: "municipal",
    documentStatus: "active",
    versionExtractionStatus: "processed",
    documentMetadata: { confidentiality: "public" },
    municipalityName: "Municipalidad de La Antigua Guatemala",
    municipalitySlug: "la-antigua-guatemala-sacatepequez",
  }));

const classification = () => classifyProcedureQuery(QUERY, municipalAntiguaDomainPack);

const workflowWithoutEvidence = () =>
  composeProcedureWorkflow(
    QUERY,
    "hybrid",
    classification(),
    [],
    municipalAntiguaDomainPack,
    "deep_dive"
  );

const workflowWithEvidence = () =>
  composeProcedureWorkflow(
    QUERY,
    "hybrid",
    classification(),
    evidence(),
    municipalAntiguaDomainPack,
    "deep_dive"
  );

const mapWorkflow = (withEvidence: boolean) =>
  mapProcedureWorkflowV1({
    request,
    workflow: withEvidence ? workflowWithEvidence() : workflowWithoutEvidence(),
    evidenceRecords: withEvidence ? evidenceRecords() : [],
    auditId: "55555555-5555-4555-8555-555555555555",
    credentialId: request.provenance.credential_id,
    createdAt: "2026-07-21T12:00:00.000Z",
  });

describe("EVAL-PROCEDURE-001", () => {
  it("keeps the literal X query procedural but unclassified and deduplicates retrieval queries", () => {
    const result = classification();

    assert.equal(result.isProcedural, true);
    assert.equal(result.procedureType, "unknown");
    assert.equal(result.mentionsExternalMunicipality, false);
    assert.equal(result.asksForExactDeadline, false);
    assert.equal(result.asksForCurrentStatus, false);
    assert.equal(result.retrievalQueries[0], QUERY);
    assert.ok(
      result.retrievalQueries.some((item) =>
        /procedimiento municipal requisitos documentos responsables aprobación/i.test(item)
      )
    );
    assert.equal(
      new Set(result.retrievalQueries.map((item) => item.toLocaleLowerCase("es"))).size,
      result.retrievalQueries.length
    );
  });

  it("returns a structured research workflow with steps, dependencies, documents, and explicit gaps when evidence is absent", () => {
    const workflow = workflowWithoutEvidence();

    assert.equal(workflow.procedureType, "unknown");
    assert.equal(workflow.jurisdiction, "Antigua Guatemala");
    assert.deepEqual(
      workflow.steps.map((step) => step.title),
      [
        "Identificar fuente aplicable",
        "Listar requisitos",
        "Validar con autoridad municipal",
      ]
    );
    assert.equal(workflow.steps.length, 3);
    assert.equal(workflow.dependencies?.length, 2);
    assert.ok(workflow.steps.every((step) => step.requiredDocuments.length > 0));
    assert.ok(workflow.steps.every((step) => step.outputDocuments.length > 0));
    assert.ok(workflow.steps.every((step) => step.evidenceStatus === "insufficient"));
    assert.ok(workflow.steps.every((step) => step.sourceEvidence.length === 0));
    assert.deepEqual(workflow.citations, []);
    assert.ok(workflow.gaps.some((gap) => gap.severity === "blocking"));
    assert.match(workflow.summary, /checklist de investigación y documentos faltantes/);
    assert.match(workflow.validationWarning, /Confirmar fuente aplicable/);
  });

  it("assembles one official Antigua citation per matching step without cross-step promotion", () => {
    const workflow = workflowWithEvidence();

    assert.equal(workflow.citations.length, 3);
    assert.equal(workflow.gaps.length, 0);
    assert.ok(workflow.steps.every((step) => step.evidenceStatus === "supported"));
    assert.deepEqual(
      workflow.steps.map((step) => step.sourceEvidence.length),
      [1, 1, 1]
    );
    assert.deepEqual(
      workflow.steps.map((step) => step.sourceEvidence[0]?.citationLabel),
      evidence().map((item) => item.citationLabel)
    );
    assert.ok(
      workflow.steps.every(
        (step) => step.sourceAttribution?.status === "official_municipal"
      )
    );
  });

  it("emits valid canonical workflow JSON both with and without citable evidence", async () => {
    const validators = await loadProcedureQueryContractValidators();

    const missing = mapWorkflow(false);
    assert.equal(validators.workflow(missing), true, JSON.stringify(validators.workflow.errors));
    assert.equal(missing.approval_status, "draft");
    assert.equal(missing.product_boundary, "evidence_and_procedure_only");
    assert.deepEqual(missing.sources, []);
    assert.deepEqual(missing.citations, []);
    assert.equal((missing.steps as unknown[]).length, 3);
    assert.equal((missing.dependencies as unknown[]).length, 2);
    assert.ok(
      (missing.steps as Array<Record<string, unknown>>).every(
        (step) =>
          step.evidence_status === "missing_evidence" &&
          (step.unknowns as string[]).includes(
            "Documento o regla pendiente de localizar y validar."
          )
      )
    );
    assert.ok((missing.gaps as unknown[]).length > 0);

    const supported = mapWorkflow(true);
    assert.equal(validators.workflow(supported), true, JSON.stringify(validators.workflow.errors));
    assert.equal(supported.approval_status, "draft");
    assert.equal(supported.authority_status, "official_target_jurisdiction");
    assert.equal((supported.sources as unknown[]).length, 3);
    assert.equal((supported.citations as unknown[]).length, 3);
    assert.equal((supported.steps as unknown[]).length, 3);
    assert.equal((supported.dependencies as unknown[]).length, 2);
    assert.deepEqual(supported.gaps, []);
    for (const source of supported.sources as Array<Record<string, unknown>>) {
      assert.equal(source.authority_status, "official_target_jurisdiction");
      assert.equal(source.official_source, true);
      assert.equal(source.official_for_target_jurisdiction, true);
    }
    for (const step of supported.steps as Array<Record<string, unknown>>) {
      assert.equal(step.evidence_status, "supported");
      assert.equal(step.authority_status, "official_target_jurisdiction");
      assert.equal((step.citation_refs as unknown[]).length, 1);
      assert.ok((step.required_documents as unknown[]).length > 0);
      assert.ok((step.output_documents as unknown[]).length > 0);
      assert.equal(step.responsible_actor, null);
      assert.equal(step.responsible_unit, null);
      assert.equal(step.external_system, null);
      assert.equal(step.deadline, null);
    }
    assert.deepEqual(JSON.parse(JSON.stringify(supported)), supported);
    assert.doesNotMatch(
      JSON.stringify(supported),
      /estrategia electoral|segmentación electoral|calendario editorial|paid media|publicación en redes/i
    );
  });
});
