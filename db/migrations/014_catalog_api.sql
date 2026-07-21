-- LA Muni RAG
-- Feature 067: tenant catalog API persistence and safe monitoring state.

BEGIN;

CREATE TABLE rag.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  source_key TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'constitution', 'national_law', 'national_regulation', 'planning',
    'budget', 'organization', 'procedure_manual', 'function_manual',
    'council_record', 'form', 'community_record', 'public_portal', 'other'
  )),
  target_jurisdiction TEXT NOT NULL,
  source_jurisdiction TEXT NOT NULL,
  source_relation TEXT NOT NULL CHECK (source_relation IN ('target', 'national', 'comparative', 'unknown')),
  discovery_status TEXT NOT NULL CHECK (discovery_status IN ('identified', 'access_blocked', 'unverified', 'missing_source')),
  discovery_url TEXT,
  artifact_url TEXT,
  observed_version TEXT,
  publication_date DATE,
  effective_date DATE,
  limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_state TEXT NOT NULL DEFAULT 'unreviewed'
    CHECK (validation_state IN ('unreviewed', 'review_required', 'validated', 'rejected')),
  official_source BOOLEAN NOT NULL DEFAULT false,
  official_for_target_jurisdiction BOOLEAN NOT NULL DEFAULT false,
  acquisition_state TEXT NOT NULL DEFAULT 'not_acquired'
    CHECK (acquisition_state IN ('not_acquired', 'acquisition_pending', 'acquired', 'access_blocked', 'failed')),
  ingestion_state TEXT NOT NULL DEFAULT 'not_ingested'
    CHECK (ingestion_state IN ('not_ingested', 'ingestion_pending', 'ingested', 'failed')),
  retrieval_state TEXT NOT NULL DEFAULT 'not_indexed'
    CHECK (retrieval_state IN ('not_indexed', 'indexing', 'indexed', 'failed')),
  created_by_principal_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (id, tenant_id),
  UNIQUE (tenant_id, source_key),
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  CHECK (source_key ~ '^[a-z0-9][a-z0-9._:-]{2,127}$'),
  CHECK (char_length(title) BETWEEN 1 AND 500 AND title !~ '[[:cntrl:]]'),
  CHECK (char_length(target_jurisdiction) BETWEEN 1 AND 500 AND target_jurisdiction !~ '[[:cntrl:]]'),
  CHECK (char_length(source_jurisdiction) BETWEEN 1 AND 500 AND source_jurisdiction !~ '[[:cntrl:]]'),
  CHECK (discovery_url IS NULL OR (char_length(discovery_url) BETWEEN 8 AND 2048 AND discovery_url ~ '^https?://')),
  CHECK (artifact_url IS NULL OR (char_length(artifact_url) BETWEEN 8 AND 2048 AND artifact_url ~ '^https?://')),
  CHECK (discovery_url IS NULL OR (
    discovery_url !~* '://[^/?#]*@'
    AND discovery_url !~* '[?&](access_token|token|sig|signature|x-amz-[^=&]*|x-goog-[^=&]*|api_key|key|auth|se|sp)='
  )),
  CHECK (artifact_url IS NULL OR (
    artifact_url !~* '://[^/?#]*@'
    AND artifact_url !~* '[?&](access_token|token|sig|signature|x-amz-[^=&]*|x-goog-[^=&]*|api_key|key|auth|se|sp)='
  )),
  CHECK (observed_version IS NULL OR (char_length(observed_version) BETWEEN 1 AND 200 AND observed_version !~ '[[:cntrl:]]')),
  CHECK (jsonb_typeof(limitations) = 'array' AND jsonb_array_length(limitations) <= 16 AND pg_column_size(limitations) <= 16384),
  CHECK (discovery_status <> 'missing_source' OR (discovery_url IS NULL AND artifact_url IS NULL)),
  CHECK (NOT official_for_target_jurisdiction OR official_source),
  CHECK (validation_state = 'validated' OR NOT official_source),
  CHECK (source_relation <> 'comparative' OR NOT official_for_target_jurisdiction),
  CHECK (effective_date IS NULL OR publication_date IS NULL OR effective_date >= publication_date)
);

CREATE INDEX sources_tenant_created_idx
  ON rag.sources (tenant_id, created_at DESC, id DESC);
CREATE INDEX sources_tenant_filters_idx
  ON rag.sources (tenant_id, discovery_status, source_relation, category, created_at DESC);

ALTER TABLE rag.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.sources FORCE ROW LEVEL SECURITY;
CREATE POLICY sources_tenant_isolation ON rag.sources
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE rag.documents
  ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE rag.documents
  ADD COLUMN source_id UUID,
  ADD COLUMN confidentiality TEXT NOT NULL DEFAULT 'internal'
    CHECK (confidentiality IN ('public', 'internal', 'confidential', 'restricted')),
  ADD COLUMN registered_by_principal_id UUID;

ALTER TABLE rag.documents
  ADD CONSTRAINT documents_source_tenant_fk
  FOREIGN KEY (source_id, tenant_id)
  REFERENCES rag.sources(id, tenant_id) ON DELETE RESTRICT;
ALTER TABLE rag.documents
  ADD CONSTRAINT documents_registered_principal_tenant_fk
  FOREIGN KEY (registered_by_principal_id, tenant_id)
  REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT;
ALTER TABLE rag.documents
  ADD CONSTRAINT documents_catalog_registration_shape_chk CHECK (
    (source_id IS NULL AND registered_by_principal_id IS NULL)
    OR
    (source_id IS NOT NULL AND registered_by_principal_id IS NOT NULL)
  );
