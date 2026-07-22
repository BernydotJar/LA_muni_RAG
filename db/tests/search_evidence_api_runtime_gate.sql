\set ON_ERROR_STOP on

-- Destructive fixture and privilege assertions for the disposable Search/Evidence gate only.
DO $gate$
BEGIN
  IF current_database() <> 'la_muni_rag_search_test' THEN
    RAISE EXCEPTION 'search/evidence runtime gate requires la_muni_rag_search_test';
  END IF;
END;
$gate$;

DO $gate$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'la_muni_search_runtime_test') THEN
    CREATE ROLE la_muni_search_runtime_test;
  END IF;
END;
$gate$;
ALTER ROLE la_muni_search_runtime_test
  LOGIN
  PASSWORD 'disposable-search-runtime-password-20260721'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOBYPASSRLS;

GRANT CONNECT ON DATABASE la_muni_rag_search_test TO la_muni_search_runtime_test;
GRANT USAGE ON SCHEMA identity, rag, audit TO la_muni_search_runtime_test;
GRANT EXECUTE ON FUNCTION identity.authenticate_api_credential(BYTEA)
  TO la_muni_search_runtime_test;
GRANT EXECUTE ON FUNCTION identity.record_search_evidence_auth_failure(UUID, TEXT)
  TO la_muni_search_runtime_test;
GRANT INSERT ON audit.events TO la_muni_search_runtime_test;
GRANT SELECT (
  tenant_id, id, source_key, title, source_relation, target_jurisdiction,
  source_jurisdiction, validation_state, official_source,
  official_for_target_jurisdiction, acquisition_state, ingestion_state,
  retrieval_state, publication_date, effective_date, artifact_url, discovery_url
) ON rag.sources TO la_muni_search_runtime_test;
GRANT SELECT (
  tenant_id, id, source_id, title, document_type, document_scope,
  publication_date, effective_date, repeal_date, status, confidentiality, source_url
) ON rag.documents TO la_muni_search_runtime_test;
GRANT SELECT (
  tenant_id, id, document_id, source_url, content_sha256, extraction_status
) ON rag.document_versions TO la_muni_search_runtime_test;
GRANT SELECT (
  tenant_id, id, document_version_id, citation_label, content, content_tsv,
  page_start, page_end, section_number
) ON rag.document_sections TO la_muni_search_runtime_test;
GRANT SELECT (
  tenant_id, id, document_version_id, status, accepted_until,
  expected_sha256, accepted_scan_id, inspection_generation, declared_media_type
) ON rag.artifact_objects TO la_muni_search_runtime_test;
GRANT SELECT (
  tenant_id, id, artifact_object_id, verdict, inspection_generation,
  content_sha256, detected_media_type, inspected_at
) ON rag.artifact_scans TO la_muni_search_runtime_test;
GRANT SELECT (
  tenant_id, id, document_version_id, artifact_object_id, artifact_scan_id, status
) ON rag.ingestion_jobs TO la_muni_search_runtime_test;
GRANT SELECT (
  tenant_id, document_version_id, ingestion_job_id, contract_version,
  chunk_id, citation_label, chunk_text, page_start, page_end, article_number,
  embedding_provider, embedding_model, embedding_dimension, embedding
) ON rag.embedding_vectors TO la_muni_search_runtime_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  rag.search_evidence_api_idempotency,
  rag.search_evidence_api_rate_limits
  TO la_muni_search_runtime_test;

DO $gate$
DECLARE
  is_super BOOLEAN;
  bypasses_rls BOOLEAN;
  protected_table REGCLASS;
