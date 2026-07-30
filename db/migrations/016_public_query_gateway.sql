BEGIN;

CREATE TABLE rag.public_query_rate_limits (
  tenant_id UUID NOT NULL,
  client_key_sha256 BYTEA NOT NULL CHECK (octet_length(client_key_sha256) = 32),
  operation TEXT NOT NULL CHECK (operation IN ('public_query_client_v1', 'public_query_global_v1')),
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count BETWEEN 1 AND 1000000),
  blocked_audit_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  PRIMARY KEY (tenant_id, client_key_sha256, operation, window_started_at),
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE CASCADE
);

CREATE INDEX public_query_rate_expiry_idx
  ON rag.public_query_rate_limits (tenant_id, window_started_at);

ALTER TABLE rag.public_query_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.public_query_rate_limits FORCE ROW LEVEL SECURITY;

CREATE POLICY public_query_rate_limits_tenant_isolation
  ON rag.public_query_rate_limits
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

REVOKE ALL ON TABLE rag.public_query_rate_limits FROM PUBLIC;

COMMENT ON TABLE rag.public_query_rate_limits IS
  'Tenant-scoped public query global/client HMAC rate buckets. Raw network identity and query text are forbidden.';

COMMIT;
