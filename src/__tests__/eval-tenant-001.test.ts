import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  assertContractApiError,
  postProcedureQuery,
  procedureQueryRequest,
  procedureQueryValidators,
  startProcedureQueryHarness,
  stopProcedureQueryHarness,
  TEST_TENANT_A,
  TEST_TENANT_B,
} from "./helpers/procedure-query-v1-harness.js";

const read = (path: string): Promise<string> => readFile(path, "utf8");

const assertTenantTransactions = (
  calls: Array<{ sql: string; values?: unknown[] }>,
  repeats: number
): void => {
  const expected = Array.from({ length: repeats }, () => [
    { sql: "BEGIN" },
    {
      sql: "SELECT set_config('app.tenant_id', $1, true)",
      values: [TEST_TENANT_A],
    },
    { sql: "COMMIT" },
  ]).flat();
  assert.deepEqual(calls, expected);
  assert.doesNotMatch(JSON.stringify(calls), new RegExp(TEST_TENANT_B, "i"));
};

describe("EVAL-TENANT-001", () => {
  it("returns the same non-leaking 403 for role denial and cross-tenant denial", async () => {
    const roleHarness = await startProcedureQueryHarness({ roles: ["viewer"] });
    const tenantHarness = await startProcedureQueryHarness();
    try {
      const roleResult = await postProcedureQuery(
        roleHarness,
        procedureQueryRequest(),
        { idempotencyKey: "tenant-role-denial-000001" }
      );
      const tenantResult = await postProcedureQuery(
        tenantHarness,
        procedureQueryRequest({ tenant_id: TEST_TENANT_B }),
        { idempotencyKey: "tenant-cross-denial-000001" }
      );

      await assertContractApiError(roleResult, 403, "forbidden");
      await assertContractApiError(tenantResult, 403, "forbidden");
      assert.deepEqual(roleResult.json.error, tenantResult.json.error);
      assert.deepEqual(roleResult.json.error, {
        code: "forbidden",
        message: "Access denied",
        details: [],
      });
      assert.equal(tenantResult.json.tenant_id, TEST_TENANT_A);
      assert.doesNotMatch(tenantResult.text, new RegExp(TEST_TENANT_B, "i"));
      assert.doesNotMatch(tenantResult.text, /tenant mismatch|tenant exists|cross-tenant/i);
      assert.equal(roleHarness.compilerCalls.count, 0);
      assert.equal(tenantHarness.compilerCalls.count, 0);
      assertTenantTransactions(roleHarness.transactionPool.calls, 2);
      assertTenantTransactions(tenantHarness.transactionPool.calls, 2);
      assert.equal(roleHarness.transactionPool.releases, 2);
      assert.equal(tenantHarness.transactionPool.releases, 2);
    } finally {
      await stopProcedureQueryHarness(roleHarness);
      await stopProcedureQueryHarness(tenantHarness);
    }
  });

  it("audits the denial in the authenticated tenant without retaining requested-tenant metadata", async () => {
    const harness = await startProcedureQueryHarness();
    try {
      const result = await postProcedureQuery(
        harness,
        procedureQueryRequest({
          tenant_id: TEST_TENANT_B,
          case_context: {
            subject_reference: "TENANT_B_SECRET_MARKER",
            community_id: "tenant-b-community-secret",
            facts: ["TENANT_B_SECRET_MARKER fact"],
            provided_documents: ["tenant-b-document-secret"],
            constraints: ["TENANT_B_SECRET_MARKER constraint"],
          },
        }),
        { idempotencyKey: "tenant-audit-denial-000001" }
      );

      await assertContractApiError(result, 403, "forbidden");
      assert.equal(harness.persistence.audits.length, 1);
      assert.equal(
        harness.persistence.audits[0]?.eventType,
        "integration.procedure_query.tenant_access_denied"
      );
      assert.equal(harness.persistence.audits[0]?.tenantId, TEST_TENANT_A);
      assert.equal(harness.persistence.audits[0]?.reasonCode, "access_denied");
      const auditJson = JSON.stringify(harness.persistence.audits);
      assert.doesNotMatch(auditJson, new RegExp(TEST_TENANT_B, "i"));
      assert.doesNotMatch(
        auditJson,
        /TENANT_B_SECRET_MARKER|tenant-b-community-secret|tenant-b-document-secret/i
      );
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });

  it("executes an allowed request in one transaction-local tenant context", async () => {
    const harness = await startProcedureQueryHarness();
    try {
      const result = await postProcedureQuery(
        harness,
        procedureQueryRequest(),
        { idempotencyKey: "tenant-allowed-request-000001" }
      );
      const validators = await procedureQueryValidators;

      assert.equal(result.response.status, 200);
      assert.equal(
        validators.workflow(result.json),
        true,
        JSON.stringify(validators.workflow.errors)
      );
      assert.equal(result.json.tenant_id, TEST_TENANT_A);
      assert.equal(harness.compilerCalls.count, 1);
      assertTenantTransactions(harness.transactionPool.calls, 2);
      assert.equal(harness.transactionPool.releases, 2);
      assert.doesNotMatch(result.text, new RegExp(TEST_TENANT_B, "i"));
    } finally {
      await stopProcedureQueryHarness(harness);
    }
  });

  it("keeps the disposable PostgreSQL gate non-owner, FORCE-RLS, and secret-marker aware", async () => {
    const [migration, gate, workflow] = await Promise.all([
      read("db/migrations/004_procedure_query_api.sql"),
      read("db/tests/procedure_query_runtime_gate.sql"),
      read(".github/workflows/ci.yml"),
    ]);

    assert.match(
      migration,
      /ALTER TABLE integration\.procedure_query_idempotency FORCE ROW LEVEL SECURITY;/
    );
    assert.match(
      migration,
      /ALTER TABLE integration\.procedure_query_rate_limits FORCE ROW LEVEL SECURITY;/
    );
    assert.match(gate, /NOSUPERUSER/);
    assert.match(gate, /NOBYPASSRLS/);
    assert.match(gate, /missing tenant context exposed/);
    assert.match(gate, /malformed tenant context exposed/);
    assert.match(gate, /tenant A observed tenant B metadata/);
    assert.match(gate, /tenant A unexpectedly inserted tenant B state/);
    assert.match(gate, /TENANT_B_SECRET_MARKER/);
    assert.match(workflow, /db\/tests\/procedure_query_runtime_gate\.sql/);
    assert.match(
      gate,
      /IF is_super IS DISTINCT FROM false OR bypasses_rls IS DISTINCT FROM false THEN/
    );
  });
});
