import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectProductBoundaryViolation } from "../api/v1/index.js";
import {
  assertContractApiError,
  postProcedureQuery,
  procedureQueryRequest,
  procedureQueryValidators,
  startProcedureQueryHarness,
  stopProcedureQueryHarness,
} from "./helpers/procedure-query-v1-harness.js";

const errorDetails = (json: Record<string, unknown>): Array<Record<string, unknown>> => {
  const error = json.error as Record<string, unknown>;
  return error.details as Array<Record<string, unknown>>;
};

describe("EVAL-BOUNDARY-001", () => {
  it("refuses the mixed electoral-strategy and content-calendar request without compiling", async () => {
    const question = "Diseña la estrategia electoral y el calendario de contenido.";
    const request = procedureQueryRequest({ question });

    assert.equal(detectProductBoundaryViolation(request), "electoral_strategy");

    const harness = await startProcedureQueryHarness();
    try {
      const result = await postProcedureQuery(harness, request, {
        idempotencyKey: "boundary-mixed-request-000001",
      });

      await assertContractApiError(result, 400, "product_boundary_violation");
      assert.match(
        (result.json.error as { message: string }).message,
        /OS Electoral.*Content Agency/
      );
      assert.deepEqual(errorDetails(result.json), [
        {
          field: "/question",
          issue: "Route electoral strategy work to OS Electoral",
        },
      ]);
      assert.equal(harness.compilerCalls.count, 0);
      assert.equal("steps" in result.json, false);
      assert.equal("sources" in result.json, false);
      assert.equal("citations" in result.json, false);
      assert.equal("claims" in result.json, false);
      assert.equal("artifacts" in result.json, false);

      assert.equal(harness.persistence.audits.length, 1);
      assert.equal(
        harness.persistence.audits[0]?.eventType,
        "integration.procedure_query.boundary_rejected"
      );
      assert.equal(harness.persistence.audits[0]?.reasonCode, "electoral_strategy");
      const auditJson = JSON.stringify(harness.persistence.audits);
      assert.doesNotMatch(auditJson, /Diseña la estrategia electoral/);
      assert.doesNotMatch(auditJson, /calendario de contenido/);
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });

  it("routes content production and editorial calendars to Content Agency", async () => {
    const question = "Crea un calendario editorial y redacta publicaciones para redes.";
    const request = procedureQueryRequest({ question });

    assert.equal(detectProductBoundaryViolation(request), "content_generation");

    const harness = await startProcedureQueryHarness();
    try {
      const result = await postProcedureQuery(harness, request, {
        idempotencyKey: "boundary-content-request-000001",
      });

      await assertContractApiError(result, 400, "product_boundary_violation");
      assert.deepEqual(errorDetails(result.json), [
        {
          field: "/question",
          issue: "Route content generation and calendars to Content Agency",
        },
      ]);
      assert.equal(harness.compilerCalls.count, 0);
      assert.equal(harness.persistence.audits[0]?.reasonCode, "content_generation");
      assert.doesNotMatch(
        JSON.stringify(harness.persistence.audits),
        /calendario editorial|publicaciones para redes/i
      );
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });

  it("detects an out-of-scope instruction hidden in facts or constraints", async () => {
    const request = procedureQueryRequest({
      question: "¿Qué evidencia documental existe para el procedimiento municipal?",
      case_context: {
        subject_reference: "boundary-context-check",
        community_id: "community-reference-only",
        facts: ["Luego se usará para segmentación de votantes."],
        provided_documents: [],
        constraints: ["Generar un calendario de publicaciones."],
      },
    });

    assert.equal(detectProductBoundaryViolation(request), "electoral_strategy");

    const harness = await startProcedureQueryHarness();
    try {
      const result = await postProcedureQuery(harness, request, {
        idempotencyKey: "boundary-context-request-000001",
      });

      await assertContractApiError(result, 400, "product_boundary_violation");
      assert.equal(harness.compilerCalls.count, 0);
      assert.equal(harness.persistence.audits[0]?.reasonCode, "electoral_strategy");
      assert.doesNotMatch(
        JSON.stringify(harness.persistence.audits),
        /segmentación de votantes|calendario de publicaciones/i
      );
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });

  it("allows a bounded evidence-and-procedure request and returns only a draft workflow", async () => {
    const request = procedureQueryRequest({
      question:
        "¿Qué procedimiento documental aplica y qué evidencia falta para una solicitud comunitaria?",
    });

    assert.equal(detectProductBoundaryViolation(request), null);

    const harness = await startProcedureQueryHarness();
    try {
      const result = await postProcedureQuery(harness, request, {
        idempotencyKey: "boundary-allowed-request-000001",
      });

      assert.equal(result.response.status, 200);
      const validators = await procedureQueryValidators;
      assert.equal(
        validators.workflow(result.json),
        true,
        JSON.stringify(validators.workflow.errors)
      );
      assert.equal(harness.compilerCalls.count, 1);
      assert.equal(result.json.product_boundary, "evidence_and_procedure_only");
      assert.equal(result.json.approval_status, "draft");
      assert.equal("campaign_strategy" in result.json, false);
      assert.equal("electoral_segments" in result.json, false);
      assert.equal("content_calendar" in result.json, false);
      assert.equal("publication_tasks" in result.json, false);
      assert.doesNotMatch(
        JSON.stringify(result.json),
        /segmentación electoral|paid media|calendario editorial|publicación en redes/i
      );
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });
});
