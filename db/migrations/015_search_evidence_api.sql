-- LA Muni RAG
-- Feature 068: dedicated tenant Search and EvidenceBundle API control state.
--
-- This migration stores only bounded counters and SHA-256 digests for replay.
-- It does not store query text, raw request bodies, bearer credentials, object
-- coordinates, scanner internals, embedding API keys, or retrieval results.

BEGIN;

CREATE TABLE rag.search_evidence_api_idempotency (
  tenant_id UUID NOT NULL,
  principal_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation = 'evidence_bundle_create_v1'),
  idempotency_key_sha256 BYTEA NOT NULL CHECK (octet_length(idempotency_key_sha256) = 32),
  request_sha256 BYTEA NOT NULL CHECK (octet_length(request_sha256) = 32),
  state TEXT NOT NULL DEFAULT 'processing' CHECK (state IN ('processing', 'completed')),
  response_status SMALLINT CHECK (response_status = 200),
  response_body TEXT,
  response_sha256 BYTEA CHECK (response_sha256 IS NULL OR octet_length(response_sha256) = 32),
  audit_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (tenant_id, principal_id, operation, idempotency_key_sha256),
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE CASCADE,
  CHECK (expires_at > created_at),
  CHECK (
    (state = 'processing'
      AND response_status IS NULL
      AND response_body IS NULL
      AND response_sha256 IS NULL
      AND audit_id IS NULL
      AND completed_at IS NULL)
    OR
    (state = 'completed'
      AND response_status = 200
      AND response_body IS NOT NULL
      AND octet_length(response_body) BETWEEN 2 AND 4194304
      AND response_sha256 IS NOT NULL
      AND audit_id IS NOT NULL
      AND completed_at IS NOT NULL)
  )
);

CREATE INDEX search_evidence_idempotency_expiry_idx
  ON rag.search_evidence_api_idempotency (tenant_id, expires_at);

ALTER TABLE rag.search_evidence_api_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.search_evidence_api_idempotency FORCE ROW LEVEL SECURITY;
CREATE POLICY search_evidence_api_idempotency_tenant_isolation
  ON rag.search_evidence_api_idempotency
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

CREATE TABLE rag.search_evidence_api_rate_limits (
  tenant_id UUID NOT NULL,
  principal_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('search_v1', 'evidence_bundle_create_v1')),
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count BETWEEN 1 AND 1000000),
  blocked_audit_id UUID,
  PRIMARY KEY (tenant_id, principal_id, operation, window_started_at),
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE CASCADE
);

CREATE INDEX search_evidence_rate_expiry_idx
  ON rag.search_evidence_api_rate_limits (tenant_id, window_started_at);

ALTER TABLE rag.search_evidence_api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.search_evidence_api_rate_limits FORCE ROW LEVEL SECURITY;
CREATE POLICY search_evidence_api_rate_limits_tenant_isolation
  ON rag.search_evidence_api_rate_limits
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

CREATE TABLE identity.search_evidence_auth_failure_buckets (
  window_started_at TIMESTAMPTZ PRIMARY KEY,
  failure_count INTEGER NOT NULL DEFAULT 1 CHECK (failure_count BETWEEN 1 AND 1000000),
  first_audit_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()
);

CREATE OR REPLACE FUNCTION identity.record_search_evidence_auth_failure(
  requested_audit_id UUID,
  reason_code TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  bucket_start TIMESTAMPTZ := date_trunc('minute', statement_timestamp());
  selected_audit_id UUID;
BEGIN
  IF requested_audit_id IS NULL OR reason_code !~ '^[a-z][a-z0-9_]{0,63}$' THEN
    RAISE EXCEPTION 'invalid search authentication audit input';
  END IF;

  INSERT INTO identity.search_evidence_auth_failure_buckets (
    window_started_at, failure_count, first_audit_id, updated_at
  ) VALUES (
    bucket_start, 1, requested_audit_id, statement_timestamp()
  )
  ON CONFLICT (window_started_at) DO UPDATE
  SET failure_count = LEAST(
        identity.search_evidence_auth_failure_buckets.failure_count + 1,
        1000000
      ),
      updated_at = statement_timestamp()
  RETURNING first_audit_id INTO selected_audit_id;

  RETURN selected_audit_id;
END;
$function$;

REVOKE ALL ON TABLE
  rag.search_evidence_api_idempotency,
  rag.search_evidence_api_rate_limits,
  identity.search_evidence_auth_failure_buckets
FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.record_search_evidence_auth_failure(UUID, TEXT)
  FROM PUBLIC;

COMMENT ON TABLE rag.search_evidence_api_idempotency IS
  'Digest-only exact replay state for the dedicated EvidenceBundle endpoint.';
COMMENT ON TABLE rag.search_evidence_api_rate_limits IS
  'Bounded aggregate request counters; no query text or request body is persisted.';
COMMENT ON FUNCTION identity.record_search_evidence_auth_failure(UUID, TEXT) IS
  'Minimized unauthenticated failure aggregation without credential or request content.';

COMMIT;
