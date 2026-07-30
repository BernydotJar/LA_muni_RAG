-- LA Muni RAG
-- Feature 062: immutable tenant-scoped EvidenceGapRequest intake.
--
-- Stores bounded documentary research requests, SHA-256 digests, validated
-- response bytes, and allowlisted audit identities. It stores no raw
-- idempotency key, Bearer credential, source-authority decision, source URL,
-- content artifact, or publication task.

BEGIN;

CREATE TABLE rag.evidence_gap_requests (
  tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  id UUID NOT NULL,
  request_id UUID NOT NULL,
  requester_product TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  subject TEXT NOT NULL,
  missing_document TEXT NOT NULL,
  reason TEXT NOT NULL,
  priority TEXT NOT NULL,
  campaign_reference TEXT NOT NULL,
  request_sha256 BYTEA NOT NULL,
  created_by_principal_id UUID NOT NULL,
  credential_id UUID NOT NULL,
  original_audit_id UUID NOT NULL,
  response_body TEXT NOT NULL,
  response_sha256 BYTEA NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, request_id),
  FOREIGN KEY (created_by_principal_id, tenant_id)
    REFERENCES identity.principals (id, tenant_id) ON DELETE RESTRICT,
  FOREIGN KEY (credential_id, tenant_id)
    REFERENCES identity.api_credentials (id, tenant_id) ON DELETE RESTRICT,
  CHECK (requester_product = 'os_electoral'),
  CHECK (char_length(jurisdiction) BETWEEN 2 AND 240),
  CHECK (char_length(subject) BETWEEN 1 AND 256),
  CHECK (char_length(missing_document) BETWEEN 1 AND 512),
  CHECK (char_length(reason) BETWEEN 1 AND 1000),
  CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CHECK (char_length(campaign_reference) BETWEEN 1 AND 128),
  CHECK (octet_length(request_sha256) = 32),
  CHECK (octet_length(response_sha256) = 32),
  CHECK (response_sha256 = digest(response_body, 'sha256')),
  CHECK (octet_length(response_body) BETWEEN 2 AND 1048576),
  CHECK (status = 'open')
);

CREATE INDEX evidence_gap_requests_created_idx
  ON rag.evidence_gap_requests (tenant_id, created_at DESC, id);
CREATE INDEX evidence_gap_requests_priority_idx
  ON rag.evidence_gap_requests (tenant_id, priority, created_at DESC, id);

CREATE TABLE integration.evidence_gap_idempotency (
  tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  principal_id UUID NOT NULL,
  idempotency_key_sha256 BYTEA NOT NULL CHECK (octet_length(idempotency_key_sha256) = 32),
  request_sha256 BYTEA NOT NULL CHECK (octet_length(request_sha256) = 32),
  state TEXT NOT NULL CHECK (state IN ('processing', 'completed')),
  response_status INTEGER CHECK (response_status = 200),
  response_body TEXT CHECK (
    response_body IS NULL OR octet_length(response_body) BETWEEN 2 AND 1048576
  ),
  response_sha256 BYTEA CHECK (response_sha256 IS NULL OR octet_length(response_sha256) = 32),
  audit_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, principal_id, idempotency_key_sha256),
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
      AND response_sha256 IS NOT NULL
      AND response_sha256 = digest(response_body, 'sha256')
      AND audit_id IS NOT NULL
      AND completed_at IS NOT NULL)
  )
);

CREATE INDEX evidence_gap_idempotency_expiry_idx
  ON integration.evidence_gap_idempotency (expires_at);

CREATE TABLE integration.evidence_gap_rate_limits (
  tenant_id UUID NOT NULL REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  principal_id UUID NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count > 0),
  blocked_audit_id UUID,
  PRIMARY KEY (tenant_id, principal_id, window_started_at),
  FOREIGN KEY (principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE CASCADE
);

CREATE INDEX evidence_gap_rate_limits_cleanup_idx
  ON integration.evidence_gap_rate_limits (window_started_at);

