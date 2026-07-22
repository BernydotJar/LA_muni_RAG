\set ON_ERROR_STOP on

-- Destructive fixtures for the disposable ingestion database only.
DO $gate$
BEGIN
  IF current_database() <> 'la_muni_rag_ingestion_test' THEN
    RAISE EXCEPTION 'tenant ingestion gate requires la_muni_rag_ingestion_test';
  END IF;
END;
$gate$;

CREATE ROLE la_muni_ingestion_runtime_test
  LOGIN
  PASSWORD 'disposable-ingestion-runtime-password-20260719'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOBYPASSRLS;

GRANT CONNECT ON DATABASE la_muni_rag_ingestion_test
  TO la_muni_ingestion_runtime_test;
GRANT USAGE ON SCHEMA identity, rag, audit, integration
  TO la_muni_ingestion_runtime_test;
GRANT EXECUTE ON FUNCTION identity.authenticate_api_credential(BYTEA)
  TO la_muni_ingestion_runtime_test;
GRANT EXECUTE ON FUNCTION audit.record_ingestion_authentication_failure(UUID, UUID, TEXT)
  TO la_muni_ingestion_runtime_test;
GRANT EXECUTE ON FUNCTION rag.lock_valid_artifact_acceptance_v1(UUID, UUID, UUID, TEXT, UUID)
  TO la_muni_ingestion_runtime_test;
GRANT SELECT ON rag.documents
  TO la_muni_ingestion_runtime_test;
GRANT SELECT, UPDATE ON rag.document_versions
  TO la_muni_ingestion_runtime_test;
GRANT SELECT ON rag.artifact_objects, rag.artifact_scans
  TO la_muni_ingestion_runtime_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  rag.ingestion_jobs,
  rag.embedding_vectors,
  integration.ingestion_api_rate_limits
  TO la_muni_ingestion_runtime_test;
GRANT INSERT ON audit.events
  TO la_muni_ingestion_runtime_test;

DO $gate$
DECLARE
  is_super BOOLEAN;
  bypasses_rls BOOLEAN;
  owns_protected BOOLEAN;
  vector_rls BOOLEAN;
  vector_force BOOLEAN;
  jobs_rls BOOLEAN;
  jobs_force BOOLEAN;
  api_rate_rls BOOLEAN;
  api_rate_force BOOLEAN;
  artifact_objects_rls BOOLEAN;
  artifact_objects_force BOOLEAN;
  artifact_scans_rls BOOLEAN;
  artifact_scans_force BOOLEAN;
  vector_write_policy TEXT;
BEGIN
  SELECT rolsuper, rolbypassrls
  INTO is_super, bypasses_rls
  FROM pg_roles
  WHERE rolname = 'la_muni_ingestion_runtime_test';
  IF is_super IS DISTINCT FROM false OR bypasses_rls IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'ingestion runtime role must not bypass RLS';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relname IN (
      'embedding_vectors',
      'ingestion_jobs',
      'ingestion_api_rate_limits',
      'artifact_objects',
      'artifact_scans',
      'document_versions',
      'documents'
    )
      AND pg_get_userbyid(relowner) = 'la_muni_ingestion_runtime_test'
  ) INTO owns_protected;
  IF owns_protected THEN
    RAISE EXCEPTION 'ingestion runtime role owns a protected table';
  END IF;

  SELECT relrowsecurity, relforcerowsecurity
  INTO vector_rls, vector_force
  FROM pg_class
  WHERE oid = 'rag.embedding_vectors'::regclass;
  SELECT relrowsecurity, relforcerowsecurity
  INTO jobs_rls, jobs_force
  FROM pg_class
  WHERE oid = 'rag.ingestion_jobs'::regclass;
  SELECT relrowsecurity, relforcerowsecurity
  INTO api_rate_rls, api_rate_force
  FROM pg_class
  WHERE oid = 'integration.ingestion_api_rate_limits'::regclass;
  SELECT relrowsecurity, relforcerowsecurity
  INTO artifact_objects_rls, artifact_objects_force
  FROM pg_class
  WHERE oid = 'rag.artifact_objects'::regclass;
  SELECT relrowsecurity, relforcerowsecurity
  INTO artifact_scans_rls, artifact_scans_force
  FROM pg_class
  WHERE oid = 'rag.artifact_scans'::regclass;
  IF NOT vector_rls OR NOT vector_force
     OR NOT jobs_rls OR NOT jobs_force
     OR NOT api_rate_rls OR NOT api_rate_force
     OR NOT artifact_objects_rls OR NOT artifact_objects_force
     OR NOT artifact_scans_rls OR NOT artifact_scans_force THEN
    RAISE EXCEPTION 'vector, job, ingestion API rate, and artifact acceptance tables must enable and force RLS';
  END IF;

  SELECT pg_get_expr(polwithcheck, polrelid)
  INTO vector_write_policy
  FROM pg_policy
  WHERE polrelid = 'rag.embedding_vectors'::regclass
    AND polname = 'embedding_vectors_tenant_isolation';
  IF vector_write_policy IS NULL OR position('contract_version = 1' IN vector_write_policy) = 0 THEN
    RAISE EXCEPTION 'vector write policy must reject new legacy-contract rows';
  END IF;
