import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deterministicUuid,
  mapProcedureAssessmentV1,
} from "../api/v1/mapper.js";
import { bindCitationLabelToEvidenceIdentity } from "../api/v1/evidenceIdentity.js";
import {
  procedureQueryRequest,
  procedureQueryValidators,
  postProcedureQuery,
  startProcedureQueryHarness,
  stopProcedureQueryHarness,
  testInternalWorkflow,
  TEST_CREDENTIAL_ID,
  TEST_FIXED_TIME,
  TEST_REQUEST_ID,
  TEST_TENANT_A,
} from "./helpers/procedure-query-v1-harness.js";
import type { ProcedureWorkflow } from "../procedure/index.js";
import { InMemoryProcedureQueryPersistence } from "../api/v1/persistence.js";

const requirementName = "Solicitud comunitaria respaldada documentalmente";
const requirementId = deterministicUuid(
  `document-requirement:${TEST_TENANT_A}:${requirementName.toLowerCase()}`
);

const mapNoEvidenceAssessment = () => mapProcedureAssessmentV1({
  request: procedureQueryRequest({
    requested_output: "procedure_assessment",
    case_context: {
      subject_reference: "procedure-eval-case",
      community_id: "community-reference-only",
      facts: ["ASSESSMENT-FACT-MUST-NOT-PERSIST"],
      provided_documents: [requirementId],
      constraints: ["ASSESSMENT-CONSTRAINT-MUST-NOT-PERSIST"],
    },
  }),
  workflow: testInternalWorkflow(),
  evidenceRecords: [],
  auditId: "88888888-8888-4888-8888-888888888888",
  credentialId: TEST_CREDENTIAL_ID,
  createdAt: TEST_FIXED_TIME.toISOString(),
});

