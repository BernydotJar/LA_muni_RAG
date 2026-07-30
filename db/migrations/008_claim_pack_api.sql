-- LA Muni RAG
-- WS-08 authenticated ClaimPack provider state for POST /api/v1/claim-packs.
-- Stores only digests and validated generated responses. Raw Bearer credentials,
-- request bodies, Content Agency briefs, copy, assets, and publication data are
-- never persisted here.

BEGIN;

CREATE TABLE integration.claim_pack_idempotency (
  tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  principal_id UUID NOT NULL,
  idempotency_key_sha256 BYTEA NOT NULL CHECK (octet_length(idempotency_key_sha256) = 32),
  request_sha256 BYTEA NOT NULL CHECK (octet_length(request_sha256) = 32),
  state TEXT NOT NULL CHECK (state IN ('processing', 'completed')),
  response_status INTEGER CHECK (response_status = 200),
  response_body TEXT CHECK (octet_length(response_body) <= 4194304),
  audit_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, principal_id, idempotency_key_sha256),
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

CREATE INDEX claim_pack_idempotency_expiry_idx
  ON integration.claim_pack_idempotency (expires_at);

CREATE TABLE integration.claim_pack_rate_limits (
  tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  principal_id UUID NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  blocked_audit_id UUID,
  PRIMARY KEY (tenant_id, principal_id, window_started_at),
  FOREIGN KEY (principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE CASCADE
);

CREATE INDEX claim_pack_rate_limits_cleanup_idx
  ON integration.claim_pack_rate_limits (window_started_at);

ALTER TABLE integration.claim_pack_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration.claim_pack_idempotency FORCE ROW LEVEL SECURITY;
CREATE POLICY claim_pack_idempotency_tenant_isolation
  ON integration.claim_pack_idempotency
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE integration.claim_pack_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration.claim_pack_rate_limits FORCE ROW LEVEL SECURITY;
CREATE POLICY claim_pack_rate_limits_tenant_isolation
  ON integration.claim_pack_rate_limits
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

REVOKE ALL ON TABLE
  integration.claim_pack_idempotency,
  integration.claim_pack_rate_limits
FROM PUBLIC;

CREATE TABLE audit.claim_pack_authentication_failures (
  audit_id UUID PRIMARY KEY,
  request_id UUID NOT NULL,
  bucket_started_at TIMESTAMPTZ NOT NULL,
  route TEXT NOT NULL DEFAULT '/api/v1/claim-packs'
    CHECK (route = '/api/v1/claim-packs'),
  event_type TEXT NOT NULL DEFAULT 'identity.authentication_failed'
    CHECK (event_type = 'identity.authentication_failed'),
  outcome TEXT NOT NULL DEFAULT 'blocked' CHECK (outcome = 'blocked'),
  reason_code TEXT NOT NULL CHECK (
    reason_code IN ('credential_rejected', 'authentication_dependency_failure')
  ),
  failure_count BIGINT NOT NULL DEFAULT 1 CHECK (failure_count > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (bucket_started_at, reason_code),
  CHECK (last_seen_at >= created_at)
);

CREATE INDEX claim_pack_authentication_failures_retention_idx
  ON audit.claim_pack_authentication_failures (created_at);

REVOKE ALL ON TABLE audit.claim_pack_authentication_failures FROM PUBLIC;

CREATE FUNCTION audit.record_claim_pack_authentication_failure(
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
    RAISE EXCEPTION 'invalid claim pack authentication audit reason';
  END IF;

  DELETE FROM audit.claim_pack_authentication_failures
  WHERE created_at < statement_timestamp() - interval '30 days';

  v_bucket_started_at := date_trunc('minute', statement_timestamp());
  INSERT INTO audit.claim_pack_authentication_failures (
    audit_id,
    request_id,
    bucket_started_at,
    reason_code
  )
  VALUES (p_audit_id, p_request_id, v_bucket_started_at, p_reason_code)
  ON CONFLICT (bucket_started_at, reason_code)
  DO UPDATE SET
    failure_count = audit.claim_pack_authentication_failures.failure_count + 1,
    last_seen_at = statement_timestamp()
  RETURNING audit_id INTO v_audit_id;

  RETURN v_audit_id;
END;
$function$;

REVOKE ALL ON FUNCTION
  audit.record_claim_pack_authentication_failure(UUID, UUID, TEXT)
FROM PUBLIC;

COMMENT ON TABLE integration.claim_pack_idempotency IS
  'Exact replay state for contract-valid ClaimPack responses; never stores raw request bodies or Content Agency artifacts.';
COMMENT ON TABLE audit.claim_pack_authentication_failures IS
  'Sanitized pre-tenant ClaimPack authentication decisions; never stores credentials, network metadata, headers, or request bodies.';

COMMIT;
