-- LA Muni RAG
-- WS-03 tenant-scoped vector persistence and durable ingestion jobs.
--
-- Apply after 003_identity_tenancy_rbac.sql. This migration replaces the
-- legacy production ordering dependency on migrations/011-production-vector-store.sql:
-- a fresh database receives the tenant-owned vector table here, while an
-- existing standalone table is upgraded to the same boundary.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag.embedding_vectors (
  tenant_id UUID NOT NULL,
  document_version_id UUID,
  ingestion_job_id UUID,
  contract_version SMALLINT NOT NULL DEFAULT 0,
  chunk_id TEXT NOT NULL,
  document_key TEXT NOT NULL,
  document_version TEXT NOT NULL,
  document_title TEXT NOT NULL,
  citation_label TEXT NOT NULL CHECK (length(trim(citation_label)) > 0),
  page_start INTEGER,
  page_end INTEGER,
  article_number TEXT,
  source_type TEXT NOT NULL,
  section_path JSONB NOT NULL DEFAULT '[]'::jsonb,
  section_type TEXT NOT NULL,
  chunk_ordinal INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  token_estimate INTEGER NOT NULL,
  embedding_model TEXT NOT NULL,
  embedding_provider TEXT NOT NULL,
  embedding_dimension INTEGER NOT NULL,
  embedding VECTOR(1536) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  indexed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, chunk_id)
);

-- Upgrade the legacy standalone table if it already exists. Migration 003 has
-- already mapped any reviewed legacy rows. A NULL tenant here means the unsafe
-- post-003 standalone order was used, so this migration stops for human review
-- instead of inventing ownership.
ALTER TABLE rag.embedding_vectors ADD COLUMN IF NOT EXISTS tenant_id UUID;
ALTER TABLE rag.embedding_vectors ADD COLUMN IF NOT EXISTS document_version_id UUID;
ALTER TABLE rag.embedding_vectors ADD COLUMN IF NOT EXISTS ingestion_job_id UUID;
ALTER TABLE rag.embedding_vectors
  ADD COLUMN IF NOT EXISTS contract_version SMALLINT NOT NULL DEFAULT 0;
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM rag.embedding_vectors WHERE tenant_id IS NULL) THEN
    RAISE EXCEPTION
      'unscoped embedding_vectors rows require an explicit reviewed tenant mapping before migration 005';
  END IF;
END;
$migration$;
ALTER TABLE rag.embedding_vectors ALTER COLUMN tenant_id SET NOT NULL;

-- Both the legacy and fresh table use this generated name. Rebuilding the key
-- makes the migration converge regardless of whether migration 003 hardened
-- the legacy table first.
ALTER TABLE rag.embedding_vectors DROP CONSTRAINT IF EXISTS embedding_vectors_pkey;
ALTER TABLE rag.embedding_vectors
  ADD CONSTRAINT embedding_vectors_pkey PRIMARY KEY (tenant_id, chunk_id);

ALTER TABLE rag.embedding_vectors
  DROP CONSTRAINT IF EXISTS embedding_vectors_tenant_fk;
ALTER TABLE rag.embedding_vectors
  ADD CONSTRAINT embedding_vectors_tenant_fk
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT;

ALTER TABLE rag.embedding_vectors
  DROP CONSTRAINT IF EXISTS embedding_vectors_version_tenant_fk;
ALTER TABLE rag.embedding_vectors
  ADD CONSTRAINT embedding_vectors_version_tenant_fk
  FOREIGN KEY (document_version_id, tenant_id)
  REFERENCES rag.document_versions(id, tenant_id) ON DELETE CASCADE;

ALTER TABLE rag.embedding_vectors
  DROP CONSTRAINT IF EXISTS embedding_vectors_job_tenant_fk;
ALTER TABLE rag.embedding_vectors
  ADD CONSTRAINT embedding_vectors_job_tenant_fk
  FOREIGN KEY (ingestion_job_id, tenant_id)
  REFERENCES rag.ingestion_jobs(id, tenant_id) ON DELETE RESTRICT;

ALTER TABLE rag.embedding_vectors
  DROP CONSTRAINT IF EXISTS embedding_vectors_page_range_chk;
ALTER TABLE rag.embedding_vectors
  ADD CONSTRAINT embedding_vectors_page_range_chk CHECK (
    page_end IS NULL OR page_start IS NULL OR page_end >= page_start
  );
ALTER TABLE rag.embedding_vectors
  DROP CONSTRAINT IF EXISTS embedding_vectors_runtime_shape_chk;
