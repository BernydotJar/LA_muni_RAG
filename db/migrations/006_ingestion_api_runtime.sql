-- LA Muni RAG
-- WS-03 authenticated ingestion-job API support.
--
-- This migration adds bounded per-principal API rate state and a separate
-- tenantless authentication-failure aggregate for the ingestion route family.
-- It stores no Bearer credentials, request bodies, artifact bytes, raw
-- idempotency keys, worker identifiers, or lease tokens.

BEGIN;

CREATE TABLE integration.ingestion_api_rate_limits (
  tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  principal_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (
    operation IN ('ingestion_job_enqueue_v1', 'ingestion_job_get_v1')
  ),
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  blocked_audit_id UUID,
  PRIMARY KEY (tenant_id, principal_id, operation, window_started_at),
  FOREIGN KEY (principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE CASCADE
);

CREATE INDEX ingestion_api_rate_limits_cleanup_idx
  ON integration.ingestion_api_rate_limits (window_started_at);

ALTER TABLE integration.ingestion_api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration.ingestion_api_rate_limits FORCE ROW LEVEL SECURITY;
CREATE POLICY ingestion_api_rate_limits_tenant_isolation
  ON integration.ingestion_api_rate_limits
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

REVOKE ALL ON TABLE integration.ingestion_api_rate_limits FROM PUBLIC;

-- Pre-authentication traffic cannot be assigned to a tenant. Keep the route
-- family in a narrow aggregate that the application can invoke but cannot read.
CREATE TABLE audit.ingestion_authentication_failures (
  audit_id UUID PRIMARY KEY,
  request_id UUID NOT NULL,
  bucket_started_at TIMESTAMPTZ NOT NULL,
  route TEXT NOT NULL DEFAULT '/api/v1/ingestion-jobs'
    CHECK (route = '/api/v1/ingestion-jobs'),
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

CREATE INDEX ingestion_authentication_failures_retention_idx
  ON audit.ingestion_authentication_failures (created_at);

REVOKE ALL ON TABLE audit.ingestion_authentication_failures FROM PUBLIC;

CREATE FUNCTION audit.record_ingestion_authentication_failure(
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
    RAISE EXCEPTION 'invalid ingestion authentication audit reason';
  END IF;

  DELETE FROM audit.ingestion_authentication_failures
  WHERE created_at < statement_timestamp() - interval '30 days';

  v_bucket_started_at := date_trunc('minute', statement_timestamp());
  INSERT INTO audit.ingestion_authentication_failures (
    audit_id,
    request_id,
    bucket_started_at,
    reason_code
  )
  VALUES (p_audit_id, p_request_id, v_bucket_started_at, p_reason_code)
  ON CONFLICT (bucket_started_at, reason_code)
  DO UPDATE SET
    failure_count = audit.ingestion_authentication_failures.failure_count + 1,
    last_seen_at = statement_timestamp()
  RETURNING audit_id INTO v_audit_id;

  RETURN v_audit_id;
END;
$function$;

REVOKE ALL ON FUNCTION audit.record_ingestion_authentication_failure(UUID, UUID, TEXT)
  FROM PUBLIC;

COMMENT ON TABLE integration.ingestion_api_rate_limits IS
  'Bounded per-tenant/principal ingestion API counters; no request or credential material.';
COMMENT ON TABLE audit.ingestion_authentication_failures IS
  'Sanitized pre-tenant ingestion-route decisions; no credentials, IPs, headers, or bodies.';

COMMIT;
