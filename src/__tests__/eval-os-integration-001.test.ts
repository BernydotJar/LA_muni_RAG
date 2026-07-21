import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bindCitationLabelToEvidenceIdentity,
  type ProcedureWorkflowCompiler,
} from "../api/v1/index.js";
import type { ProcedureCitation, ProcedureWorkflow } from "../procedure/index.js";
import type { ScopedSearchResult } from "../search.js";
import {
  assertContractApiError,
  postProcedureQuery,
  procedureQueryRequest,
  procedureQueryValidators,
  startProcedureQueryHarness,
  stopProcedureQueryHarness,
  testInternalWorkflow,
} from "./helpers/procedure-query-v1-harness.js";

const OS_ORIGIN = "https://os-electoral.example";
const DOCUMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const VERSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const SECTION_ID = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const RAW_LABEL = "Manual municipal, sección 12";
const SOURCE_URL = "https://muniantigua.gob.gt/manual-procedimientos.pdf";
const EXCERPT =
  "La unidad municipal recibe la solicitud y verifica que el expediente contenga los documentos requeridos.";

const officialCitation = (): ProcedureCitation => ({
  citationLabel: bindCitationLabelToEvidenceIdentity(RAW_LABEL, {
    documentId: DOCUMENT_ID,
    documentVersionId: VERSION_ID,
    sectionId: SECTION_ID,
  }),
  sourceType: "manual",
  pageStart: 12,
  excerpt: EXCERPT,
  sourceUrl: SOURCE_URL,
  authorityClass: "municipal_official",
  authorityLabel: "Municipalidad de La Antigua Guatemala",
  evidenceUse: "cited_text",
});

const officialWorkflow = (): ProcedureWorkflow => {
  const workflow = testInternalWorkflow();
  const citation = officialCitation();
  return {
    ...workflow,
    title: "Recepción documental de una solicitud comunitaria",
    summary: "La fuente municipal respalda la recepción y verificación documental inicial.",
    confidence: "medium",
    steps: [
      {
        ...workflow.steps[0]!,
        title: "Recibir y verificar la solicitud",
        action:
          "Recibir la solicitud comunitaria y verificar documentalmente el expediente antes de continuar.",
        legalBasis: [citation],
        sourceEvidence: [citation],
        evidenceStatus: "supported",
        confidence: "medium",
        sourceAttribution: {
          status: "official_municipal",
          heading: "Fuente municipal oficial",
          statement: "La evidencia corresponde a una fuente municipal de Antigua Guatemala.",
          primaryCitation: citation,
          citations: [citation],
        },
      },
    ],
    gaps: [],
    citations: [citation],
    validationWarning:
      "Validar vigencia, competencia institucional y aplicación al caso concreto antes de ejecutar.",
    metadata: {
      ...workflow.metadata,
      evidenceCount: 1,
      hasLocalEvidence: true,
      hasAntiguaEvidence: true,
    },
  };
};

const officialRecord = (): ScopedSearchResult => ({
  documentTitle: "Manual de procedimientos de la Municipalidad de La Antigua Guatemala",
  documentType: "manual",
  citationLabel: RAW_LABEL,
  pageStart: 12,
  keywordScore: 0.94,
  snippet: EXCERPT,
  sourceUrl: SOURCE_URL,
  documentId: DOCUMENT_ID,
  documentVersionId: VERSION_ID,
  sectionId: SECTION_ID,
  contentSha256: "d".repeat(64),
  officialSource: true,
  documentScope: "municipal",
  documentStatus: "active",
  versionExtractionStatus: "processed",
  documentMetadata: { confidentiality: "public" },
  municipalityName: "Municipalidad de La Antigua Guatemala",
  municipalitySlug: "la-antigua-guatemala-sacatepequez",
});

const officialCompiler = (calls: { count: number }): ProcedureWorkflowCompiler =>
  async () => {
    calls.count += 1;
    return { workflow: officialWorkflow(), evidenceRecords: [officialRecord()] };
  };

const forbiddenTopLevelKeys = [
  "campaign_strategy",
  "electoral_segments",
  "territories",
  "message_house",
  "approved_message",
  "content_calendar",
  "publication_tasks",
  "media_spend",
] as const;

const assertNoForeignOwnershipFields = (value: Record<string, unknown>): void => {
  for (const key of forbiddenTopLevelKeys) {
    assert.equal(key in value, false, `unexpected foreign ownership field: ${key}`);
  }
};