ALTER TABLE rag.embedding_vectors
  ADD CONSTRAINT embedding_vectors_runtime_shape_chk CHECK (
    char_length(chunk_id) BETWEEN 1 AND 512
    AND chunk_id !~ '[[:cntrl:]]'
    AND char_length(document_key) BETWEEN 1 AND 512
    AND document_key ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]*$'
    AND char_length(document_version) BETWEEN 1 AND 256
    AND document_version !~ '[[:cntrl:]]'
    AND char_length(document_title) BETWEEN 1 AND 1000
    AND document_title !~ '[[:cntrl:]]'
    AND char_length(citation_label) BETWEEN 1 AND 2000
    AND citation_label !~ '[[:cntrl:]]'
    AND (article_number IS NULL OR (
      char_length(article_number) BETWEEN 1 AND 256
      AND article_number !~ '[[:cntrl:]]'
    ))
    AND source_type ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,63}$'
    AND section_type ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,63}$'
    AND char_length(chunk_text) BETWEEN 1 AND 1048576
    AND content_sha256 ~ '^[0-9a-f]{64}$'
    AND chunk_ordinal >= 1
    AND token_estimate >= 1
    AND (page_start IS NULL OR page_start >= 1)
    AND (page_end IS NULL OR page_end >= 1)
    AND embedding_dimension = 1536
    AND embedding_provider ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'
    AND embedding_model ~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'
    AND jsonb_typeof(section_path) = 'array'
    AND pg_column_size(section_path) <= 65536
    AND jsonb_typeof(metadata) = 'object'
    AND pg_column_size(metadata) <= 262144
    AND (
      (contract_version = 0 AND ingestion_job_id IS NULL)
      OR
      (contract_version = 1
        AND ingestion_job_id IS NOT NULL
        AND document_version_id IS NOT NULL)
    )
  ) NOT VALID;
ALTER TABLE rag.embedding_vectors
  ALTER COLUMN contract_version SET DEFAULT 1;

-- A global approximate index can return too few rows after tenant/RLS filtering.
-- Keep v1 retrieval exact until a tenant-partitioned index strategy has load and
-- recall evidence. These names may exist on the legacy standalone table.
DROP INDEX IF EXISTS rag.embedding_vectors_embedding_idx;
DROP INDEX IF EXISTS rag.embedding_vectors_document_idx;
DROP INDEX IF EXISTS rag.embedding_vectors_model_idx;
CREATE INDEX IF NOT EXISTS embedding_vectors_tenant_document_idx
  ON rag.embedding_vectors (tenant_id, document_version_id, chunk_ordinal);
CREATE INDEX IF NOT EXISTS embedding_vectors_tenant_model_idx
  ON rag.embedding_vectors (
    tenant_id,
    embedding_provider,
    embedding_model,
    embedding_dimension
  );

ALTER TABLE rag.embedding_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.embedding_vectors FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS embedding_vectors_tenant_isolation
  ON rag.embedding_vectors;
CREATE POLICY embedding_vectors_tenant_isolation
  ON rag.embedding_vectors
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (
    tenant_id = identity.current_tenant_id()
    AND contract_version = 1
  );

REVOKE ALL ON TABLE rag.embedding_vectors FROM PUBLIC;

-- The original ingestion_jobs table was a schema placeholder. The v1 runtime
-- stores only digests for idempotency and worker leases, fixed state, bounded
-- attempts, safe error classification, and aggregate metrics.
ALTER TABLE rag.ingestion_jobs
  ADD COLUMN IF NOT EXISTS requested_by_principal_id UUID;
ALTER TABLE rag.ingestion_jobs
  ADD COLUMN IF NOT EXISTS contract_version SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE rag.ingestion_jobs
  ADD COLUMN IF NOT EXISTS idempotency_key_sha256 BYTEA;
ALTER TABLE rag.ingestion_jobs
  ADD COLUMN IF NOT EXISTS request_sha256 BYTEA;
ALTER TABLE rag.ingestion_jobs
  ADD COLUMN IF NOT EXISTS artifact_sha256 BYTEA;
ALTER TABLE rag.ingestion_jobs
  ADD COLUMN IF NOT EXISTS pipeline_config_sha256 BYTEA;
ALTER TABLE rag.ingestion_jobs
  ADD COLUMN IF NOT EXISTS work_sha256 BYTEA;
ALTER TABLE rag.ingestion_jobs
  ADD COLUMN IF NOT EXISTS pipeline_config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE rag.ingestion_jobs
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rag.ingestion_jobs
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3;
ALTER TABLE rag.ingestion_jobs
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE rag.ingestion_jobs
  ADD COLUMN IF NOT EXISTS lease_owner_sha256 BYTEA;
ALTER TABLE rag.ingestion_jobs
  ADD COLUMN IF NOT EXISTS lease_token_sha256 BYTEA;
