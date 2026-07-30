-- LA Muni RAG
-- WS-07/WS-08 production runtime state for POST /api/v1/procedure-queries.
-- Stores only credential/request/key digests and generated responses; Bearer
-- credentials and raw inbound request bodies are never persisted.

BEGIN;

CREATE SCHEMA integration;
REVOKE ALL ON SCHEMA integration FROM PUBLIC;

-- These reviewed, official core registry seeds predate the confidentiality
-- field. Label only the explicit public subset; every other missing value stays
-- fail-closed and is ineligible for the integration search path.
SELECT set_config(
  'app.tenant_id',
  '00000000-0000-4000-8000-000000000001',
  true
);
UPDATE rag.documents
SET metadata = jsonb_set(metadata, '{confidentiality}', '"public"'::jsonb, true)
WHERE tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
  AND metadata ->> 'seed_batch' = 'core_documents_v1'
  AND status = 'active'
  AND official_source = true
  AND source_url IS NOT NULL
  AND metadata ->> 'confidentiality' IS NULL;

CREATE TABLE integration.procedure_query_idempotency (
  tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  principal_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation = 'procedure_query_v1'),
  idempotency_key_sha256 BYTEA NOT NULL CHECK (octet_length(idempotency_key_sha256) = 32),
  request_sha256 BYTEA NOT NULL CHECK (octet_length(request_sha256) = 32),
  state TEXT NOT NULL CHECK (state IN ('processing', 'completed')),
  response_status INTEGER CHECK (response_status = 200),
  response_body TEXT CHECK (octet_length(response_body) <= 4194304),
  audit_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, principal_id, operation, idempotency_key_sha256),
  FOREIGN KEY (principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE CASCADE,
  CHECK (expires_at > created_at),
  CHECK (
    (state = 'processing' AND response_status IS NULL AND response_body IS NULL
      AND audit_id IS NULL AND completed_at IS NULL)
    OR
    (state = 'completed' AND response_status IS NOT NULL AND response_body IS NOT NULL
      AND audit_id IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE INDEX procedure_query_idempotency_expiry_idx
  ON integration.procedure_query_idempotency (expires_at);

CREATE TABLE integration.procedure_query_rate_limits (
  tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  principal_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation = 'procedure_query_v1'),
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  blocked_audit_id UUID,
  PRIMARY KEY (tenant_id, principal_id, operation, window_started_at),
  FOREIGN KEY (principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE CASCADE
);

CREATE INDEX procedure_query_rate_limits_cleanup_idx
  ON integration.procedure_query_rate_limits (window_started_at);

ALTER TABLE integration.procedure_query_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration.procedure_query_idempotency FORCE ROW LEVEL SECURITY;
CREATE POLICY procedure_query_idempotency_tenant_isolation
  ON integration.procedure_query_idempotency
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE integration.procedure_query_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration.procedure_query_rate_limits FORCE ROW LEVEL SECURITY;
CREATE POLICY procedure_query_rate_limits_tenant_isolation
  ON integration.procedure_query_rate_limits
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

REVOKE ALL ON ALL TABLES IN SCHEMA integration FROM PUBLIC;

-- Pre-authentication failures have no trustworthy tenant. This deliberately
-- separate, tenantless sink prevents invented tenant attribution. Its narrow
-- SECURITY DEFINER function accepts UUID correlation only plus an allowlisted
-- reason; route, event type, and outcome are fixed in the function body.
CREATE TABLE audit.authentication_failures (
  audit_id UUID PRIMARY KEY,
  request_id UUID NOT NULL,
  bucket_started_at TIMESTAMPTZ NOT NULL,
  route TEXT NOT NULL DEFAULT '/api/v1/procedure-queries'
    CHECK (route = '/api/v1/procedure-queries'),
  event_type TEXT NOT NULL DEFAULT 'identity.authentication_failed'
    CHECK (event_type = 'identity.authentication_failed'),
  outcome TEXT NOT NULL DEFAULT 'blocked' CHECK (outcome = 'blocked'),
  reason_code TEXT NOT NULL CHECK (
    reason_code IN ('credential_rejected', 'authentication_dependency_failure')
  ),
  failure_count BIGINT NOT NULL DEFAULT 1 CHECK (failure_count > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bucket_started_at, reason_code),
  CHECK (last_seen_at >= created_at)
);

CREATE INDEX authentication_failures_retention_idx
  ON audit.authentication_failures (created_at);

REVOKE ALL ON TABLE audit.authentication_failures FROM PUBLIC;

CREATE FUNCTION audit.record_authentication_failure(
  p_audit_id UUID,
  p_request_id UUID,
  p_reason_code TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, audit
AS $function$
DECLARE
  v_bucket_started_at TIMESTAMPTZ;
  v_audit_id UUID;
BEGIN
  IF p_reason_code NOT IN ('credential_rejected', 'authentication_dependency_failure') THEN
    RAISE EXCEPTION 'invalid authentication audit reason';
  END IF;

  DELETE FROM audit.authentication_failures
  WHERE created_at < statement_timestamp() - interval '30 days';

  v_bucket_started_at := date_trunc('minute', statement_timestamp());
  INSERT INTO audit.authentication_failures (
    audit_id,
    request_id,
    bucket_started_at,
    reason_code
  )
  VALUES (p_audit_id, p_request_id, v_bucket_started_at, p_reason_code)
  ON CONFLICT (bucket_started_at, reason_code)
  DO UPDATE SET
    failure_count = audit.authentication_failures.failure_count + 1,
    last_seen_at = statement_timestamp()
  RETURNING audit_id INTO v_audit_id;

  RETURN v_audit_id;
END;
$function$;

REVOKE ALL ON FUNCTION audit.record_authentication_failure(UUID, UUID, TEXT) FROM PUBLIC;

COMMENT ON TABLE audit.authentication_failures IS
  'Sanitized pre-tenant authentication decisions; never stores credentials, IP addresses, headers, or request bodies.';
COMMENT ON COLUMN integration.procedure_query_idempotency.response_body IS
  'Exact, contract-validated generated response used for byte-for-byte replay; never the raw request body.';

COMMIT;