ALTER TABLE rag.documents
  ADD CONSTRAINT documents_public_source_url_chk CHECK (
    source_url IS NULL OR (
      source_url !~* '://[^/?#]*@'
      AND source_url !~* '[?&](access_token|token|sig|signature|x-amz-[^=&]*|x-goog-[^=&]*|api_key|key|auth|se|sp)='
    )
  );
ALTER TABLE rag.document_versions
  ADD CONSTRAINT document_versions_public_source_url_chk CHECK (
    source_url IS NULL OR (
      source_url !~* '://[^/?#]*@'
      AND source_url !~* '[?&](access_token|token|sig|signature|x-amz-[^=&]*|x-goog-[^=&]*|api_key|key|auth|se|sp)='
    )
  );
CREATE INDEX documents_tenant_source_created_idx
  ON rag.documents (tenant_id, source_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION rag.bind_catalog_document_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
DECLARE
  inherited_official BOOLEAN;
BEGIN
  IF NEW.source_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT source.official_source INTO STRICT inherited_official
  FROM rag.sources source
  WHERE source.tenant_id = NEW.tenant_id AND source.id = NEW.source_id;
  NEW.official_source := inherited_official;
  NEW.status := 'draft'::rag.document_status;
  RETURN NEW;
EXCEPTION WHEN NO_DATA_FOUND THEN
  RAISE EXCEPTION 'catalog source unavailable' USING ERRCODE = '23503';
END;
$function$;

CREATE TRIGGER documents_catalog_source_binding
BEFORE INSERT ON rag.documents
FOR EACH ROW EXECUTE FUNCTION rag.bind_catalog_document_source();

CREATE TABLE rag.catalog_api_idempotency (
  tenant_id UUID NOT NULL,
  principal_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('source_create_v1', 'document_create_v1')),
  idempotency_key_sha256 BYTEA NOT NULL CHECK (octet_length(idempotency_key_sha256) = 32),
  request_sha256 BYTEA NOT NULL CHECK (octet_length(request_sha256) = 32),
  state TEXT NOT NULL DEFAULT 'processing' CHECK (state IN ('processing', 'completed')),
  response_status SMALLINT CHECK (response_status IN (201)),
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
    (state = 'processing' AND response_status IS NULL AND response_body IS NULL
      AND response_sha256 IS NULL AND audit_id IS NULL AND completed_at IS NULL)
    OR
    (state = 'completed' AND response_status IS NOT NULL AND response_body IS NOT NULL
      AND octet_length(response_body) BETWEEN 2 AND 2097152
      AND response_sha256 IS NOT NULL AND audit_id IS NOT NULL AND completed_at IS NOT NULL)
  )
);

CREATE TABLE rag.catalog_api_rate_limits (
  tenant_id UUID NOT NULL,
  principal_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN (
    'source_create_v1', 'source_list_v1', 'document_create_v1', 'document_list_v1',
    'ingestion_job_list_v1', 'procedure_list_v1'
  )),
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1 CHECK (request_count BETWEEN 1 AND 1000000),
  blocked_audit_id UUID,
  PRIMARY KEY (tenant_id, principal_id, operation, window_started_at),
  FOREIGN KEY (tenant_id) REFERENCES identity.tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE CASCADE
);

CREATE INDEX catalog_idempotency_expiry_idx
  ON rag.catalog_api_idempotency (tenant_id, expires_at);
CREATE INDEX catalog_rate_expiry_idx
  ON rag.catalog_api_rate_limits (tenant_id, window_started_at);

ALTER TABLE rag.catalog_api_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.catalog_api_idempotency FORCE ROW LEVEL SECURITY;
CREATE POLICY catalog_api_idempotency_tenant_isolation ON rag.catalog_api_idempotency
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE rag.catalog_api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.catalog_api_rate_limits FORCE ROW LEVEL SECURITY;
CREATE POLICY catalog_api_rate_limits_tenant_isolation ON rag.catalog_api_rate_limits
  FOR ALL USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

CREATE TABLE identity.catalog_auth_failure_buckets (
  window_started_at TIMESTAMPTZ PRIMARY KEY,
  failure_count INTEGER NOT NULL DEFAULT 1 CHECK (failure_count BETWEEN 1 AND 1000000),
  first_audit_id UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp()
);

CREATE OR REPLACE FUNCTION identity.record_catalog_auth_failure(
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
    RAISE EXCEPTION 'invalid catalog authentication audit input';
  END IF;
  INSERT INTO identity.catalog_auth_failure_buckets (
    window_started_at, failure_count, first_audit_id, updated_at
  ) VALUES (
    bucket_start, 1, requested_audit_id, statement_timestamp()
  )
  ON CONFLICT (window_started_at) DO UPDATE
  SET failure_count = LEAST(identity.catalog_auth_failure_buckets.failure_count + 1, 1000000),
      updated_at = statement_timestamp()
  RETURNING first_audit_id INTO selected_audit_id;
  RETURN selected_audit_id;
END;
$function$;

REVOKE ALL ON TABLE
  rag.sources,
  rag.catalog_api_idempotency,
  rag.catalog_api_rate_limits,
  identity.catalog_auth_failure_buckets
FROM PUBLIC;
REVOKE ALL ON FUNCTION identity.record_catalog_auth_failure(UUID, TEXT) FROM PUBLIC;

COMMENT ON TABLE rag.sources IS
  'Tenant source-discovery records. Registration is unreviewed and cannot establish official authority, validity, acquisition, ingestion or retrieval completion.';
COMMENT ON COLUMN rag.sources.artifact_url IS
  'Public discovery URL only; never an object-store coordinate or signed URL.';
COMMENT ON TABLE rag.catalog_api_idempotency IS
  'Digest-only replay state for source and document registration responses.';

COMMIT;
