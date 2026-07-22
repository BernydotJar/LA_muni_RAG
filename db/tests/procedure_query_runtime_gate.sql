\set ON_ERROR_STOP on

-- Destructive fixture and assertions for the disposable PostgreSQL gate only.
-- This file refuses to run against any database except the exact test name.
DO $gate$
BEGIN
  IF current_database() <> 'la_muni_rag_test' THEN
    RAISE EXCEPTION 'procedure query runtime gate requires la_muni_rag_test';
  END IF;
END;
$gate$;

CREATE ROLE la_muni_runtime_test
  LOGIN
  PASSWORD 'disposable-runtime-password-20260718'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOBYPASSRLS;

GRANT CONNECT ON DATABASE la_muni_rag_test TO la_muni_runtime_test;
GRANT USAGE ON SCHEMA identity, rag, agent, audit, integration
  TO la_muni_runtime_test;
GRANT EXECUTE ON FUNCTION identity.authenticate_api_credential(BYTEA)
  TO la_muni_runtime_test;
GRANT EXECUTE ON FUNCTION audit.record_authentication_failure(UUID, UUID, TEXT)
  TO la_muni_runtime_test;
GRANT SELECT ON
  rag.municipalities,
  rag.documents,
  rag.document_versions,
  rag.document_sections
  TO la_muni_runtime_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  integration.procedure_query_idempotency,
  integration.procedure_query_rate_limits
  TO la_muni_runtime_test;
GRANT INSERT ON audit.events TO la_muni_runtime_test;

DO $gate$
DECLARE
  is_super BOOLEAN;
  bypasses_rls BOOLEAN;
BEGIN
  SELECT rolsuper, rolbypassrls
  INTO is_super, bypasses_rls
  FROM pg_roles
  WHERE rolname = 'la_muni_runtime_test';

  IF is_super IS DISTINCT FROM false OR bypasses_rls IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'runtime gate role must not be superuser or bypass RLS';
  END IF;
END;
$gate$;

INSERT INTO identity.tenants (id, slug, name)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'runtime-tenant-a', 'Runtime tenant A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'runtime-tenant-b', 'Runtime tenant B');

INSERT INTO identity.principals (
  id,
  tenant_id,
  principal_kind,
  external_subject,
  display_name
)
VALUES
  (
    '77777777-7777-4777-8777-777777777777',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'integration',
    'runtime-api-a',
    'Runtime API principal A'
  ),
  (
    '99999999-9999-4999-8999-999999999999',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'integration',
    'runtime-api-b',
    'Runtime API principal B'
  );

INSERT INTO identity.memberships (tenant_id, principal_id, role)
VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '77777777-7777-4777-8777-777777777777',
    'integration_client'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '99999999-9999-4999-8999-999999999999',
    'integration_client'
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
    '88888888-8888-4888-8888-888888888888',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '77777777-7777-4777-8777-777777777777',
    'Disposable runtime API credential A',
    digest('disposable-tenant-a-api-token-20260718', 'sha256')
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000002',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '99999999-9999-4999-8999-999999999999',
    'Disposable runtime API credential B',
    digest('disposable-tenant-b-api-token-20260718', 'sha256')
  );

