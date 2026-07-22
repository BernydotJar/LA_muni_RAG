\set ON_ERROR_STOP on

DO $gate$
BEGIN
  IF current_database() NOT IN ('la_muni_rag_test', 'la_muni_rag_catalog_test') THEN
    RAISE EXCEPTION 'catalog API gate requires a disposable catalog test database';
  END IF;
END;
$gate$;

GRANT CONNECT ON DATABASE la_muni_rag_test TO la_muni_runtime_test;
GRANT USAGE ON SCHEMA identity, rag, audit TO la_muni_runtime_test;
GRANT EXECUTE ON FUNCTION identity.authenticate_api_credential(BYTEA) TO la_muni_runtime_test;
GRANT EXECUTE ON FUNCTION identity.record_catalog_auth_failure(UUID, TEXT) TO la_muni_runtime_test;

GRANT SELECT ON rag.sources TO la_muni_runtime_test;
GRANT INSERT (
  id, tenant_id, source_key, title, category, target_jurisdiction,
  source_jurisdiction, source_relation, discovery_status, discovery_url,
  artifact_url, observed_version, publication_date, effective_date,
  limitations, created_by_principal_id, created_at, updated_at
) ON rag.sources TO la_muni_runtime_test;

GRANT SELECT (
  id, tenant_id, source_id, title, document_type, document_scope,
  issuing_authority, status, confidentiality, registered_by_principal_id,
  created_at, updated_at
) ON rag.documents TO la_muni_runtime_test;
GRANT INSERT (
  id, tenant_id, source_id, title, document_type, document_scope,
  issuing_authority, source_kind, source_url, confidentiality,
  registered_by_principal_id, created_at, updated_at
) ON rag.documents TO la_muni_runtime_test;

GRANT SELECT (
  id, tenant_id, document_id, version_label, source_url, original_filename,
  mime_type, content_sha256, page_count, extraction_status, created_at
) ON rag.document_versions TO la_muni_runtime_test;
GRANT INSERT (
  id, tenant_id, document_id, version_label, source_url, original_filename,
  mime_type, content_sha256, page_count, created_at
) ON rag.document_versions TO la_muni_runtime_test;

GRANT SELECT (
  id, tenant_id, document_version_id, status, accepted_scan_id,
  accepted_until, updated_at
) ON rag.artifact_objects TO la_muni_runtime_test;
GRANT SELECT (
  tenant_id, document_version_id
) ON rag.embedding_vectors TO la_muni_runtime_test;
GRANT SELECT (
  tenant_id, id, document_version_id, status, attempt_count, max_attempts,
  available_at, started_at, finished_at, last_error_code,
  last_error_retryable, created_at, updated_at
) ON rag.ingestion_jobs TO la_muni_runtime_test;
GRANT SELECT (
  tenant_id, id, procedure_key, title, jurisdiction, created_at, updated_at
) ON rag.procedures TO la_muni_runtime_test;
GRANT SELECT (
  tenant_id, id, procedure_id, version_number, lifecycle_status
) ON rag.procedure_versions TO la_muni_runtime_test;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  rag.catalog_api_idempotency,
  rag.catalog_api_rate_limits
TO la_muni_runtime_test;
GRANT INSERT (
  id, tenant_id, actor_external_id, event_type, entity_schema, entity_table,
  entity_id, outcome, details, created_at
) ON audit.events TO la_muni_runtime_test;

