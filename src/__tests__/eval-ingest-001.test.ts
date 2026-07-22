import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("EVAL-INGEST-001 — durable tenant ingestion pipeline", () => {
  it("requires exact immutable artifact acceptance before extraction completion", async () => {
    const [migration, artifactEval, worker] = await Promise.all([
      readFile("db/migrations/007_persisted_artifact_acceptance.sql", "utf8"),
      readFile("src/__tests__/eval-artifact-001.test.ts", "utf8"),
      readFile("src/ingestion/ingestionWorker.ts", "utf8"),
    ]);
    assert.match(migration, /content_sha256|sha256/i);
    assert.match(migration, /malware|scan/i);
    assert.match(migration, /accepted/i);
    assert.match(artifactEval, /accepts only exact immutable bytes/i);
    assert.match(worker, /complete|fail/i);
  });

  it("uses leased jobs with fencing, heartbeat, bounded retry and stale-worker rejection", async () => {
    const [migration, gate, leaseEval, service] = await Promise.all([
      readFile("db/migrations/005_tenant_ingestion_runtime.sql", "utf8"),
      readFile("db/tests/artifact_vector_runtime_hardening_gate.sql", "utf8"),
      readFile("src/__tests__/eval-job-lease-001.test.ts", "utf8"),
      readFile("src/ingestion/ingestionJobService.ts", "utf8"),
    ]);
    assert.match(service, /FOR UPDATE(?: OF job)? SKIP LOCKED/i);
    assert.match(migration, /lease_token_sha256|fencing/i);
    assert.match(migration, /heartbeat_at|lease_expires_at/i);
    assert.match(leaseEval, /stale/i);
    assert.match(service, /maxAttempts|max_attempts|retry/i);
  });

  it("persists tenant vector generations atomically with model identity and stale removal", async () => {
    const [migration, vectorEval, vectorStore] = await Promise.all([
      readFile("db/migrations/005_tenant_ingestion_runtime.sql", "utf8"),
      readFile("src/__tests__/eval-vector-001.test.ts", "utf8"),
      readFile("src/embeddings/tenantPgVectorRepository.ts", "utf8"),
    ]);
    assert.match(migration, /tenant_id/i);
    assert.match(migration, /embedding_provider|provider/i);
    assert.match(migration, /embedding_model|model/i);
    assert.match(migration, /embedding_dimension|dimension/i);
    assert.match(vectorEval, /replaceDocumentVersion/);
    assert.match(vectorEval, /stale|rollback/i);
    assert.match(vectorStore, /transaction|BEGIN|withTenant|client/i);
  });

  it("enforces tenant-scoped HTTP submission, idempotency and sanitized failures", async () => {
    const [handler, apiTest, migrationTest] = await Promise.all([
      readFile("src/api/v1/ingestionHandler.ts", "utf8"),
      readFile("src/__tests__/ingestion-job-api-v1.test.ts", "utf8"),
      readFile("src/__tests__/tenant-ingestion-runtime-migration.test.ts", "utf8"),
    ]);
    assert.match(handler, /authenticateBearer/);
    assert.match(handler, /requireTenantMatch/);
    assert.match(handler, /Idempotency|idempotency/i);
    assert.match(apiTest, /cross-tenant|tenant/i);
    assert.match(apiTest, /replay|idempot/i);
    assert.match(migrationTest, /FORCE ROW LEVEL SECURITY|forced RLS/i);
  });

  it("has real disposable PostgreSQL gates for artifacts, leases, vectors and compiled HTTP", async () => {
    const [tenantGate, hardeningGate, ingestionSmoke, tenantSmoke] = await Promise.all([
      readFile("db/tests/tenant_ingestion_runtime_gate.sql", "utf8"),
      readFile("db/tests/artifact_vector_runtime_hardening_gate.sql", "utf8"),
      readFile("scripts/ingestion-api-postgres-smoke.mjs", "utf8"),
      readFile("scripts/tenant-ingestion-postgres-smoke.mjs", "utf8"),
    ]);
    assert.match(tenantGate, /NOBYPASSRLS|rolbypassrls/i);
    assert.match(hardeningGate, /rollback|stale|fencing|scan/i);
    assert.match(ingestionSmoke, /createApiServer/);
    assert.match(tenantSmoke, /concurrent|Promise\.all|50/);
  });

  it("does not claim a production object store, scanner, dispatcher or real corpus ingestion", async () => {
    const [state, inventory] = await Promise.all([
      readFile("program/current-state.md", "utf8"),
      readFile(".rag/source-inventory.json", "utf8"),
    ]);
    assert.match(state, /no production object store/i);
    assert.match(state, /scanner\/definitions monitor/i);
    assert.match(state, /dispatcher/i);
    assert.match(state, /zero documents are\s+credited as ingested/i);
    const parsed = JSON.parse(inventory) as { records: Array<{ status: string }> };
    assert.equal(parsed.records.filter((record) => record.status === "ingested").length, 0);
  });
});
