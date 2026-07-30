import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InMemoryProcedureQueryPersistence,
  type IdempotencyClaim,
  type IdempotencyScope,
  type ProcedureWorkflowCompiler,
} from "../api/v1/index.js";
import type { TenantTransactionClient } from "../security/index.js";
import {
  assertContractApiError,
  postProcedureQuery,
  procedureQueryRequest,
  procedureQueryValidators,
  startProcedureQueryHarness,
  stopProcedureQueryHarness,
  TEST_FIXED_TIME,
  testInternalWorkflow,
} from "./helpers/procedure-query-v1-harness.js";

const CORRUPT_SECRET = "CORRUPT_REPLAY_SECRET_MUST_NOT_ESCAPE";
const COMPILER_SECRET = "COMPILER_FAILURE_SECRET_MUST_NOT_ESCAPE";

class RecoverableCorruptReplayPersistence extends InMemoryProcedureQueryPersistence {
  invalidations = 0;
  private injectCorruptReplay = true;

  override async claimIdempotency(
    client: TenantTransactionClient,
    scope: IdempotencyScope
  ): Promise<IdempotencyClaim> {
    if (this.injectCorruptReplay) {
      return {
        kind: "replay",
        statusCode: 200,
        responseBody: JSON.stringify({
          schema_version: "v1",
          response_type: "procedure_workflow",
          secret: CORRUPT_SECRET,
        }),
        originalAuditId: "99999999-9999-4999-8999-999999999999",
      };
    }
    return super.claimIdempotency(client, scope);
  }

  override async invalidateCompletedIdempotency(
    _client: TenantTransactionClient,
    _scope: IdempotencyScope
  ): Promise<void> {
    this.invalidations += 1;
    this.injectCorruptReplay = false;
  }
}

describe("EVAL-CORRUPT-001", () => {
  it("invalidates a corrupt replay, returns a stable error, and permits a trusted retry", async () => {
    const persistence = new RecoverableCorruptReplayPersistence(() => TEST_FIXED_TIME);
    const harness = await startProcedureQueryHarness({ persistence });
    const request = procedureQueryRequest();
    const idempotencyKey = "corrupt-replay-recovery-000001";
    try {
      const corrupt = await postProcedureQuery(harness, request, { idempotencyKey });

      await assertContractApiError(corrupt, 500, "internal_error");
      assert.equal(corrupt.json.retryable, true);
      assert.equal(persistence.invalidations, 1);
      assert.equal(harness.compilerCalls.count, 0);
      assert.doesNotMatch(corrupt.text, new RegExp(CORRUPT_SECRET));
      assert.equal(
        persistence.audits.some(
          (audit) =>
            audit.eventType === "integration.procedure_query.idempotency_corrupt" &&
            audit.reasonCode === "stored_response_invalid"
        ),
        true
      );
      assert.doesNotMatch(JSON.stringify(persistence.audits), new RegExp(CORRUPT_SECRET));

      const recovered = await postProcedureQuery(harness, request, { idempotencyKey });
      const validators = await procedureQueryValidators;
      assert.equal(recovered.response.status, 200);
      assert.equal(
        validators.workflow(recovered.json),
        true,
        JSON.stringify(validators.workflow.errors)
      );
      assert.equal(recovered.json.approval_status, "draft");
      assert.equal(harness.compilerCalls.count, 1);

      const replay = await postProcedureQuery(harness, request, { idempotencyKey });
      assert.equal(replay.response.status, 200);
      assert.equal(replay.text, recovered.text);
      assert.equal(harness.compilerCalls.count, 1);
      assert.equal(
        persistence.audits.some(
          (audit) => audit.eventType === "integration.procedure_query.idempotency_replayed"
        ),
        true
      );
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });

  it("releases a failed compilation instead of leaving a false completed or in-progress state", async () => {
    let compilerCalls = 0;
    const compiler: ProcedureWorkflowCompiler = async () => {
      compilerCalls += 1;
      if (compilerCalls === 1) {
        throw new Error(COMPILER_SECRET);
      }
      return { workflow: testInternalWorkflow(), evidenceRecords: [] };
    };
    const persistence = new InMemoryProcedureQueryPersistence(() => TEST_FIXED_TIME);
    const harness = await startProcedureQueryHarness({ compiler, persistence });
    const request = procedureQueryRequest();
    const idempotencyKey = "compiler-failure-recovery-000001";
    try {
      const failed = await postProcedureQuery(harness, request, { idempotencyKey });

      await assertContractApiError(failed, 500, "internal_error");
      assert.equal(failed.json.retryable, true);
      assert.equal(compilerCalls, 1);
      assert.doesNotMatch(failed.text, new RegExp(COMPILER_SECRET));
      assert.equal(
        persistence.audits.some(
          (audit) =>
            audit.eventType === "integration.procedure_query.failed" &&
            audit.reasonCode === "execution_failed"
        ),
        true
      );
      assert.doesNotMatch(JSON.stringify(persistence.audits), new RegExp(COMPILER_SECRET));

      const recovered = await postProcedureQuery(harness, request, { idempotencyKey });
      const validators = await procedureQueryValidators;
      assert.equal(recovered.response.status, 200);
      assert.equal(
        validators.workflow(recovered.json),
        true,
        JSON.stringify(validators.workflow.errors)
      );
      assert.equal(compilerCalls, 2);

      const replay = await postProcedureQuery(harness, request, { idempotencyKey });
      assert.equal(replay.response.status, 200);
      assert.equal(replay.text, recovered.text);
      assert.equal(compilerCalls, 2);
      assert.doesNotMatch(replay.text, new RegExp(COMPILER_SECRET));
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });
});
