\set ON_ERROR_STOP on

DO $gate$
BEGIN
  IF current_database() <> 'la_muni_rag_real_corpus_test' THEN
    RAISE EXCEPTION 'controlled corpus setup requires la_muni_rag_real_corpus_test';
  END IF;
END;
$gate$;

CREATE ROLE :"runtime_role"
  LOGIN
  PASSWORD :'runtime_password'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOBYPASSRLS;

GRANT CONNECT ON DATABASE la_muni_rag_real_corpus_test TO :"runtime_role";
GRANT USAGE ON SCHEMA identity, rag, audit, integration TO :"runtime_role";
GRANT EXECUTE ON FUNCTION identity.current_tenant_id() TO :"runtime_role";
GRANT EXECUTE ON FUNCTION rag.lock_valid_artifact_acceptance_v1(UUID, UUID, UUID, TEXT, UUID) TO :"runtime_role";
GRANT SELECT ON rag.documents, rag.artifact_objects, rag.artifact_scans TO :"runtime_role";
GRANT SELECT, UPDATE ON rag.document_versions TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON rag.ingestion_jobs, rag.embedding_vectors TO :"runtime_role";
GRANT INSERT ON audit.events TO :"runtime_role";

INSERT INTO identity.tenants (id, slug, name)
VALUES ('a7100000-0000-4000-8000-000000000001', 'controlled-antigua-corpus', 'Controlled Antigua corpus');

INSERT INTO identity.principals (
  id, tenant_id, principal_kind, external_subject, display_name
) VALUES (
  'a7100000-0000-4000-8000-000000000002',
  'a7100000-0000-4000-8000-000000000001',
  'service',
  'controlled-corpus-ingestion-v1',
  'Controlled corpus ingestion v1'
);

INSERT INTO identity.memberships (tenant_id, principal_id, role)
VALUES (
  'a7100000-0000-4000-8000-000000000001',
  'a7100000-0000-4000-8000-000000000002',
  'document_manager'
);

BEGIN;
SELECT set_config('app.tenant_id', 'a7100000-0000-4000-8000-000000000001', true);

INSERT INTO rag.municipalities (id, tenant_id, name, department, slug)
VALUES (
  'a7100000-0000-4000-8000-000000000003',
  'a7100000-0000-4000-8000-000000000001',
  'Municipalidad de La Antigua Guatemala',
  'Sacatepéquez',
  'controlled-antigua-corpus'
);

INSERT INTO rag.documents (
  id, tenant_id, municipality_id, title, document_type, document_scope,
  source_kind, source_url, official_source, status, metadata
) VALUES
(
  'a7100000-0000-4000-8000-000000000010',
  'a7100000-0000-4000-8000-000000000001',
  'a7100000-0000-4000-8000-000000000003',
  'Plan de Desarrollo Municipal y Ordenamiento Territorial de Antigua Guatemala - Modulo 1',
  'plan', 'municipal', 'official_url',
  'https://muniantigua.gob.gt/assets/backend/info/MODULO_1_PDMOT.pdf',
  true, 'active',
  '{"confidentiality":"public","document_key":"antigua-pdm-ot","controlled_corpus":true}'::jsonb
),
(
  'a7100000-0000-4000-8000-000000000020',
  'a7100000-0000-4000-8000-000000000001',
  'a7100000-0000-4000-8000-000000000003',
  'Manual de Normas y Procedimientos - DMP - Version 3',
  'manual', 'municipal', 'official_url',
  'https://muniantigua.gob.gt/assets/backend/info/6_2026_eu9Z7.pdf',
  true, 'active',
  '{"confidentiality":"public","document_key":"antigua-mnp-dmp-v3-2026","controlled_corpus":true}'::jsonb
);

INSERT INTO rag.document_versions (
  id, tenant_id, document_id, version_label, source_url, original_filename,
  mime_type, content_sha256, extraction_status, metadata
) VALUES
(
  'a7100000-0000-4000-8000-000000000011',
  'a7100000-0000-4000-8000-000000000001',
  'a7100000-0000-4000-8000-000000000010',
  'official-municipal-pdf-2026-06-22',
  'https://muniantigua.gob.gt/assets/backend/info/MODULO_1_PDMOT.pdf',
  'antigua-pdm-ot.pdf', 'application/pdf',
  '824f0ee47106f062269a7c65cb3433435470bbe609054972eb29c360f368cd0b',
  'queued', '{"controlled_corpus":true}'::jsonb
),
(
  'a7100000-0000-4000-8000-000000000021',
  'a7100000-0000-4000-8000-000000000001',
  'a7100000-0000-4000-8000-000000000020',
  'official-municipal-pdf-2026-02-17-v3',
  'https://muniantigua.gob.gt/assets/backend/info/6_2026_eu9Z7.pdf',
  'antigua-mnp-dmp-v3-2026.pdf', 'application/pdf',
  '4cbd35993b345c1f2bdb308825f1d3a6cac24ad239bdc9b087e2d99f2297e8f9',
  'queued', '{"controlled_corpus":true}'::jsonb
);
COMMIT;

DO $gate$
DECLARE
  role_row RECORD;
  protected_count INTEGER;
BEGIN
  SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
    INTO role_row
    FROM pg_roles
   WHERE rolname = 'la_muni_real_corpus_runtime';
  IF role_row.rolsuper OR role_row.rolcreatedb OR role_row.rolcreaterole OR role_row.rolbypassrls THEN
    RAISE EXCEPTION 'controlled corpus runtime role is privileged';
  END IF;

  SELECT count(*) INTO protected_count
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE (n.nspname, c.relname) IN (
     ('rag','artifact_objects'), ('rag','artifact_scans'),
     ('rag','ingestion_jobs'), ('rag','embedding_vectors'), ('rag','document_versions')
   )
     AND c.relrowsecurity AND c.relforcerowsecurity
     AND pg_get_userbyid(c.relowner) <> 'la_muni_real_corpus_runtime';
  IF protected_count <> 5 THEN
    RAISE EXCEPTION 'controlled corpus tables must be non-owner FORCE RLS';
  END IF;
END;
$gate$;