ALTER TABLE rag.evidence_gap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.evidence_gap_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY evidence_gap_requests_tenant_isolation
  ON rag.evidence_gap_requests
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE integration.evidence_gap_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration.evidence_gap_idempotency FORCE ROW LEVEL SECURITY;
CREATE POLICY evidence_gap_idempotency_tenant_isolation
  ON integration.evidence_gap_idempotency
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE integration.evidence_gap_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration.evidence_gap_rate_limits FORCE ROW LEVEL SECURITY;
CREATE POLICY evidence_gap_rate_limits_tenant_isolation
  ON integration.evidence_gap_rate_limits
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

REVOKE ALL ON TABLE
  rag.evidence_gap_requests,
  integration.evidence_gap_idempotency,
  integration.evidence_gap_rate_limits
FROM PUBLIC;

CREATE TABLE audit.evidence_gap_authentication_failures (
  audit_id UUID PRIMARY KEY,
  request_id UUID NOT NULL,
  bucket_started_at TIMESTAMPTZ NOT NULL,
  route TEXT NOT NULL DEFAULT '/api/v1/evidence-gap-requests'
    CHECK (route = '/api/v1/evidence-gap-requests'),
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

CREATE INDEX evidence_gap_authentication_failures_retention_idx
  ON audit.evidence_gap_authentication_failures (created_at);

REVOKE ALL ON TABLE audit.evidence_gap_authentication_failures FROM PUBLIC;

CREATE FUNCTION audit.record_evidence_gap_authentication_failure(
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
    RAISE EXCEPTION 'invalid evidence gap authentication audit reason';
  END IF;

  DELETE FROM audit.evidence_gap_authentication_failures
  WHERE created_at < statement_timestamp() - interval '30 days';

  v_bucket_started_at := date_trunc('minute', statement_timestamp());
  INSERT INTO audit.evidence_gap_authentication_failures (
    audit_id,
    request_id,
    bucket_started_at,
    reason_code
  )
  VALUES (p_audit_id, p_request_id, v_bucket_started_at, p_reason_code)
  ON CONFLICT (bucket_started_at, reason_code)
  DO UPDATE SET
    failure_count = audit.evidence_gap_authentication_failures.failure_count + 1,
    last_seen_at = statement_timestamp()
  RETURNING audit_id INTO v_audit_id;

  RETURN v_audit_id;
END;
$function$;

REVOKE ALL ON FUNCTION
  audit.record_evidence_gap_authentication_failure(UUID, UUID, TEXT)
FROM PUBLIC;

CREATE FUNCTION rag.prevent_evidence_gap_request_mutation_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, rag
AS $function$
BEGIN
  RAISE EXCEPTION 'evidence gap intake records are immutable in v1'
    USING ERRCODE = '55000';
END;
$function$;

REVOKE ALL ON FUNCTION rag.prevent_evidence_gap_request_mutation_v1() FROM PUBLIC;

CREATE TRIGGER evidence_gap_requests_immutable_v1
BEFORE UPDATE OR DELETE ON rag.evidence_gap_requests
FOR EACH ROW
EXECUTE FUNCTION rag.prevent_evidence_gap_request_mutation_v1();

COMMENT ON TABLE rag.evidence_gap_requests IS
  'Immutable LA Muni RAG-owned intake of documentary research gaps requested by OS Electoral; open status does not establish source authority or applicability.';
COMMENT ON COLUMN rag.evidence_gap_requests.response_body IS
  'Exact contract-validated acknowledgement for aggregate-ID replay; never the raw inbound request.';
COMMENT ON COLUMN integration.evidence_gap_idempotency.response_body IS
  'Exact contract-validated acknowledgement for byte-identical idempotent replay; never the raw inbound request.';
COMMENT ON TABLE audit.evidence_gap_authentication_failures IS
  'Sanitized pre-tenant EvidenceGap authentication decisions; never stores credentials, network metadata, headers, or request bodies.';

COMMIT;
