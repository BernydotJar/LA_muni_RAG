-- LA Muni RAG
-- WS-05 authenticated workflow lifecycle API state.
-- Stores request/key digests and validated replay bytes only. It never stores
-- Bearer credentials, raw request bodies, campaign data, or content-production state.

BEGIN;

CREATE TABLE integration.workflow_lifecycle_idempotency (
  tenant_id UUID NOT NULL,
  principal_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN (
    'workflow_draft_create_v1',
    'workflow_submit_review_v1',
    'workflow_record_review_v1',
    'workflow_approve_v1',
    'workflow_supersede_v1',
    'workflow_archive_v1'
  )),
  idempotency_key_sha256 BYTEA NOT NULL CHECK (octet_length(idempotency_key_sha256) = 32),
  request_sha256 BYTEA NOT NULL CHECK (octet_length(request_sha256) = 32),
  state TEXT NOT NULL DEFAULT 'processing' CHECK (state IN ('processing', 'completed')),
  response_status INTEGER CHECK (response_status IN (200, 201)),
  response_body TEXT CHECK (response_body IS NULL OR octet_length(response_body) <= 4194304),
  audit_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (tenant_id, principal_id, operation, idempotency_key_sha256),
  FOREIGN KEY (tenant_id)
    REFERENCES identity.tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE CASCADE,
  CHECK (
    (state = 'processing' AND response_status IS NULL AND response_body IS NULL
      AND audit_id IS NULL AND completed_at IS NULL)
    OR
    (state = 'completed' AND response_status IS NOT NULL AND response_body IS NOT NULL
      AND audit_id IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE INDEX workflow_lifecycle_idempotency_expiry_idx
  ON integration.workflow_lifecycle_idempotency (expires_at);

CREATE TABLE integration.workflow_lifecycle_rate_limits (
  tenant_id UUID NOT NULL,
  principal_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN (
    'workflow_draft_create_v1',
    'workflow_review_write_v1',
    'workflow_approval_write_v1',
    'workflow_read_v1'
  )),
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count BETWEEN 0 AND 1000000),
  blocked_audit_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (tenant_id, principal_id, operation, window_started_at),
  FOREIGN KEY (tenant_id)
    REFERENCES identity.tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE CASCADE
);

CREATE INDEX workflow_lifecycle_rate_limits_expiry_idx
  ON integration.workflow_lifecycle_rate_limits (window_started_at);

CREATE TABLE audit.workflow_lifecycle_authentication_failures (
  audit_id UUID PRIMARY KEY,
  bucket_started_at TIMESTAMPTZ NOT NULL,
  reason_code TEXT NOT NULL CHECK (reason_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  failure_count BIGINT NOT NULL DEFAULT 1 CHECK (failure_count BETWEEN 1 AND 1000000000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (bucket_started_at, reason_code)
);

REVOKE ALL ON TABLE audit.workflow_lifecycle_authentication_failures FROM PUBLIC;

CREATE FUNCTION audit.record_workflow_lifecycle_authentication_failure(
  p_audit_id UUID,
  p_fallback_audit_id UUID,
  p_reason_code TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, audit
AS $function$
DECLARE
  v_bucket TIMESTAMPTZ := date_trunc('minute', statement_timestamp());
  v_result UUID;
BEGIN
  IF p_reason_code IS NULL OR p_reason_code !~ '^[a-z][a-z0-9_]{0,63}$' THEN
    RAISE EXCEPTION 'invalid workflow lifecycle authentication failure code';
  END IF;

  DELETE FROM audit.workflow_lifecycle_authentication_failures
  WHERE created_at < statement_timestamp() - interval '30 days';

  INSERT INTO audit.workflow_lifecycle_authentication_failures (
    audit_id,
    bucket_started_at,
    reason_code
  ) VALUES (
    COALESCE(p_audit_id, p_fallback_audit_id),
    v_bucket,
    p_reason_code
  )
  ON CONFLICT (bucket_started_at, reason_code)
  DO UPDATE SET
    failure_count = audit.workflow_lifecycle_authentication_failures.failure_count + 1,
    updated_at = statement_timestamp()
  RETURNING audit_id INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION
  audit.record_workflow_lifecycle_authentication_failure(UUID, UUID, TEXT)
FROM PUBLIC;

ALTER TABLE integration.workflow_lifecycle_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration.workflow_lifecycle_idempotency FORCE ROW LEVEL SECURITY;
CREATE POLICY workflow_lifecycle_idempotency_tenant_isolation
  ON integration.workflow_lifecycle_idempotency
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE integration.workflow_lifecycle_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration.workflow_lifecycle_rate_limits FORCE ROW LEVEL SECURITY;
CREATE POLICY workflow_lifecycle_rate_limits_tenant_isolation
  ON integration.workflow_lifecycle_rate_limits
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

REVOKE ALL ON TABLE
  integration.workflow_lifecycle_idempotency,
  integration.workflow_lifecycle_rate_limits
FROM PUBLIC;

COMMENT ON TABLE integration.workflow_lifecycle_idempotency IS
  'Tenant/principal/operation-scoped digest and validated replay state for governed workflow lifecycle writes.';
COMMENT ON TABLE audit.workflow_lifecycle_authentication_failures IS
  'Tenantless aggregated authentication failure metadata; never assigns an unverified tenant or stores credentials/request bodies.';

COMMIT;