BEGIN
  SELECT rolsuper, rolbypassrls
  INTO is_super, bypasses_rls
  FROM pg_roles
  WHERE rolname = 'la_muni_search_runtime_test';
  IF is_super IS DISTINCT FROM false OR bypasses_rls IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'search runtime role must not be superuser or bypass RLS';
  END IF;

  FOREACH protected_table IN ARRAY ARRAY[
    'rag.sources'::regclass,
    'rag.documents'::regclass,
    'rag.document_versions'::regclass,
    'rag.document_sections'::regclass,
    'rag.artifact_objects'::regclass,
    'rag.artifact_scans'::regclass,
    'rag.ingestion_jobs'::regclass,
    'rag.embedding_vectors'::regclass,
    'rag.search_evidence_api_idempotency'::regclass,
    'rag.search_evidence_api_rate_limits'::regclass
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class
      WHERE oid = protected_table AND relrowsecurity AND relforcerowsecurity
    ) THEN
      RAISE EXCEPTION '% must enable and force RLS', protected_table;
    END IF;
    IF pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = protected_table)) = 'la_muni_search_runtime_test' THEN
      RAISE EXCEPTION 'search runtime role owns protected table %', protected_table;
    END IF;
  END LOOP;

  IF has_column_privilege('la_muni_search_runtime_test', 'rag.artifact_objects', 'object_key', 'SELECT')
     OR has_column_privilege('la_muni_search_runtime_test', 'rag.artifact_objects', 'object_namespace', 'SELECT')
     OR has_column_privilege('la_muni_search_runtime_test', 'rag.artifact_objects', 'object_version', 'SELECT')
     OR has_column_privilege('la_muni_search_runtime_test', 'rag.artifact_scans', 'scanner_engine', 'SELECT')
     OR has_column_privilege('la_muni_search_runtime_test', 'rag.artifact_scans', 'scanner_engine_version', 'SELECT')
     OR has_column_privilege('la_muni_search_runtime_test', 'rag.ingestion_jobs', 'lease_token_sha256', 'SELECT')
     OR has_column_privilege('la_muni_search_runtime_test', 'rag.ingestion_jobs', 'pipeline_config', 'SELECT')
     OR has_column_privilege('la_muni_search_runtime_test', 'rag.sources', 'official_source', 'UPDATE')
     OR has_column_privilege('la_muni_search_runtime_test', 'rag.documents', 'status', 'UPDATE') THEN
    RAISE EXCEPTION 'search runtime privileges expose private state or permit authority promotion';
  END IF;
END;
$gate$;

INSERT INTO identity.tenants (id, slug, name)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'search-runtime-tenant-a', 'Search runtime tenant A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'search-runtime-tenant-b', 'Search runtime tenant B');

INSERT INTO identity.principals (
  id, tenant_id, principal_kind, external_subject, display_name
) VALUES
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'user', 'search-researcher-a', 'Search researcher A'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'user', 'search-researcher-b', 'Search researcher B');

INSERT INTO identity.memberships (tenant_id, principal_id, role)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'researcher'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'researcher');

INSERT INTO identity.api_credentials (
  id, tenant_id, principal_id, label, secret_sha256
) VALUES
  ('33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '11111111-1111-4111-8111-111111111111', 'Disposable search credential A',
   digest('search-researcher-a-token-20260721-000000000001', 'sha256')),
  ('44444444-4444-4444-8444-444444444444', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '22222222-2222-4222-8222-222222222222', 'Disposable search credential B',
   digest('search-researcher-b-token-20260721-000000000001', 'sha256'));

BEGIN;
SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

INSERT INTO rag.sources (
  id, tenant_id, source_key, title, category, target_jurisdiction,
  source_jurisdiction, source_relation, discovery_status, discovery_url,
  artifact_url, observed_version, publication_date, effective_date,
  limitations, validation_state, official_source,
  official_for_target_jurisdiction, acquisition_state, ingestion_state,
  retrieval_state, created_by_principal_id
) VALUES
  (
    '55555555-5555-4555-8555-555555555555',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'antigua-water-procedure',
    'Manual oficial de agua potable',
    'procedure_manual',
    'Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala',
    'Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala',
    'target', 'identified',
    'https://muniantigua.gob.gt/documentos/manual-agua.pdf',
    'https://muniantigua.gob.gt/documentos/manual-agua.pdf',
    '2025-v1', '2025-01-10', '2025-02-01',
    '["Requiere revisión humana de aplicabilidad al caso concreto."]'::jsonb,
    'validated', true, true, 'acquired', 'ingested', 'indexed',
    '11111111-1111-4111-8111-111111111111'
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'mixco-water-manual',
    'Manual de aguas de Mixco',
    'procedure_manual',
    'Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala',
    'Municipio de Mixco, Guatemala',
    'comparative', 'identified',
    'https://munimixco.gob.gt/manuales/aguas.pdf',
    'https://munimixco.gob.gt/manuales/aguas.pdf',
    '2025-v1', '2025-01-15', '2025-02-01',
    '["Referencia comparativa pendiente de corroboración para Antigua Guatemala."]'::jsonb,
    'validated', true, false, 'acquired', 'ingested', 'indexed',
    '11111111-1111-4111-8111-111111111111'
  );