BEGIN;
SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
INSERT INTO rag.municipalities (id, tenant_id, name, department, slug)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'Municipalidad de La Antigua Guatemala',
  'Sacatepéquez',
  'la-antigua-guatemala-sacatepequez'
);
INSERT INTO rag.documents (
  id,
  tenant_id,
  municipality_id,
  title,
  document_type,
  document_scope,
  source_kind,
  source_url,
  official_source,
  status,
  metadata
)
VALUES (
  '33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'Manual oficial de procedimientos comunitarios de La Antigua Guatemala',
  'manual',
  'municipal',
  'official_url',
  'https://muniantigua.gob.gt/runtime-gate-manual.pdf',
  true,
  'active',
  '{"confidentiality":"public","source_jurisdiction":"Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala"}'::jsonb
);
INSERT INTO rag.document_versions (
  id,
  tenant_id,
  document_id,
  version_label,
  source_url,
  content_sha256,
  extraction_status
)
VALUES (
  '55555555-5555-4555-8555-555555555555',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '33333333-3333-4333-8333-333333333333',
  'runtime-v1',
  'https://muniantigua.gob.gt/runtime-gate-manual.pdf',
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  'processed'
);
INSERT INTO rag.document_sections (
  id,
  tenant_id,
  document_version_id,
  section_type,
  citation_label,
  page_start,
  page_end,
  content,
  content_sha256
)
VALUES (
  '12121212-1212-4212-8212-121212121212',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '55555555-5555-4555-8555-555555555555',
  'section',
  'Solicitud de agua comunitaria y seguimiento',
  2,
  2,
  'Solicitud de agua comunitaria: qué se necesita para llevar agua potable a una comunidad de Antigua Guatemala y cómo se le da seguimiento. COCODE, COMUDE, priorización, planificación municipal, perfil, diagnóstico, fuente de agua, disponibilidad, calidad, terreno, propiedad, servidumbres y evidencia documental.',
  'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
);
COMMIT;

BEGIN;
SELECT set_config('app.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
INSERT INTO rag.municipalities (id, tenant_id, name, department, slug)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Municipalidad de La Antigua Guatemala',
  'Sacatepéquez',
  'la-antigua-guatemala-sacatepequez'
);
INSERT INTO rag.documents (
  id,
  tenant_id,
  municipality_id,
  title,
  document_type,
  document_scope,
  source_kind,
  source_url,
  official_source,
  status,
  metadata
)
VALUES (
  '44444444-4444-4444-8444-444444444444',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '22222222-2222-4222-8222-222222222222',
  'TENANT_B_SECRET_MARKER',
  'manual',
  'municipal',
  'official_url',
  'https://tenant-b.invalid/secret.pdf',
  true,
  'active',
  '{"confidentiality":"public"}'::jsonb
);
INSERT INTO rag.document_versions (
  id,
  tenant_id,
  document_id,
  version_label,
  source_url,
  content_sha256,
  extraction_status
)
VALUES (
  '66666666-6666-4666-8666-666666666666',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '44444444-4444-4444-8444-444444444444',
  'runtime-v1',
  'https://tenant-b.invalid/secret.pdf',
  'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  'processed'
);
INSERT INTO rag.document_sections (
  id,
  tenant_id,
  document_version_id,
  section_type,
  citation_label,
  page_start,
  page_end,
  content,
  content_sha256
)
VALUES (
  '34343434-3434-4434-8434-343434343434',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '66666666-6666-4666-8666-666666666666',
  'section',
  'TENANT_B_SECRET_MARKER',
  1,
  1,
  'TENANT_B_SECRET_MARKER agua potable comunidad COCODE COMUDE solicitud seguimiento.',
  'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
);
COMMIT;

SET ROLE la_muni_runtime_test;

DO $gate$
DECLARE
  visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM rag.documents;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'missing tenant context exposed % documents', visible_count;
  END IF;

  PERFORM set_config('app.tenant_id', 'malformed-tenant', false);
  SELECT count(*) INTO visible_count FROM rag.documents;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'malformed tenant context exposed % documents', visible_count;
  END IF;
  RESET app.tenant_id;
END;
$gate$;

DO $gate$
BEGIN
  BEGIN
    PERFORM 1 FROM audit.authentication_failures;
    RAISE EXCEPTION 'runtime role unexpectedly read authentication failure storage';
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
    digest('disposable-tenant-a-api-token-20260718', 'sha256')
  );
  IF authenticated_tenant IS DISTINCT FROM 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid THEN
    RAISE EXCEPTION 'credential authentication returned the wrong tenant';
  END IF;
END;
$gate$;

DO $gate$
DECLARE
  first_audit UUID;
  repeated_audit UUID;