describe("EVAL-PROCEDURE-ASSESSMENT-001", () => {
  it("never treats caller-owned document references as completed requirements", async () => {
    const assessment = mapNoEvidenceAssessment();
    const validators = await procedureQueryValidators;

    assert.equal(
      validators.assessment(assessment),
      true,
      JSON.stringify(validators.assessment.errors)
    );
    assert.equal(assessment.response_type, "procedure_assessment");
    assert.deepEqual(assessment.completed_requirements, []);
    assert.equal((assessment.missing_requirements as unknown[]).length, 1);
    assert.deepEqual(assessment.blocked_steps, [
      deterministicUuid(`step:${TEST_TENANT_A}:${TEST_REQUEST_ID}:1`),
    ]);
    assert.deepEqual(assessment.evidence_refs, []);
    assert.deepEqual((assessment.case_context as Record<string, unknown>).facts, []);
    assert.deepEqual((assessment.case_context as Record<string, unknown>).constraints, []);
    assert.equal(JSON.stringify(assessment).includes("ASSESSMENT-FACT-MUST-NOT-PERSIST"), false);
    assert.equal(JSON.stringify(assessment).includes("ASSESSMENT-CONSTRAINT-MUST-NOT-PERSIST"), false);
    assert.match(String(assessment.next_documental_action), /validar/i);
    assert.match(JSON.stringify(assessment.limitations), /son opacas/i);
    assert.equal(assessment.campaign_strategy, undefined);
    assert.equal(assessment.content_calendar, undefined);
  });

  it("keeps cited requirement existence below case completion", async () => {
    const workflow: ProcedureWorkflow = testInternalWorkflow();
    const citation = {
      citationLabel: bindCitationLabelToEvidenceIdentity(
        "Manual oficial, sección de solicitud",
        {
          documentId: "66666666-6666-4666-8666-666666666666",
          documentVersionId: "77777777-7777-4777-8777-777777777777",
          sectionId: "88888888-8888-4888-8888-888888888888",
        }
      ),
      sourceType: "manual" as const,
      pageStart: 2,
      excerpt: "La solicitud comunitaria integra el expediente documental.",
      sourceUrl: "https://muniantigua.gob.gt/manual-oficial.pdf",
      authorityClass: "official" as const,
      authorityLevel: "primary" as const,
      evidenceUse: "cited_text" as const,
    };
    workflow.steps[0]!.sourceEvidence = [citation];
    workflow.citations = [citation];
    const assessment = mapProcedureAssessmentV1({
      request: procedureQueryRequest({ requested_output: "procedure_assessment" }),
      workflow,
      evidenceRecords: [{
        documentTitle: "Manual oficial de La Antigua Guatemala",
        documentType: "manual",
        citationLabel: "Manual oficial, sección de solicitud",
        pageStart: 2,
        keywordScore: 1,
        snippet: citation.excerpt,
        sourceUrl: citation.sourceUrl,
        documentId: "66666666-6666-4666-8666-666666666666",
        documentVersionId: "77777777-7777-4777-8777-777777777777",
        sectionId: "88888888-8888-4888-8888-888888888888",
        contentSha256: "a".repeat(64),
        officialSource: true,
        documentScope: "municipal",
        documentStatus: "active",
        versionExtractionStatus: "processed",
        documentMetadata: { confidentiality: "public" },
        municipalityName: "Municipalidad de La Antigua Guatemala",
        municipalitySlug: "antigua-guatemala",
      }],
      auditId: "99999999-9999-4999-8999-999999999999",
      credentialId: TEST_CREDENTIAL_ID,
      createdAt: TEST_FIXED_TIME.toISOString(),
    });
    const missing = assessment.missing_requirements as Array<Record<string, unknown>>;

    assert.deepEqual(assessment.completed_requirements, []);
    assert.equal(missing[0]?.evidence_status, "inferred_for_review");
    assert.equal((missing[0]?.citation_refs as unknown[]).length, 1);
    assert.equal((assessment.evidence_refs as unknown[]).length, 1);
    assert.equal((assessment.blocked_steps as unknown[]).length, 1);
  });

  it("invalidates corrupt assessment replay without emitting stored bytes", async () => {
    class CorruptAssessmentPersistence extends InMemoryProcedureQueryPersistence {
      invalidations = 0;

      override async claimIdempotency() {
        return {
          kind: "replay" as const,
          statusCode: 200,
          responseBody: JSON.stringify({
            response_type: "procedure_assessment",
            tenant_id: "22222222-2222-4222-8222-222222222222",
            secret_marker: "ASSESSMENT-REPLAY-MUST-NOT-LEAK",
          }),
          originalAuditId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        };
      }

      override async invalidateCompletedIdempotency(): Promise<void> {
        this.invalidations += 1;
      }
    }

    const persistence = new CorruptAssessmentPersistence(() => TEST_FIXED_TIME);
    const harness = await startProcedureQueryHarness({ persistence });
    try {
      const result = await postProcedureQuery(
        harness,
        procedureQueryRequest({ requested_output: "procedure_assessment" }),
        { idempotencyKey: "corrupt-assessment-replay-000001" }
      );
      assert.equal(result.response.status, 500);
      assert.equal(result.text.includes("ASSESSMENT-REPLAY-MUST-NOT-LEAK"), false);
      assert.equal(persistence.invalidations, 1);
      assert.equal(
        persistence.audits.some(
          (audit) => audit.eventType === "integration.procedure_query.idempotency_corrupt"
        ),
        true
      );
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });

  it("returns a validated assessment and exact replay through the OS provider", async () => {
    const harness = await startProcedureQueryHarness();
    try {
      const request = procedureQueryRequest({ requested_output: "procedure_assessment" });
      const first = await postProcedureQuery(harness, request, {
        idempotencyKey: "os-procedure-assessment-eval-000001",
        origin: "https://os-electoral.example",
      });
      const second = await postProcedureQuery(harness, request, {
        idempotencyKey: "os-procedure-assessment-eval-000001",
        origin: "https://os-electoral.example",
      });
      const validators = await procedureQueryValidators;

      assert.equal(first.response.status, 200);
      assert.equal(validators.assessment(first.json), true, JSON.stringify(validators.assessment.errors));
      assert.equal(first.text, second.text);
      assert.equal(harness.compilerCalls.count, 1);
      assert.equal(first.json.tenant_id, TEST_TENANT_A);
      assert.equal(first.json.request_id, TEST_REQUEST_ID);
      assert.equal(
        (first.json.provenance as Record<string, unknown>).credential_id,
        TEST_CREDENTIAL_ID
      );
      assert.equal(
        harness.persistence.audits.some(
          (audit) => audit.eventType === "integration.procedure_query.succeeded" &&
            audit.requestedOutput === "procedure_assessment"
        ),
        true
      );
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });
});