INSERT INTO rag.documents (
  id, tenant_id, source_id, title, document_type, document_scope,
  issuing_authority, source_kind, source_url, publication_date,
  effective_date, status, confidentiality, registered_by_principal_id, metadata
) VALUES
  (
    '77777777-7777-4777-8777-777777777777',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '55555555-5555-4555-8555-555555555555',
    'Manual oficial de agua potable', 'procedure', 'municipal',
    'Municipalidad de La Antigua Guatemala', 'official_url',
    'https://muniantigua.gob.gt/documentos/manual-agua.pdf',
    '2025-01-10', '2025-02-01', 'active', 'public',
    '11111111-1111-4111-8111-111111111111',
    '{"confidentiality":"public"}'::jsonb
  ),
  (
    '88888888-8888-4888-8888-888888888888',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '66666666-6666-4666-8666-666666666666',
    'Manual de aguas de Mixco', 'manual', 'municipal',
    'Municipalidad de Mixco', 'official_url',
    'https://munimixco.gob.gt/manuales/aguas.pdf',
    '2025-01-15', '2025-02-01', 'active', 'public',
    '11111111-1111-4111-8111-111111111111',
    '{"confidentiality":"public"}'::jsonb
  );

-- Catalog registration is fail-closed and forces draft. This owner-only fixture
-- models a separate reviewed activation; the runtime role has no UPDATE grant.
UPDATE rag.documents
SET status = 'active', updated_at = statement_timestamp()
WHERE id IN (
  '77777777-7777-4777-8777-777777777777',
  '88888888-8888-4888-8888-888888888888'
);

INSERT INTO rag.document_versions (
  id, tenant_id, document_id, version_label, source_url, original_filename,
  mime_type, content_sha256, extraction_status
) VALUES
  ('99999999-9999-4999-8999-999999999999', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '77777777-7777-4777-8777-777777777777', '2025-v1',
   'https://muniantigua.gob.gt/documentos/manual-agua.pdf', 'manual-agua.pdf',
   'application/pdf', repeat('a', 64), 'processed'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '88888888-8888-4888-8888-888888888888', '2025-v1',
   'https://munimixco.gob.gt/manuales/aguas.pdf', 'manual-mixco.pdf',
   'application/pdf', repeat('b', 64), 'processed');

INSERT INTO rag.document_sections (
  id, tenant_id, document_version_id, section_type, section_label,
  section_number, citation_label, page_start, page_end, content, content_sha256
) VALUES
  ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '99999999-9999-4999-8999-999999999999', 'section', 'Recepción', '12',
   'Manual oficial de agua potable, página 12', 12, 12,
   'La unidad municipal recibe la solicitud documental de agua potable y verifica los requisitos publicados.',
   repeat('c', 64)),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-0000-4000-8000-000000000001', 'section', 'Registro', '8',
   'Manual de aguas de Mixco, página 8', 8, 8,
   'La dependencia de Mixco registra la solicitud documental de agua potable y revisa el expediente.',
   repeat('d', 64));

INSERT INTO rag.artifact_objects (
  id, tenant_id, document_version_id, registered_by_principal_id,
  store_name, object_namespace, object_key, object_version,
  original_filename, declared_media_type, expected_sha256,
  inspection_generation, status
) VALUES
  ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '99999999-9999-4999-8999-999999999999', '11111111-1111-4111-8111-111111111111',
   'fixture_store', 'tenant-a', 'private/antigua/manual-agua.pdf', 'generation-1',
   'manual-agua.pdf', 'application/pdf', decode(repeat('a', 64), 'hex'), 1, 'scanning'),
  ('cccccccc-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'fixture_store', 'tenant-a', 'private/mixco/manual.pdf', 'generation-1',
   'manual-mixco.pdf', 'application/pdf', decode(repeat('b', 64), 'hex'), 1, 'scanning');