END;
$gate$;

INSERT INTO identity.tenants (id, slug, name)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'ingestion-tenant-a', 'Ingestion tenant A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'ingestion-tenant-b', 'Ingestion tenant B');

INSERT INTO identity.principals (
  id,
  tenant_id,
  principal_kind,
  external_subject,
  display_name
)
VALUES
  (
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'service',
    'ingestion-service-a',
    'Ingestion service A'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'service',
    'ingestion-service-b',
    'Ingestion service B'
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'service',
    'ingestion-viewer-a',
    'Ingestion viewer A'
  );

INSERT INTO identity.memberships (tenant_id, principal_id, role)
VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'document_manager'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'document_manager'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '33333333-3333-4333-8333-333333333333',
    'viewer'
  );

INSERT INTO identity.api_credentials (
  id,
  tenant_id,
  principal_id,
  label,
  secret_sha256
)
VALUES
  (
    '44444444-4444-4444-8444-444444444444',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'Disposable ingestion API credential A',
    digest('disposable-ingestion-tenant-a-api-token-20260719', 'sha256')
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '22222222-2222-4222-8222-222222222222',
    'Disposable ingestion API credential B',
    digest('disposable-ingestion-tenant-b-api-token-20260719', 'sha256')
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '33333333-3333-4333-8333-333333333333',
    'Disposable ingestion viewer credential A',
    digest('disposable-ingestion-viewer-api-token-20260719', 'sha256')
  );

BEGIN;
SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
INSERT INTO rag.municipalities (id, tenant_id, name, department, slug)
VALUES (
  'aaaaaaaa-0000-4000-8000-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Municipalidad A',
  'Sacatepéquez',
  'same-municipality'
);
INSERT INTO rag.documents (
  id,
  tenant_id,
  municipality_id,
  title,
  document_type,
  document_scope,
  source_kind,
  official_source,
  status,
  metadata
)
VALUES (
  'aaaaaaaa-0000-4000-8000-000000000010',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-4000-8000-000000000001',
  'Manual de pruebas A',
  'manual',
  'municipal',
  'official_upload',
  true,
  'active',
  '{"confidentiality":"public","document_key":"runtime-manual"}'::jsonb
);
INSERT INTO rag.document_versions (
  id,
  tenant_id,
  document_id,
  version_label,
  content_sha256,
  extraction_status
)
VALUES
  (
    'aaaaaaaa-0000-4000-8000-000000000101',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-0000-4000-8000-000000000010',
    'runtime-v1',
    repeat('1', 64),
    'queued'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000102',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-0000-4000-8000-000000000010',
    'runtime-retry',
    repeat('2', 64),
    'queued'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000103',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-0000-4000-8000-000000000010',
    'runtime-lease',
    repeat('3', 64),
    'queued'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000104',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-0000-4000-8000-000000000010',
    'runtime-rollback',
    repeat('4', 64),
    'queued'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000105',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-0000-4000-8000-000000000010',
    'runtime-concurrency',
    repeat('5', 64),
    'queued'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000106',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-0000-4000-8000-000000000010',
    'runtime-api-v1',
    repeat('6', 64),
    'queued'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000107',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-0000-4000-8000-000000000010',
    'runtime-api-conflict',
    repeat('7', 64),
    'queued'
  );