INSERT INTO identity.tenants (id, slug, name)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'catalog-tenant-a', 'Catalog tenant A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'catalog-tenant-b', 'Catalog tenant B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO identity.principals (
  id, tenant_id, principal_kind, external_subject, display_name
)
VALUES
  ('31313131-3131-4313-8313-313131313131', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'user', 'catalog-manager-a', 'Catalog manager A'),
  ('32323232-3232-4323-8323-323232323232', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'user', 'catalog-manager-b', 'Catalog manager B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO identity.memberships (tenant_id, principal_id, role)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '31313131-3131-4313-8313-313131313131', 'document_manager'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '32323232-3232-4323-8323-323232323232', 'document_manager')
ON CONFLICT DO NOTHING;

INSERT INTO identity.api_credentials (
  id, tenant_id, principal_id, label, secret_sha256
)
VALUES
  ('33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '31313131-3131-4313-8313-313131313131', 'Disposable catalog manager A', digest('catalog-manager-a-token-20260721-000000000001', 'sha256')),
  ('34343434-3434-4343-8343-343434343434', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '32323232-3232-4323-8323-323232323232', 'Disposable catalog manager B', digest('catalog-manager-b-token-20260721-000000000001', 'sha256'))
ON CONFLICT (id) DO NOTHING;

INSERT INTO identity.principals (
  id, tenant_id, principal_kind, external_subject, display_name
) VALUES
  ('c1000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'user', 'catalog-platform-admin-a', 'Catalog platform admin A'),
  ('c1000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'user', 'catalog-tenant-admin-a', 'Catalog tenant admin A')
ON CONFLICT (id) DO NOTHING;

INSERT INTO identity.memberships (tenant_id, principal_id, role) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-000000000001', 'platform_admin'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-000000000002', 'tenant_admin')
ON CONFLICT DO NOTHING;

INSERT INTO identity.api_credentials (
  id, tenant_id, principal_id, label, secret_sha256
) VALUES
  ('c2000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-000000000001', 'Disposable catalog platform admin A', digest('catalog-platform-admin-a-token-20260722-0001', 'sha256')),
  ('c2000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1000000-0000-4000-8000-000000000002', 'Disposable catalog tenant admin A', digest('catalog-tenant-admin-a-token-20260722-00001', 'sha256'))
ON CONFLICT (id) DO NOTHING;

INSERT INTO rag.procedures (
  id, tenant_id, procedure_key, title, jurisdiction, created_by_principal_id
)
VALUES
  ('41414141-4141-4414-8414-414141414141', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'catalog.water.a', 'Catalog water procedure A', 'Municipio de La Antigua Guatemala, Sacatepequez, Guatemala', '31313131-3131-4313-8313-313131313131'),
  ('42424242-4242-4424-8424-424242424242', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'catalog.water.b', 'TENANT_B_PRIVATE_PROCEDURE', 'Other tenant', '32323232-3232-4323-8323-323232323232')
ON CONFLICT (id) DO NOTHING;

DO $gate$
DECLARE
  protected_table REGCLASS;
  enabled BOOLEAN;
  forced BOOLEAN;
BEGIN
  IF (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = 'la_muni_runtime_test') THEN
    RAISE EXCEPTION 'catalog runtime role must not bypass RLS';
  END IF;
  FOREACH protected_table IN ARRAY ARRAY[
    'rag.sources'::regclass,
    'rag.documents'::regclass,
    'rag.document_versions'::regclass,
    'rag.ingestion_jobs'::regclass,
    'rag.procedures'::regclass,
    'rag.procedure_versions'::regclass,
    'rag.catalog_api_idempotency'::regclass,
    'rag.catalog_api_rate_limits'::regclass
  ] LOOP
    SELECT relrowsecurity, relforcerowsecurity INTO enabled, forced
    FROM pg_class WHERE oid = protected_table;
    IF enabled IS DISTINCT FROM true OR forced IS DISTINCT FROM true THEN
      RAISE EXCEPTION '% must enable and force RLS', protected_table;
    END IF;
    IF pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = protected_table)) = 'la_muni_runtime_test' THEN
      RAISE EXCEPTION 'catalog runtime role owns protected table %', protected_table;
    END IF;
  END LOOP;

  IF has_column_privilege('la_muni_runtime_test', 'rag.sources', 'official_source', 'INSERT')
     OR has_column_privilege('la_muni_runtime_test', 'rag.sources', 'validation_state', 'INSERT')
     OR has_column_privilege('la_muni_runtime_test', 'rag.sources', 'acquisition_state', 'INSERT')
     OR has_column_privilege('la_muni_runtime_test', 'rag.documents', 'official_source', 'INSERT')
     OR has_column_privilege('la_muni_runtime_test', 'rag.document_versions', 'extraction_status', 'INSERT')
     OR has_column_privilege('la_muni_runtime_test', 'rag.artifact_objects', 'object_key', 'SELECT')
     OR has_column_privilege('la_muni_runtime_test', 'rag.artifact_objects', 'object_namespace', 'SELECT')
     OR has_table_privilege('la_muni_runtime_test', 'rag.sources', 'UPDATE')
     OR has_table_privilege('la_muni_runtime_test', 'rag.sources', 'DELETE') THEN
    RAISE EXCEPTION 'catalog runtime privileges can promote authority or expose private state';
  END IF;
END;
$gate$;

SET ROLE la_muni_runtime_test;

DO $gate$
DECLARE visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM rag.sources;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'missing tenant context exposed sources';
  END IF;
  SELECT count(*) INTO visible_count FROM rag.procedures;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'missing tenant context exposed procedures';
  END IF;
END;
$gate$;

BEGIN;
SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

DO $gate$
BEGIN
  BEGIN
    INSERT INTO rag.sources (
      id, tenant_id, source_key, title, category, target_jurisdiction,
      source_jurisdiction, source_relation, discovery_status, discovery_url,
      artifact_url, observed_version, limitations, created_by_principal_id
    ) VALUES (
      '47474747-4747-4474-8474-474747474747',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'signed-url-must-fail',
      'Signed URL must fail',
      'procedure_manual',
      'Municipio de La Antigua Guatemala, Sacatepequez, Guatemala',
      'Municipio de Mixco, Guatemala',
      'comparative',
      'identified',
      'https://example.test/manual.pdf?sig=temporary-secret',
      NULL,
      'temporary',
      '[]'::jsonb,
      '31313131-3131-4313-8313-313131313131'
    );
    RAISE EXCEPTION 'signed source URL unexpectedly persisted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END;
$gate$;

INSERT INTO rag.sources (
  id, tenant_id, source_key, title, category, target_jurisdiction,
  source_jurisdiction, source_relation, discovery_status, discovery_url,
  artifact_url, observed_version, publication_date, effective_date,
  limitations, created_by_principal_id, created_at, updated_at
)
VALUES (
  '43434343-4343-4434-8434-434343434343',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'catalog-source-a',
  'Catalog source A',
  'procedure_manual',
  'Municipio de La Antigua Guatemala, Sacatepequez, Guatemala',
  'Municipio de Mixco, Guatemala',
  'comparative',
  'identified',
  'https://www2.munimixco.gob.gt/manual.pdf',
  NULL,
  'discovery-1',
  NULL,
  NULL,
  '["Referencia comparativa pendiente de corroboracion."]'::jsonb,
  '31313131-3131-4313-8313-313131313131',
  '2026-07-21T23:00:00Z',
  '2026-07-21T23:00:00Z'
);

INSERT INTO rag.documents (
  id, tenant_id, source_id, title, document_type, document_scope,
  issuing_authority, source_kind, source_url, confidentiality,
  registered_by_principal_id, created_at, updated_at
)
VALUES (
  '44444444-4444-4444-8444-444444444444',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '43434343-4343-4434-8434-434343434343',
  'Catalog document A',
  'manual',
  'municipal',
  'Municipalidad de Mixco',
  'unknown',
  'https://www2.munimixco.gob.gt/manual.pdf',
  'public',
  '31313131-3131-4313-8313-313131313131',
  '2026-07-21T23:00:00Z',
  '2026-07-21T23:00:00Z'
);

INSERT INTO rag.document_versions (
  id, tenant_id, document_id, version_label, source_url, original_filename,
  mime_type, content_sha256, page_count, created_at
)
VALUES (
  '45454545-4545-4454-8454-454545454545',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '44444444-4444-4444-8444-444444444444',
  'discovery-1',
  'https://www2.munimixco.gob.gt/manual.pdf',
  'manual.pdf',
  'application/pdf',
  repeat('a', 64),
  NULL,
  '2026-07-21T23:00:00Z'
);

DO $gate$
DECLARE source_count INTEGER; document_count INTEGER; procedure_count INTEGER;
BEGIN
  SELECT count(*) INTO source_count FROM rag.sources;
  SELECT count(*) INTO document_count FROM rag.documents WHERE source_id IS NOT NULL;
  SELECT count(*) INTO procedure_count FROM rag.procedures;
  IF source_count <> 1 OR document_count <> 1 OR procedure_count <> 1 THEN
    RAISE EXCEPTION 'tenant A catalog visibility failed: %, %, %', source_count, document_count, procedure_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM rag.sources
    WHERE official_source OR official_for_target_jurisdiction
      OR validation_state <> 'unreviewed'
      OR acquisition_state <> 'not_acquired'
      OR ingestion_state <> 'not_ingested'
      OR retrieval_state <> 'not_indexed'
  ) THEN
    RAISE EXCEPTION 'catalog registration promoted source authority or processing state';
  END IF;
  IF EXISTS (
    SELECT 1 FROM rag.documents d
    JOIN rag.document_versions v
      ON v.tenant_id = d.tenant_id AND v.document_id = d.id
    WHERE d.source_id IS NOT NULL
      AND (d.status <> 'draft' OR v.extraction_status <> 'queued')
  ) THEN
    RAISE EXCEPTION 'catalog registration promoted document or extraction state';
  END IF;