INSERT INTO rag.artifact_scans (
  id, tenant_id, artifact_object_id, inspection_generation,
  inspected_by_principal_id, verdict, content_sha256, byte_length,
  detected_media_type, structural_signature, inspected_at,
  scanner_engine, scanner_engine_version, scanner_definitions_version
) VALUES
  ('dddddddd-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'cccccccc-0000-4000-8000-000000000001', 1,
   '11111111-1111-4111-8111-111111111111', 'clean', decode(repeat('a', 64), 'hex'), 2048,
   'application/pdf', 'pdf-header-v1', statement_timestamp(),
   'fixture-scanner', '1.0.0', 'defs-20260721'),
  ('dddddddd-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'cccccccc-0000-4000-8000-000000000002', 1,
   '11111111-1111-4111-8111-111111111111', 'clean', decode(repeat('b', 64), 'hex'), 2048,
   'application/pdf', 'pdf-header-v1', statement_timestamp(),
   'fixture-scanner', '1.0.0', 'defs-20260721');

UPDATE rag.artifact_objects
SET status = 'accepted',
    accepted_scan_id = CASE id
      WHEN 'cccccccc-0000-4000-8000-000000000001'::uuid THEN 'dddddddd-0000-4000-8000-000000000001'::uuid
      ELSE 'dddddddd-0000-4000-8000-000000000002'::uuid
    END,
    accepted_until = statement_timestamp() + interval '6 days',
    updated_at = statement_timestamp()
WHERE id IN (
  'cccccccc-0000-4000-8000-000000000001',
  'cccccccc-0000-4000-8000-000000000002'
);

INSERT INTO rag.ingestion_jobs (
  id, tenant_id, document_version_id, status, job_type, requested_by,
  started_at, finished_at, metrics, artifact_object_id, artifact_scan_id
) VALUES
  ('eeeeeeee-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '99999999-9999-4999-8999-999999999999', 'processed', 'search_fixture', 'runtime-gate',
   statement_timestamp() - interval '2 minutes', statement_timestamp() - interval '1 minute',
   '{"fixture":true}'::jsonb,
   'cccccccc-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-0000-4000-8000-000000000001', 'processed', 'search_fixture', 'runtime-gate',
   statement_timestamp() - interval '2 minutes', statement_timestamp() - interval '1 minute',
   '{"fixture":true}'::jsonb,
   'cccccccc-0000-4000-8000-000000000002', 'dddddddd-0000-4000-8000-000000000002');

INSERT INTO rag.embedding_vectors (
  tenant_id, document_version_id, ingestion_job_id, contract_version,
  chunk_id, document_key, document_version, document_title, citation_label,
  page_start, page_end, source_type, section_path, section_type,
  chunk_ordinal, chunk_text, content_sha256, token_estimate,
  embedding_model, embedding_provider, embedding_dimension, embedding, metadata
) VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '99999999-9999-4999-8999-999999999999',
    'eeeeeeee-0000-4000-8000-000000000001', 1,
    'chunk-antigua-1', 'antigua-water-procedure', '2025-v1',
    'Manual oficial de agua potable', 'Manual oficial de agua potable, página 12',
    12, 12, 'pdf', '["Recepción"]'::jsonb, 'procedure_step', 1,
    'La unidad municipal recibe la solicitud documental de agua potable y verifica los requisitos publicados.',
    repeat('c', 64), 24, 'test-model-v1', 'test-provider', 1536,
    (SELECT ('[' || string_agg('0.001', ',') || ']')::vector FROM generate_series(1, 1536)),
    '{}'::jsonb
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-0000-4000-8000-000000000001',
    'eeeeeeee-0000-4000-8000-000000000002', 1,
    'chunk-mixco-1', 'mixco-water-manual', '2025-v1',
    'Manual de aguas de Mixco', 'Manual de aguas de Mixco, página 8',
    8, 8, 'pdf', '["Registro"]'::jsonb, 'procedure_step', 1,
    'La dependencia de Mixco registra la solicitud documental de agua potable y revisa el expediente.',
    repeat('d', 64), 23, 'test-model-v1', 'test-provider', 1536,
    (SELECT ('[' || string_agg('0.002', ',') || ']')::vector FROM generate_series(1, 1536)),
    '{}'::jsonb
  );