ALTER TABLE rag.ingestion_jobs
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
ALTER TABLE rag.ingestion_jobs
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;
ALTER TABLE rag.ingestion_jobs
  ADD COLUMN IF NOT EXISTS last_error_code TEXT;
ALTER TABLE rag.ingestion_jobs
  ADD COLUMN IF NOT EXISTS last_error_retryable BOOLEAN;

ALTER TABLE rag.ingestion_jobs
  DROP CONSTRAINT IF EXISTS ingestion_jobs_requested_principal_tenant_fk;
ALTER TABLE rag.ingestion_jobs
  ADD CONSTRAINT ingestion_jobs_requested_principal_tenant_fk
  FOREIGN KEY (requested_by_principal_id, tenant_id)
  REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT;

ALTER TABLE rag.ingestion_jobs
  DROP CONSTRAINT IF EXISTS ingestion_jobs_vector_runtime_chk;
ALTER TABLE rag.ingestion_jobs
  ADD CONSTRAINT ingestion_jobs_vector_runtime_chk CHECK (
    job_type <> 'document_vector_index_v1'
    OR (
      contract_version = 1
      AND
      document_version_id IS NOT NULL
      AND requested_by_principal_id IS NOT NULL
      AND octet_length(idempotency_key_sha256) = 32
      AND octet_length(request_sha256) = 32
      AND octet_length(artifact_sha256) = 32
      AND octet_length(pipeline_config_sha256) = 32
      AND octet_length(work_sha256) = 32
      AND attempt_count BETWEEN 0 AND max_attempts
      AND max_attempts BETWEEN 1 AND 10
      AND error_message IS NULL
      AND jsonb_typeof(metrics) = 'object'
      AND pg_column_size(metrics) <= 65536
      AND jsonb_typeof(pipeline_config) = 'object'
      AND pg_column_size(pipeline_config) <= 16384
      AND (
        (status = 'queued'
          AND finished_at IS NULL
          AND lease_owner_sha256 IS NULL
          AND lease_token_sha256 IS NULL
          AND lease_expires_at IS NULL
          AND heartbeat_at IS NULL)
        OR
        (status = 'processing'
          AND started_at IS NOT NULL
          AND finished_at IS NULL
          AND octet_length(lease_owner_sha256) = 32
          AND octet_length(lease_token_sha256) = 32
          AND lease_expires_at IS NOT NULL
          AND heartbeat_at IS NOT NULL)
        OR
        (status = 'processed'
          AND started_at IS NOT NULL
          AND finished_at IS NOT NULL
          AND last_error_code IS NULL
          AND last_error_retryable IS NULL
          AND lease_owner_sha256 IS NULL
          AND lease_token_sha256 IS NULL
          AND lease_expires_at IS NULL
          AND heartbeat_at IS NULL)
        OR
        (status IN ('failed', 'superseded')
          AND finished_at IS NOT NULL
          AND last_error_code ~ '^[a-z][a-z0-9_]{0,63}$'
          AND last_error_retryable IS NOT NULL
          AND lease_owner_sha256 IS NULL
          AND lease_token_sha256 IS NULL
          AND lease_expires_at IS NULL
          AND heartbeat_at IS NULL)
      )
    )
  ) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS ingestion_jobs_vector_idempotency_idx
  ON rag.ingestion_jobs (
    tenant_id,
    requested_by_principal_id,
    job_type,
    idempotency_key_sha256
  )
  WHERE job_type = 'document_vector_index_v1'
    AND idempotency_key_sha256 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ingestion_jobs_vector_work_idx
  ON rag.ingestion_jobs (tenant_id, job_type, work_sha256)
  WHERE job_type = 'document_vector_index_v1'
    AND work_sha256 IS NOT NULL
    AND status IN ('queued', 'processing', 'processed');
CREATE INDEX IF NOT EXISTS ingestion_jobs_vector_lease_idx
  ON rag.ingestion_jobs (tenant_id, status, available_at, lease_expires_at, created_at)
  WHERE job_type = 'document_vector_index_v1';

COMMENT ON COLUMN rag.ingestion_jobs.idempotency_key_sha256 IS
  'SHA-256 digest only; raw idempotency keys are never persisted.';
COMMENT ON COLUMN rag.ingestion_jobs.lease_token_sha256 IS
  'SHA-256 digest only; the raw worker lease token exists only in worker memory.';
COMMENT ON COLUMN rag.ingestion_jobs.last_error_code IS
  'Allowlisted stable classification only; raw exception text belongs in neither jobs nor audit.';
COMMENT ON CONSTRAINT embedding_vectors_runtime_shape_chk ON rag.embedding_vectors IS
  'NOT VALID preserves reviewable legacy rows while enforcing this shape on every new or changed row.';

COMMIT;