BEGIN
  SELECT audit.record_authentication_failure(
    '45454545-4545-4454-8454-454545454545',
    '56565656-5656-4565-8565-565656565656',
    'credential_rejected'
  ) INTO first_audit;
  SELECT audit.record_authentication_failure(
    '67676767-6767-4676-8676-676767676767',
    '78787878-7878-4787-8787-787878787878',
    'credential_rejected'
  ) INTO repeated_audit;
  IF first_audit IS DISTINCT FROM repeated_audit THEN
    RAISE EXCEPTION 'authentication failures did not aggregate by minute and reason';
  END IF;
END;
$gate$;

BEGIN;
SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
DO $gate$
DECLARE
  visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM rag.documents;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'tenant A expected one document, found %', visible_count;
  END IF;
  IF EXISTS (SELECT 1 FROM rag.documents WHERE title = 'TENANT_B_SECRET_MARKER') THEN
    RAISE EXCEPTION 'tenant A observed tenant B metadata';
  END IF;

  BEGIN
    INSERT INTO integration.procedure_query_idempotency (
      tenant_id,
      principal_id,
      operation,
      idempotency_key_sha256,
      request_sha256,
      state,
      expires_at
    ) VALUES (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '99999999-9999-4999-8999-999999999999',
      'procedure_query_v1',
      digest('cross-tenant-write', 'sha256'),
      digest('cross-tenant-request', 'sha256'),
      'processing',
      statement_timestamp() + interval '1 hour'
    );
    RAISE EXCEPTION 'tenant A unexpectedly inserted tenant B state';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$gate$;

INSERT INTO integration.procedure_query_idempotency (
  tenant_id,
  principal_id,
  operation,
  idempotency_key_sha256,
  request_sha256,
  state,
  expires_at
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '77777777-7777-4777-8777-777777777777',
  'procedure_query_v1',
  digest('shared-runtime-key', 'sha256'),
  digest('tenant-a-runtime-request', 'sha256'),
  'processing',
  statement_timestamp() + interval '1 hour'
);

DO $gate$
BEGIN
  BEGIN
    UPDATE integration.procedure_query_idempotency
    SET
      state = 'completed',
      response_status = 500,
      response_body = '{}',
      audit_id = '89898989-8989-4989-8989-898989898989',
      completed_at = statement_timestamp()
    WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND idempotency_key_sha256 = digest('shared-runtime-key', 'sha256');
    RAISE EXCEPTION 'idempotency state accepted a non-success response';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END;
$gate$;

DELETE FROM integration.procedure_query_idempotency
WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND idempotency_key_sha256 = digest('shared-runtime-key', 'sha256');
COMMIT;

BEGIN;
SELECT set_config('app.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
DO $gate$
DECLARE
  visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM rag.documents;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'tenant B expected one document, found %', visible_count;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM rag.documents WHERE title = 'TENANT_B_SECRET_MARKER') THEN
    RAISE EXCEPTION 'tenant B could not read its own document';
  END IF;
END;
$gate$;

INSERT INTO integration.procedure_query_idempotency (
  tenant_id,
  principal_id,
  operation,
  idempotency_key_sha256,
  request_sha256,
  state,
  expires_at
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '99999999-9999-4999-8999-999999999999',
  'procedure_query_v1',
  digest('shared-runtime-key', 'sha256'),
  digest('tenant-b-runtime-request', 'sha256'),
  'processing',
  statement_timestamp() + interval '1 hour'
);
DELETE FROM integration.procedure_query_idempotency
WHERE tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  AND idempotency_key_sha256 = digest('shared-runtime-key', 'sha256');
COMMIT;

RESET ROLE;

DO $gate$
DECLARE
  aggregate_count BIGINT;
BEGIN
  SELECT failure_count
  INTO aggregate_count
  FROM audit.authentication_failures
  WHERE audit_id = '45454545-4545-4454-8454-454545454545';
  IF aggregate_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'expected authentication failure aggregate count 2, found %', aggregate_count;
  END IF;
END;
$gate$;

SELECT
  current_database() AS database_name,
  current_setting('server_version') AS postgres_version,
  (SELECT extversion FROM pg_extension WHERE extname = 'vector') AS pgvector_version,
  'procedure_query_runtime_gate_passed' AS result;