COMMIT;

SET ROLE la_muni_search_runtime_test;

DO $gate$
DECLARE visible_count INTEGER;
BEGIN
  SELECT count(id) INTO visible_count FROM rag.sources;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'missing tenant context exposed sources';
  END IF;
  SELECT count(id) INTO visible_count FROM rag.artifact_objects;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'missing tenant context exposed artifact identities';
  END IF;
END;
$gate$;

BEGIN;
SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
DO $gate$
DECLARE
  source_count INTEGER;
  eligible_count INTEGER;
  vector_count INTEGER;
BEGIN
  SELECT count(id) INTO source_count FROM rag.sources;
  IF source_count <> 2 THEN
    RAISE EXCEPTION 'tenant A source visibility failed: %', source_count;
  END IF;

  SELECT count(section.id)
  INTO eligible_count
  FROM rag.sources AS source
  JOIN rag.documents AS document
    ON document.tenant_id = source.tenant_id AND document.source_id = source.id
  JOIN rag.document_versions AS version
    ON version.tenant_id = document.tenant_id AND version.document_id = document.id
  JOIN rag.document_sections AS section
    ON section.tenant_id = version.tenant_id AND section.document_version_id = version.id
  JOIN rag.artifact_objects AS artifact
    ON artifact.tenant_id = version.tenant_id AND artifact.document_version_id = version.id
   AND artifact.status = 'accepted' AND artifact.accepted_until > statement_timestamp()
   AND encode(artifact.expected_sha256, 'hex') = version.content_sha256
  JOIN rag.artifact_scans AS scan
    ON scan.tenant_id = artifact.tenant_id AND scan.artifact_object_id = artifact.id
   AND scan.id = artifact.accepted_scan_id AND scan.verdict = 'clean'
   AND scan.inspection_generation = artifact.inspection_generation
   AND scan.content_sha256 = artifact.expected_sha256
   AND scan.detected_media_type = artifact.declared_media_type
  JOIN rag.ingestion_jobs AS job
    ON job.tenant_id = version.tenant_id AND job.document_version_id = version.id
   AND job.artifact_object_id = artifact.id AND job.artifact_scan_id = scan.id
   AND job.status = 'processed'
  WHERE source.acquisition_state = 'acquired'
    AND source.ingestion_state = 'ingested'
    AND source.retrieval_state = 'indexed'
    AND document.status = 'active'
    AND document.confidentiality = 'public'
    AND version.extraction_status = 'processed';
  IF eligible_count <> 2 THEN
    RAISE EXCEPTION 'eligible public evidence count failed: %', eligible_count;
  END IF;

  SELECT count(chunk_id) INTO vector_count FROM rag.embedding_vectors;
  IF vector_count <> 2 THEN
    RAISE EXCEPTION 'tenant vector visibility failed: %', vector_count;
  END IF;
END;
$gate$;
COMMIT;

BEGIN;
SELECT set_config('app.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
DO $gate$
DECLARE visible_count INTEGER;
BEGIN
  SELECT count(id) INTO visible_count FROM rag.sources;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'tenant B observed tenant A sources';
  END IF;
  SELECT count(chunk_id) INTO visible_count FROM rag.embedding_vectors;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'tenant B observed tenant A vectors';
  END IF;
END;
$gate$;
ROLLBACK;

RESET ROLE;

SELECT json_build_object(
  'result', 'search_evidence_api_sql_gate_passed',
  'postgres_version', current_setting('server_version'),
  'runtime_role_super_or_bypass', (
    SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = 'la_muni_search_runtime_test'
  ),
  'private_artifact_columns_granted', false,
  'cross_tenant_leak', false,
  'eligible_fixture_count', 2
);