INSERT INTO rag.artifact_objects (
  id,
  tenant_id,
  document_version_id,
  registered_by_principal_id,
  store_name,
  object_namespace,
  object_key,
  object_version,
  original_filename,
  declared_media_type,
  expected_sha256,
  inspection_generation,
  status
)
VALUES
  ('aaaaaaaa-1000-4000-8000-000000000101', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000101', '11111111-1111-4111-8111-111111111111', 'fixture_store', 'tenant-a-private', 'versions/a101.pdf', 'generation-0001', 'runtime-a101.pdf', 'application/pdf', decode(repeat('1', 64), 'hex'), 1, 'scanning'),
  ('aaaaaaaa-1000-4000-8000-000000000102', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000102', '11111111-1111-4111-8111-111111111111', 'fixture_store', 'tenant-a-private', 'versions/a102.pdf', 'generation-0001', 'runtime-a102.pdf', 'application/pdf', decode(repeat('2', 64), 'hex'), 1, 'scanning'),
  ('aaaaaaaa-1000-4000-8000-000000000103', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000103', '11111111-1111-4111-8111-111111111111', 'fixture_store', 'tenant-a-private', 'versions/a103.pdf', 'generation-0001', 'runtime-a103.pdf', 'application/pdf', decode(repeat('3', 64), 'hex'), 1, 'scanning'),
  ('aaaaaaaa-1000-4000-8000-000000000104', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000104', '11111111-1111-4111-8111-111111111111', 'fixture_store', 'tenant-a-private', 'versions/a104.pdf', 'generation-0001', 'runtime-a104.pdf', 'application/pdf', decode(repeat('4', 64), 'hex'), 1, 'scanning'),
  ('aaaaaaaa-1000-4000-8000-000000000105', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000105', '11111111-1111-4111-8111-111111111111', 'fixture_store', 'tenant-a-private', 'versions/a105.pdf', 'generation-0001', 'runtime-a105.pdf', 'application/pdf', decode(repeat('5', 64), 'hex'), 1, 'scanning'),
  ('aaaaaaaa-1000-4000-8000-000000000106', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000106', '11111111-1111-4111-8111-111111111111', 'fixture_store', 'tenant-a-private', 'versions/a106.pdf', 'generation-0001', 'runtime-a106.pdf', 'application/pdf', decode(repeat('6', 64), 'hex'), 1, 'scanning'),
  ('aaaaaaaa-1000-4000-8000-000000000107', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000107', '11111111-1111-4111-8111-111111111111', 'fixture_store', 'tenant-a-private', 'versions/a107.pdf', 'generation-0001', 'runtime-a107.pdf', 'application/pdf', decode(repeat('7', 64), 'hex'), 1, 'scanning');

INSERT INTO rag.artifact_scans (
  id,
  tenant_id,
  artifact_object_id,
  inspection_generation,
  inspected_by_principal_id,
  verdict,
  content_sha256,
  byte_length,
  detected_media_type,
  structural_signature,
  inspected_at,
  scanner_engine,
  scanner_engine_version,
  scanner_definitions_version
)
VALUES
  ('aaaaaaaa-2000-4000-8000-000000000101', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-1000-4000-8000-000000000101', 1, '11111111-1111-4111-8111-111111111111', 'clean', decode(repeat('1', 64), 'hex'), 1024, 'application/pdf', 'pdf-1.4', statement_timestamp() - interval '1 minute', 'fixture_scanner', '1.0.0', '20990101.1'),
  ('aaaaaaaa-2000-4000-8000-000000000102', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-1000-4000-8000-000000000102', 1, '11111111-1111-4111-8111-111111111111', 'clean', decode(repeat('2', 64), 'hex'), 1024, 'application/pdf', 'pdf-1.4', statement_timestamp() - interval '1 minute', 'fixture_scanner', '1.0.0', '20990101.1'),
  ('aaaaaaaa-2000-4000-8000-000000000103', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-1000-4000-8000-000000000103', 1, '11111111-1111-4111-8111-111111111111', 'clean', decode(repeat('3', 64), 'hex'), 1024, 'application/pdf', 'pdf-1.4', statement_timestamp() - interval '1 minute', 'fixture_scanner', '1.0.0', '20990101.1'),
  ('aaaaaaaa-2000-4000-8000-000000000104', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-1000-4000-8000-000000000104', 1, '11111111-1111-4111-8111-111111111111', 'clean', decode(repeat('4', 64), 'hex'), 1024, 'application/pdf', 'pdf-1.4', statement_timestamp() - interval '1 minute', 'fixture_scanner', '1.0.0', '20990101.1'),
  ('aaaaaaaa-2000-4000-8000-000000000105', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-1000-4000-8000-000000000105', 1, '11111111-1111-4111-8111-111111111111', 'clean', decode(repeat('5', 64), 'hex'), 1024, 'application/pdf', 'pdf-1.4', statement_timestamp() - interval '1 minute', 'fixture_scanner', '1.0.0', '20990101.1'),
  ('aaaaaaaa-2000-4000-8000-000000000106', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-1000-4000-8000-000000000106', 1, '11111111-1111-4111-8111-111111111111', 'clean', decode(repeat('6', 64), 'hex'), 1024, 'application/pdf', 'pdf-1.4', statement_timestamp() - interval '1 minute', 'fixture_scanner', '1.0.0', '20990101.1'),
  ('aaaaaaaa-2000-4000-8000-000000000107', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-1000-4000-8000-000000000107', 1, '11111111-1111-4111-8111-111111111111', 'clean', decode(repeat('7', 64), 'hex'), 1024, 'application/pdf', 'pdf-1.4', statement_timestamp() - interval '1 minute', 'fixture_scanner', '1.0.0', '20990101.1');

UPDATE rag.artifact_objects AS object
SET status = 'accepted',
    accepted_scan_id = scan.id,
    accepted_until = statement_timestamp() + interval '1 day',
    updated_at = statement_timestamp()
FROM rag.artifact_scans AS scan
WHERE object.tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
  AND scan.tenant_id = object.tenant_id
  AND scan.artifact_object_id = object.id
  AND scan.inspection_generation = object.inspection_generation;
COMMIT;

BEGIN;
SELECT set_config('app.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
INSERT INTO rag.municipalities (id, tenant_id, name, department, slug)
VALUES (
  'bbbbbbbb-0000-4000-8000-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Municipalidad B',
  'Sacatepéquez',
  'same-municipality'
);
INSERT INTO rag.documents (
  id,
  tenant_id,
  municipality_id,
  title,
  document_type,
  document_scope,
  source_kind,
  official_source,
  status,
  metadata
)
VALUES (
  'bbbbbbbb-0000-4000-8000-000000000010',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bbbbbbbb-0000-4000-8000-000000000001',
  'TENANT_B_SECRET_MARKER',
  'manual',
  'municipal',
  'official_upload',
  true,
  'active',
  '{"confidentiality":"public","document_key":"runtime-manual"}'::jsonb
);
INSERT INTO rag.document_versions (
  id,
  tenant_id,
  document_id,
  version_label,
  content_sha256,
  extraction_status
)
VALUES (
  'bbbbbbbb-0000-4000-8000-000000000101',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bbbbbbbb-0000-4000-8000-000000000010',
  'runtime-v1',
  repeat('1', 64),
  'queued'
);

INSERT INTO rag.artifact_objects (
  id,
  tenant_id,
  document_version_id,
  registered_by_principal_id,
  store_name,
  object_namespace,
  object_key,
  object_version,
  original_filename,
  declared_media_type,
  expected_sha256,
  inspection_generation,
  status
)
VALUES (
  'bbbbbbbb-1000-4000-8000-000000000101',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bbbbbbbb-0000-4000-8000-000000000101',
  '22222222-2222-4222-8222-222222222222',
  'fixture_store',
  'tenant-b-private',
  'versions/b101.pdf',
  'generation-0001',
  'runtime-b101.pdf',
  'application/pdf',
  decode(repeat('1', 64), 'hex'),
  1,
  'scanning'
);

INSERT INTO rag.artifact_scans (
  id,
  tenant_id,
  artifact_object_id,
  inspection_generation,
  inspected_by_principal_id,
  verdict,
  content_sha256,
  byte_length,
  detected_media_type,
  structural_signature,
  inspected_at,
  scanner_engine,
  scanner_engine_version,
  scanner_definitions_version
)
VALUES (
  'bbbbbbbb-2000-4000-8000-000000000101',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'bbbbbbbb-1000-4000-8000-000000000101',
  1,
  '22222222-2222-4222-8222-222222222222',
  'clean',
  decode(repeat('1', 64), 'hex'),
  1024,
  'application/pdf',
  'pdf-1.4',
  statement_timestamp() - interval '1 minute',
  'fixture_scanner',
  '1.0.0',
  '20990101.1'
);

UPDATE rag.artifact_objects AS object
SET status = 'accepted',
    accepted_scan_id = scan.id,
    accepted_until = statement_timestamp() + interval '1 day',
    updated_at = statement_timestamp()
FROM rag.artifact_scans AS scan
WHERE object.tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid
  AND scan.tenant_id = object.tenant_id
  AND scan.artifact_object_id = object.id
  AND scan.inspection_generation = object.inspection_generation;
COMMIT;

SET ROLE la_muni_ingestion_runtime_test;

DO $gate$
DECLARE
  visible_jobs INTEGER;
  visible_vectors INTEGER;
  visible_api_rates INTEGER;
  visible_artifact_objects INTEGER;
  visible_artifact_scans INTEGER;
BEGIN
  SELECT count(*) INTO visible_jobs FROM rag.ingestion_jobs;
  SELECT count(*) INTO visible_vectors FROM rag.embedding_vectors;
  SELECT count(*) INTO visible_api_rates FROM integration.ingestion_api_rate_limits;
  SELECT count(*) INTO visible_artifact_objects FROM rag.artifact_objects;
  SELECT count(*) INTO visible_artifact_scans FROM rag.artifact_scans;
  IF visible_jobs <> 0
     OR visible_vectors <> 0
     OR visible_api_rates <> 0
     OR visible_artifact_objects <> 0
     OR visible_artifact_scans <> 0 THEN
    RAISE EXCEPTION 'missing tenant context exposed ingestion state';
  END IF;

  PERFORM set_config('app.tenant_id', 'malformed-tenant', false);
  SELECT count(*) INTO visible_jobs FROM rag.ingestion_jobs;
  SELECT count(*) INTO visible_vectors FROM rag.embedding_vectors;
  SELECT count(*) INTO visible_api_rates FROM integration.ingestion_api_rate_limits;
  SELECT count(*) INTO visible_artifact_objects FROM rag.artifact_objects;
  SELECT count(*) INTO visible_artifact_scans FROM rag.artifact_scans;
  IF visible_jobs <> 0
     OR visible_vectors <> 0
     OR visible_api_rates <> 0
     OR visible_artifact_objects <> 0
     OR visible_artifact_scans <> 0 THEN
    RAISE EXCEPTION 'malformed tenant context exposed ingestion state';
  END IF;
  RESET app.tenant_id;

  PERFORM set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', false);
  SELECT count(*) INTO visible_artifact_objects FROM rag.artifact_objects;
  SELECT count(*) INTO visible_artifact_scans FROM rag.artifact_scans;
  IF visible_artifact_objects <> 7 OR visible_artifact_scans <> 7 THEN
    RAISE EXCEPTION 'tenant A artifact acceptance evidence leaked or was incomplete';
  END IF;
  RESET app.tenant_id;

  PERFORM set_config('app.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', false);
  SELECT count(*) INTO visible_artifact_objects FROM rag.artifact_objects;
  SELECT count(*) INTO visible_artifact_scans FROM rag.artifact_scans;
  IF visible_artifact_objects <> 1 OR visible_artifact_scans <> 1 THEN
    RAISE EXCEPTION 'tenant B artifact acceptance evidence leaked or was incomplete';
  END IF;
  RESET app.tenant_id;
END;
$gate$;

DO $gate$
BEGIN
  BEGIN
    INSERT INTO rag.ingestion_jobs (
      id,
      tenant_id,
      document_version_id,
      status,
      job_type,
      requested_by_principal_id,
      contract_version,
      idempotency_key_sha256,
      request_sha256,
      artifact_sha256,
      pipeline_config_sha256,
      work_sha256,
      pipeline_config
    ) VALUES (
      'aaaaaaaa-0000-4000-8000-000000000999',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'aaaaaaaa-0000-4000-8000-000000000101',
      'queued',
      'document_vector_index_v1',
      '11111111-1111-4111-8111-111111111111',
      1,
      digest('missing-context-key', 'sha256'),
      digest('missing-context-request', 'sha256'),
      digest('missing-context-artifact', 'sha256'),
      digest('missing-context-config', 'sha256'),
      digest('missing-context-work', 'sha256'),
      '{"contract_version":"v1","extractor":{"name":"test","version":"1"},"chunk_planner":{"name":"section_text_v1","max_chars":1800,"overlap_chars":180},"embedding":{"provider":"test-provider","model":"test-model-v1","dimension":1536}}'::jsonb
    );
    RAISE EXCEPTION 'missing tenant context unexpectedly wrote an ingestion job';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$gate$;

DO $gate$
BEGIN
  BEGIN
    PERFORM 1 FROM audit.ingestion_authentication_failures;
    RAISE EXCEPTION 'runtime role unexpectedly read ingestion authentication failure storage';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$gate$;

DO $gate$
DECLARE
  authenticated_tenant UUID;
BEGIN
  SELECT tenant_id
  INTO authenticated_tenant
  FROM identity.authenticate_api_credential(
    digest('disposable-ingestion-tenant-a-api-token-20260719', 'sha256')
  );
  IF authenticated_tenant IS DISTINCT FROM 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid THEN
    RAISE EXCEPTION 'ingestion credential authentication returned the wrong tenant';
  END IF;
END;
$gate$;

DO $gate$
DECLARE
  first_audit UUID;
  repeated_audit UUID;
BEGIN
  SELECT audit.record_ingestion_authentication_failure(
    '77777777-7777-4777-8777-777777777777',
    '88888888-8888-4888-8888-888888888888',
    'credential_rejected'
  ) INTO first_audit;
  SELECT audit.record_ingestion_authentication_failure(
    '99999999-9999-4999-8999-999999999999',
    'aaaaaaaa-1111-4111-8111-111111111111',
    'credential_rejected'
  ) INTO repeated_audit;
  IF first_audit IS DISTINCT FROM repeated_audit THEN
    RAISE EXCEPTION 'ingestion authentication failures did not aggregate by minute and reason';
  END IF;
END;
$gate$;

BEGIN;
SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
DO $gate$
BEGIN
  BEGIN
    INSERT INTO integration.ingestion_api_rate_limits (
      tenant_id,
      principal_id,
      operation,
      window_started_at,
      request_count
    ) VALUES (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '22222222-2222-4222-8222-222222222222',
      'ingestion_job_enqueue_v1',
      date_trunc('minute', statement_timestamp()),
      1
    );
    RAISE EXCEPTION 'tenant A unexpectedly inserted tenant B ingestion API rate state';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$gate$;
COMMIT;

RESET ROLE;

DO $gate$
DECLARE
  aggregate_count BIGINT;
BEGIN
  SELECT failure_count
  INTO aggregate_count
  FROM audit.ingestion_authentication_failures
  WHERE audit_id = '77777777-7777-4777-8777-777777777777';
  IF aggregate_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'expected ingestion authentication failure aggregate count 2, found %', aggregate_count;
  END IF;
END;
$gate$;

SELECT json_build_object(
  'result', 'tenant_ingestion_sql_gate_passed',
  'postgres_version', current_setting('server_version'),
  'vector_version', extversion,
  'controlledArtifactsRead', 0
)
FROM pg_extension
WHERE extname = 'vector';
