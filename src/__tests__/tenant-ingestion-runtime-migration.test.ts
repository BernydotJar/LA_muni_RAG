import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const migration = await readFile("db/migrations/005_tenant_ingestion_runtime.sql", "utf8");
const service = await readFile("src/ingestion/ingestionJobService.ts", "utf8");
const vectorRepository = await readFile("src/embeddings/tenantPgVectorRepository.ts", "utf8");
const indexing = await readFile("src/ingestion/vectorIndexing.ts", "utf8");

describe("tenant vector and ingestion-job runtime foundation", () => {
  it("converges the vector table on explicit tenant ownership and stops unsafe unmapped legacy rows", () => {
    assert.match(migration, /^BEGIN;/m);
    assert.match(migration, /^COMMIT;$/m);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS rag\.embedding_vectors/);
    assert.match(migration, /RAISE EXCEPTION[\s\S]*unscoped embedding_vectors rows/);
    assert.doesNotMatch(migration, /SET tenant_id = '00000000-0000-4000-8000-000000000001'/);
    assert.match(migration, /PRIMARY KEY \(tenant_id, chunk_id\)/);
    assert.match(migration, /embedding_vectors_version_tenant_fk[\s\S]*FOREIGN KEY \(document_version_id, tenant_id\)/);
    assert.match(migration, /embedding_vectors_job_tenant_fk[\s\S]*FOREIGN KEY \(ingestion_job_id, tenant_id\)/);
    assert.match(migration, /embedding_vectors FORCE ROW LEVEL SECURITY/);
    assert.match(migration, /USING \(tenant_id = identity\.current_tenant_id\(\)\)/);
    assert.match(migration, /ALTER COLUMN contract_version SET DEFAULT 1/);
    assert.match(migration, /WITH CHECK \([\s\S]*contract_version = 1/);
    assert.match(migration, /DROP INDEX IF EXISTS rag\.embedding_vectors_embedding_idx/);
  });

  it("adds digest-only idempotency, work identity, bounded attempts, leases, heartbeat, and coherent states", () => {
    for (const column of [
      "requested_by_principal_id",
      "idempotency_key_sha256",
      "request_sha256",
      "artifact_sha256",
      "pipeline_config_sha256",
      "work_sha256",
      "attempt_count",
      "max_attempts",
      "available_at",
      "lease_owner_sha256",
      "lease_token_sha256",
      "lease_expires_at",
      "heartbeat_at",
      "last_error_code",
      "last_error_retryable",
    ]) {
      assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`));
    }
    assert.match(migration, /octet_length\(idempotency_key_sha256\) = 32/);
    assert.match(migration, /attempt_count BETWEEN 0 AND max_attempts/);
    assert.match(migration, /max_attempts BETWEEN 1 AND 10/);
    assert.match(migration, /status = 'processing'[\s\S]*octet_length\(lease_token_sha256\) = 32/);
    assert.match(migration, /status IN \('failed', 'superseded'\)[\s\S]*last_error_code ~/);
    assert.match(migration, /ingestion_jobs_vector_idempotency_idx/);
    assert.match(migration, /ingestion_jobs_vector_work_idx/);
    assert.doesNotMatch(migration, /raw_idempotency|raw_lease|raw_error/);
  });

  it("claims with SKIP LOCKED, fences every mutation by digest and expiry, and commits vectors with job/audit state", () => {
    assert.match(service, /FOR UPDATE SKIP LOCKED/g);
    assert.match(service, /lease_token_sha256 = decode\(\$3, 'hex'\)/g);
    assert.match(service, /lease_expires_at > statement_timestamp\(\)/g);
    assert.match(service, /withTenantTransaction/);
    assert.match(service, /content_sha256 !== job\.artifactSha256/);
    assert.match(service, /replaceDocumentVersion\(input\.records, \{/);
    assert.match(service, /rag\.ingestion_job\.processed/);
    assert.match(service, /input\.principalId\.toLowerCase\(\)/);
    assert.match(service, /last_error_code = \$5|last_error_code = \$4/);
    assert.doesNotMatch(service, /error\.message|String\(error\)/);
  });

  it("uses explicit tenant predicates, composite conflicts, eligibility filters, and bounded public search", () => {
    assert.match(vectorRepository, /ON CONFLICT \(tenant_id, chunk_id\)/);
    assert.match(vectorRepository, /WHERE tenant_id = \$1::uuid/g);
    assert.match(vectorRepository, /document_version_id = EXCLUDED\.document_version_id/);
    assert.match(vectorRepository, /ingestion_job_id IS DISTINCT FROM EXCLUDED\.ingestion_job_id/);
    assert.match(vectorRepository, /VECTOR_WRITE_BATCH_SIZE = 64/);
    assert.match(vectorRepository, /vector\.embedding_provider = \$2/);
    assert.match(vectorRepository, /vector\.embedding_model = \$3/);
    assert.match(vectorRepository, /job\.status = 'processed'/);
    assert.match(vectorRepository, /version\.extraction_status = 'processed'/);
    assert.match(vectorRepository, /document\.status = 'active'/);
    assert.match(vectorRepository, /confidentiality' = 'public'/);
    assert.match(vectorRepository, /MAX_VECTOR_SEARCH_LIMIT = 100/);
  });

  it("removes the default global-pool writer from direct vector indexing", () => {
    assert.doesNotMatch(indexing, /PgVectorEmbeddingRepository/);
    assert.match(indexing, /tenant_ingestion_job_required/);
    assert.match(indexing, /dependencies\.embeddingRepository/);
  });
});