END;
$gate$;
COMMIT;

BEGIN;
SELECT set_config('app.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
DO $gate$
DECLARE visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM rag.sources WHERE id = '43434343-4343-4434-8434-434343434343';
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'tenant B observed tenant A source';
  END IF;
  SELECT count(*) INTO visible_count FROM rag.documents WHERE id = '44444444-4444-4444-8444-444444444444';
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'tenant B observed tenant A document';
  END IF;
  SELECT count(*) INTO visible_count FROM rag.procedures WHERE title = 'Catalog water procedure A';
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'tenant B observed tenant A procedure';
  END IF;
END;
$gate$;
ROLLBACK;

RESET ROLE;

INSERT INTO rag.ingestion_jobs (
  id, tenant_id, document_version_id, status, job_type, requested_by,
  attempt_count, max_attempts, available_at, last_error_code,
  last_error_retryable, created_at, updated_at
)
VALUES (
  '46464646-4646-4464-8464-464646464646',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '45454545-4545-4454-8454-454545454545',
  'queued',
  'catalog_monitor_fixture',
  'catalog-gate',
  1,
  3,
  '2099-01-01T00:00:00Z',
  'dependency_retry',
  true,
  '2026-07-21T22:50:00Z',
  '2026-07-21T22:55:00Z'
)
ON CONFLICT (id) DO NOTHING;

SELECT json_build_object(
  'result', 'catalog_api_sql_gate_passed',
  'postgres_version', current_setting('server_version'),
  'runtime_role_super_or_bypass', (
    SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = 'la_muni_runtime_test'
  ),
  'source_authority_promoted', false,
  'private_artifact_columns_granted', false,
  'cross_tenant_leak', false
);