describe("EVAL-OS-INTEGRATION-001", () => {
  it("returns an identity-bound EvidenceBundle to the exact allowed OS Electoral origin and replays it byte-for-byte", async () => {
    const calls = { count: 0 };
    const harness = await startProcedureQueryHarness({ compiler: officialCompiler(calls) });
    const request = procedureQueryRequest({
      requested_output: "evidence_bundle",
      campaign_id: "campaign-reference-only",
      community_id: "community-antigua-reference",
      question: "¿Qué evidencia respalda la recepción documental de esta solicitud comunitaria?",
      case_context: {
        subject_reference: "community-request-document-review",
        community_id: "community-antigua-reference",
        facts: [],
        provided_documents: [],
        constraints: ["No convertir evidencia en una decisión de campaña."],
      },
    });
    const idempotencyKey = "os-evidence-bundle-000001";
    try {
      const first = await postProcedureQuery(harness, request, {
        idempotencyKey,
        origin: OS_ORIGIN,
      });
      const validators = await procedureQueryValidators;

      assert.equal(first.response.status, 200);
      assert.equal(
        validators.evidenceBundle(first.json),
        true,
        JSON.stringify(validators.evidenceBundle.errors)
      );
      assert.equal(first.response.headers.get("access-control-allow-origin"), OS_ORIGIN);
      assert.equal(first.response.headers.get("cache-control"), "no-store");
      assert.equal(first.json.response_type, "evidence_bundle");
      assert.equal(first.json.product_boundary, "evidence_and_procedure_only");
      assert.equal(first.json.query, request.question);
      assert.equal("campaign_id" in first.json, false);
      assert.equal("community_id" in first.json, false);
      assertNoForeignOwnershipFields(first.json);

      const sources = first.json.sources as Array<Record<string, unknown>>;
      const citations = first.json.citations as Array<Record<string, unknown>>;
      const claims = first.json.claims as Array<Record<string, unknown>>;
      assert.equal(sources.length, 1);
      assert.equal(sources[0]?.document_id, DOCUMENT_ID);
      assert.equal(sources[0]?.document_version_id, VERSION_ID);
      assert.equal(sources[0]?.authority_status, "official_target_jurisdiction");
      assert.equal(sources[0]?.official_source, true);
      assert.equal(sources[0]?.official_for_target_jurisdiction, true);
      assert.equal(citations.length, 1);
      assert.equal(citations[0]?.section_id, SECTION_ID);
      assert.equal(citations[0]?.evidence_status, "supported");
      assert.equal(claims.length, 1);
      assert.equal(claims[0]?.evidence_status, "supported");
      assert.deepEqual(claims[0]?.citation_refs, [citations[0]?.citation_id]);
      assert.deepEqual(first.json.contradictions, []);
      assert.deepEqual(first.json.missing_evidence, []);
      assert.ok(
        (first.json.limitations as string[]).some((item) =>
          /no contiene estrategia, segmentación, territorio, movilización/i.test(item)
        )
      );
      assert.equal(calls.count, 1);

      const replay = await postProcedureQuery(harness, request, {
        idempotencyKey,
        origin: OS_ORIGIN,
      });
      assert.equal(replay.response.status, 200);
      assert.equal(replay.text, first.text);
      assert.equal(calls.count, 1);
      assert.equal(
        harness.persistence.audits.some(
          (audit) =>
            audit.eventType === "integration.procedure_query.succeeded" &&
            audit.reasonCode === "evidence_bundle_generated" &&
            audit.requestedOutput === "evidence_bundle"
        ),
        true
      );
      assert.equal(
        harness.persistence.audits.some(
          (audit) => audit.eventType === "integration.procedure_query.idempotency_replayed"
        ),
        true
      );
      assert.doesNotMatch(
        JSON.stringify(harness.persistence.audits),
        /community-request-document-review|No convertir evidencia/i
      );
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });

  it("returns an evidence bundle with explicit gaps and no claims when evidence is absent", async () => {
    const harness = await startProcedureQueryHarness();
    try {
      const result = await postProcedureQuery(
        harness,
        procedureQueryRequest({ requested_output: "evidence_bundle" }),
        { idempotencyKey: "os-evidence-gap-000001", origin: OS_ORIGIN }
      );
      const validators = await procedureQueryValidators;

      assert.equal(result.response.status, 200);
      assert.equal(
        validators.evidenceBundle(result.json),
        true,
        JSON.stringify(validators.evidenceBundle.errors)
      );
      assert.deepEqual(result.json.sources, []);
      assert.deepEqual(result.json.citations, []);
      assert.deepEqual(result.json.claims, []);
      assert.deepEqual(result.json.contradictions, []);
      assert.ok((result.json.missing_evidence as unknown[]).length > 0);
      assertNoForeignOwnershipFields(result.json);
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });

  it("returns the versioned draft ProcedureWorkflow without campaign decisions", async () => {
    const calls = { count: 0 };
    const harness = await startProcedureQueryHarness({ compiler: officialCompiler(calls) });
    try {
      const result = await postProcedureQuery(
        harness,
        procedureQueryRequest({ requested_output: "procedure_workflow" }),
        { idempotencyKey: "os-procedure-workflow-000001", origin: OS_ORIGIN }
      );
      const validators = await procedureQueryValidators;

      assert.equal(result.response.status, 200);
      assert.equal(
        validators.workflow(result.json),
        true,
        JSON.stringify(validators.workflow.errors)
      );
      assert.equal(result.json.response_type, "procedure_workflow");
      assert.equal(result.json.workflow_version, "1.0.0");
      assert.equal(result.json.approval_status, "draft");
      assert.equal(result.json.product_boundary, "evidence_and_procedure_only");
      assert.equal((result.json.sources as unknown[]).length, 1);
      assert.equal((result.json.citations as unknown[]).length, 1);
      assert.equal((result.json.steps as unknown[]).length, 1);
      assert.equal(calls.count, 1);
      assertNoForeignOwnershipFields(result.json);
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });

  it("keeps procedure assessment honestly unavailable and never invokes the compiler", async () => {
    const harness = await startProcedureQueryHarness();
    try {
      const result = await postProcedureQuery(
        harness,
        procedureQueryRequest({ requested_output: "procedure_assessment" }),
        { idempotencyKey: "os-procedure-assessment-000001", origin: OS_ORIGIN }
      );

      await assertContractApiError(result, 503, "capability_unavailable");
      assert.match(
        JSON.stringify((result.json.error as Record<string, unknown>).details),
        /procedure_assessment is not currently available/
      );
      assert.equal(harness.compilerCalls.count, 0);
      assert.equal(
        harness.persistence.audits[0]?.eventType,
        "integration.procedure_query.capability_unavailable"
      );
      assert.equal(harness.persistence.audits[0]?.requestedOutput, "procedure_assessment");
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });
});
