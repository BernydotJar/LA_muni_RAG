-- LA Muni RAG
-- WS-03 persisted immutable artifact and malware-scan acceptance boundary.
--
-- This migration deliberately stores opaque object coordinates, never a URL,
-- signed request, credential, or artifact body. A separately approved storage
-- adapter remains responsible for reading the exact immutable generation.

BEGIN;

CREATE TABLE rag.artifact_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  document_version_id UUID NOT NULL,
  registered_by_principal_id UUID NOT NULL,
  store_name TEXT NOT NULL,
  object_namespace TEXT NOT NULL,
  object_key TEXT NOT NULL,
  object_version TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  declared_media_type TEXT NOT NULL,
  expected_sha256 BYTEA NOT NULL CHECK (octet_length(expected_sha256) = 32),
  inspection_generation INTEGER NOT NULL DEFAULT 1
    CHECK (inspection_generation BETWEEN 1 AND 2147483647),
  status TEXT NOT NULL DEFAULT 'scanning'
    CHECK (status IN ('scanning', 'accepted', 'rejected', 'superseded')),
  accepted_scan_id UUID,
  accepted_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (id, tenant_id),
  UNIQUE (id, tenant_id, document_version_id),
  UNIQUE (tenant_id, store_name, object_namespace, object_key, object_version),
  FOREIGN KEY (tenant_id)
    REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  FOREIGN KEY (document_version_id, tenant_id)
    REFERENCES rag.document_versions(id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (registered_by_principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  CHECK (char_length(store_name) BETWEEN 1 AND 80
    AND store_name ~ '^[a-z][a-z0-9_-]*$'),
  CHECK (char_length(object_namespace) BETWEEN 1 AND 255
    AND object_namespace !~ '[[:cntrl:]]'
    AND object_namespace !~ '^[A-Za-z][A-Za-z0-9+.-]*://'),
  CHECK (char_length(object_key) BETWEEN 1 AND 1024
    AND object_key !~ '[[:cntrl:]]'
    AND object_key !~ '^[A-Za-z][A-Za-z0-9+.-]*://'),
  CHECK (char_length(object_version) BETWEEN 1 AND 256
    AND object_version ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'),
  CHECK (char_length(original_filename) BETWEEN 1 AND 255
    AND original_filename !~ '[[:cntrl:]/\\]'),
  CHECK (declared_media_type IN (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  )),
  CHECK (
    (status = 'accepted' AND accepted_scan_id IS NOT NULL AND accepted_until IS NOT NULL)
    OR
    (status <> 'accepted' AND accepted_scan_id IS NULL AND accepted_until IS NULL)
  )
);

CREATE TABLE rag.artifact_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  artifact_object_id UUID NOT NULL,
  inspection_generation INTEGER NOT NULL
    CHECK (inspection_generation BETWEEN 1 AND 2147483647),
  inspected_by_principal_id UUID NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('clean', 'infected', 'rejected', 'error')),
  content_sha256 BYTEA CHECK (content_sha256 IS NULL OR octet_length(content_sha256) = 32),
  byte_length BIGINT CHECK (byte_length IS NULL OR byte_length BETWEEN 1 AND 1073741824),
  detected_media_type TEXT,
  structural_signature TEXT,
  inspected_at TIMESTAMPTZ NOT NULL,
  scanner_engine TEXT NOT NULL,
  scanner_engine_version TEXT NOT NULL,
  scanner_definitions_version TEXT,
  malware_signature TEXT,
  failure_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (id, tenant_id),
  UNIQUE (id, tenant_id, artifact_object_id),
  UNIQUE (tenant_id, artifact_object_id, inspection_generation),
  FOREIGN KEY (tenant_id)
    REFERENCES identity.tenants(id) ON DELETE RESTRICT,
  FOREIGN KEY (artifact_object_id, tenant_id)
    REFERENCES rag.artifact_objects(id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (inspected_by_principal_id, tenant_id)
    REFERENCES identity.principals(id, tenant_id) ON DELETE RESTRICT,
  CHECK (detected_media_type IS NULL OR (
    char_length(detected_media_type) BETWEEN 1 AND 256
    AND detected_media_type !~ '[[:cntrl:]]'
  )),
  CHECK (structural_signature IS NULL OR structural_signature ~ '^[A-Za-z0-9][A-Za-z0-9._:+/-]{0,159}$'),
  CHECK (scanner_engine ~ '^[A-Za-z0-9][A-Za-z0-9._:+/-]{0,159}$'),
  CHECK (scanner_engine_version ~ '^[A-Za-z0-9][A-Za-z0-9._:+/-]{0,159}$'),
  CHECK (scanner_definitions_version IS NULL
    OR scanner_definitions_version ~ '^[A-Za-z0-9][A-Za-z0-9._:+/-]{0,159}$'),
  CHECK (malware_signature IS NULL OR (
    char_length(malware_signature) BETWEEN 1 AND 256
    AND malware_signature !~ '[[:cntrl:]]'
  )),
  CHECK (failure_code IS NULL OR failure_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  CHECK (
    (verdict = 'clean'
      AND content_sha256 IS NOT NULL
      AND byte_length IS NOT NULL
      AND detected_media_type IS NOT NULL
      AND structural_signature IS NOT NULL
      AND scanner_definitions_version IS NOT NULL
      AND malware_signature IS NULL
      AND failure_code IS NULL)
    OR
    (verdict = 'infected'
      AND content_sha256 IS NOT NULL
      AND byte_length IS NOT NULL
      AND detected_media_type IS NOT NULL
      AND structural_signature IS NOT NULL
      AND scanner_definitions_version IS NOT NULL
      AND malware_signature IS NOT NULL
      AND failure_code = 'malware_detected')
    OR
    (verdict IN ('rejected', 'error') AND failure_code IS NOT NULL)
  )
);

ALTER TABLE rag.artifact_objects
  ADD CONSTRAINT artifact_objects_accepted_scan_fk
  FOREIGN KEY (accepted_scan_id, tenant_id, id)
  REFERENCES rag.artifact_scans(id, tenant_id, artifact_object_id)
  ON DELETE RESTRICT;

CREATE UNIQUE INDEX artifact_objects_active_document_version_idx
  ON rag.artifact_objects (tenant_id, document_version_id)
  WHERE status = 'accepted';
CREATE INDEX artifact_objects_resolution_idx
  ON rag.artifact_objects (tenant_id, document_version_id, status, accepted_until);
CREATE INDEX artifact_scans_object_idx
  ON rag.artifact_scans (tenant_id, artifact_object_id, inspected_at DESC);

ALTER TABLE rag.artifact_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.artifact_objects FORCE ROW LEVEL SECURITY;
CREATE POLICY artifact_objects_tenant_isolation ON rag.artifact_objects
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

ALTER TABLE rag.artifact_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag.artifact_scans FORCE ROW LEVEL SECURITY;
CREATE POLICY artifact_scans_tenant_isolation ON rag.artifact_scans
  FOR ALL
  USING (tenant_id = identity.current_tenant_id())
  WITH CHECK (tenant_id = identity.current_tenant_id());

REVOKE ALL ON TABLE rag.artifact_objects, rag.artifact_scans FROM PUBLIC;

ALTER TABLE rag.ingestion_jobs
  ADD COLUMN artifact_object_id UUID,
  ADD COLUMN artifact_scan_id UUID;

ALTER TABLE rag.ingestion_jobs
  ADD CONSTRAINT ingestion_jobs_artifact_object_fk
  FOREIGN KEY (artifact_object_id, tenant_id, document_version_id)
  REFERENCES rag.artifact_objects(id, tenant_id, document_version_id)
  ON DELETE RESTRICT;
ALTER TABLE rag.ingestion_jobs
  ADD CONSTRAINT ingestion_jobs_artifact_scan_fk
  FOREIGN KEY (artifact_scan_id, tenant_id, artifact_object_id)
  REFERENCES rag.artifact_scans(id, tenant_id, artifact_object_id)
  ON DELETE RESTRICT;
ALTER TABLE rag.ingestion_jobs
  ADD CONSTRAINT ingestion_jobs_artifact_binding_chk CHECK (
    job_type <> 'document_vector_index_v1'
    OR contract_version = 0
    OR status = 'queued'
    OR (artifact_object_id IS NOT NULL AND artifact_scan_id IS NOT NULL)
  ) NOT VALID;

CREATE INDEX ingestion_jobs_artifact_binding_idx
  ON rag.ingestion_jobs (tenant_id, artifact_object_id, artifact_scan_id)
  WHERE job_type = 'document_vector_index_v1';

COMMENT ON TABLE rag.artifact_objects IS
  'Tenant-owned opaque coordinates for an immutable object generation; never stores artifact bytes, URLs, signed requests, or credentials.';
COMMENT ON TABLE rag.artifact_scans IS
  'Append-only bounded structural and malware-scan outcomes for an exact artifact object inspection generation.';
COMMENT ON COLUMN rag.artifact_objects.object_version IS
  'Required immutable provider generation/version. Mutable latest aliases are forbidden by the runtime adapter contract.';
COMMENT ON COLUMN rag.ingestion_jobs.artifact_scan_id IS
  'Exact persisted clean scan bound at lease time and revalidated atomically before vector publication.';

COMMIT;
