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
GRANT USAGE ON SCHEMA rag, audit
  TO la_muni_ingestion_runtime_test;
GRANT SELECT ON rag.documents
  TO la_muni_ingestion_runtime_test;
GRANT SELECT, UPDATE ON rag.document_versions
  TO la_muni_ingestion_runtime_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  rag.ingestion_jobs,
  rag.embedding_vectors
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
    WHERE relname IN ('embedding_vectors', 'ingestion_jobs', 'document_versions', 'documents')
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
  IF NOT vector_rls OR NOT vector_force OR NOT jobs_rls OR NOT jobs_force THEN
    RAISE EXCEPTION 'vector and job tables must enable and force RLS';
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
  );
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
COMMIT;

SET ROLE la_muni_ingestion_runtime_test;

DO $gate$
DECLARE
  visible_jobs INTEGER;
  visible_vectors INTEGER;
BEGIN
  SELECT count(*) INTO visible_jobs FROM rag.ingestion_jobs;
  SELECT count(*) INTO visible_vectors FROM rag.embedding_vectors;
  IF visible_jobs <> 0 OR visible_vectors <> 0 THEN
    RAISE EXCEPTION 'missing tenant context exposed ingestion state';
  END IF;

  PERFORM set_config('app.tenant_id', 'malformed-tenant', false);
  SELECT count(*) INTO visible_jobs FROM rag.ingestion_jobs;
  SELECT count(*) INTO visible_vectors FROM rag.embedding_vectors;
  IF visible_jobs <> 0 OR visible_vectors <> 0 THEN
    RAISE EXCEPTION 'malformed tenant context exposed ingestion state';
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

RESET ROLE;

SELECT json_build_object(
  'result', 'tenant_ingestion_sql_gate_passed',
  'postgres_version', current_setting('server_version'),
  'vector_version', extversion
)
FROM pg_extension
WHERE extname = 'vector';
