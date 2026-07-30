import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path: string): Promise<string> =>
  readFile(new URL(`../../${path}`, import.meta.url), "utf8");

describe("EVAL-CASE-001 — tenant procedure case system of record", () => {
  it("requires an approved immutable workflow binding and optimistic revision", async () => {
    const [migration, repository] = await Promise.all([
      read("db/migrations/013_procedure_cases.sql"),
      read("src/procedureCases/repository.ts"),
    ]);
    assert.match(migration, /procedure case requires an approved workflow version/i);
    assert.match(migration, /workflow_version_id IS DISTINCT FROM OLD\.workflow_version_id/i);
    assert.match(migration, /procedure case revision must advance exactly once/i);
    assert.match(repository, /expected_revision/);
    assert.match(repository, /revision = revision \+ 1/);
  });

  it("separates operational mutation from documentary validation review", async () => {
    const [handler, rbac] = await Promise.all([
      read("src/api/v1/procedureCaseHandler.ts"),
      read("src/security/rbac.ts"),
    ]);
    assert.match(handler, /set_validation_state/);
    assert.match(handler, /requirePermission\(principal, "procedure:review"\)/);
    assert.match(handler, /requirePermission\(principal, "case:write"\)/);
    assert.match(rbac, /case_operator:[\s\S]*"case:read"[\s\S]*"case:write"/);
    assert.match(rbac, /procedure_reviewer:[\s\S]*"procedure:review"/);
  });

  it("preserves exact aggregate replay and tenant isolation under forced RLS", async () => {
    const [migration, repository, smoke] = await Promise.all([
      read("db/migrations/013_procedure_cases.sql"),
      read("src/procedureCases/repository.ts"),
      read("scripts/procedure-case-postgres-smoke.mjs"),
    ]);
    assert.match(migration, /create_request_sha256 BYTEA NOT NULL/);
    assert.match(migration, /initial_response_sha256 = public\.digest\(initial_response_body, 'sha256'\)/);
    assert.match(migration, /FORCE ROW LEVEL SECURITY/g);
    assert.match(repository, /pg_advisory_xact_lock/);
    assert.match(repository, /initial_response_body/);
    assert.match(smoke, /concurrentAggregateConvergence: true/);
    assert.match(smoke, /crossTenantMarkerLeaked: false/);
  });

  it("requires real document-version identity for received or reviewed evidence", async () => {
    const [migration, repository, apiTest] = await Promise.all([
      read("db/migrations/013_procedure_cases.sql"),
      read("src/procedureCases/repository.ts"),
      read("src/__tests__/procedure-case-api-v1.test.ts"),
    ]);
    assert.match(migration, /state IN \('missing', 'requested'\) OR document_version_id IS NOT NULL/i);
    assert.match(migration, /FOREIGN KEY \(document_version_id, tenant_id\)/i);
    assert.match(repository, /Document version not found/);
    assert.match(apiTest, /invalidDocument/);
  });

  it("keeps audit append-only and refuses legal-status promotion", async () => {
    const [migration, handler, repository, responseSchema] = await Promise.all([
      read("db/migrations/013_procedure_cases.sql"),
      read("src/api/v1/procedureCaseHandler.ts"),
      read("src/procedureCases/repository.ts"),
      read("contracts/schemas/v1/procedure-case.schema.json"),
    ]);
    assert.match(migration, /procedure case events are append-only/i);
    assert.match(handler, /does not prove legal compliance, municipal approval, reception, liquidation, payment, or institutional closure/i);
    assert.doesNotMatch(responseSchema, /legal_status|compliance_status|municipal_approval|payment_status/);
    assert.match(repository, /note_length/);
  });
});
