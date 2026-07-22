\set ON_ERROR_STOP on

DO $gate$
BEGIN
  IF current_database() <> 'la_muni_rag_catalog_test' THEN
    RAISE EXCEPTION 'staging reset gate requires la_muni_rag_catalog_test';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'la_muni_runtime_test') THEN
    RAISE EXCEPTION 'staging reset gate requires the non-owner runtime role';
  END IF;
END;
$gate$;

GRANT CONNECT ON DATABASE la_muni_rag_catalog_test TO la_muni_runtime_test;
GRANT USAGE ON SCHEMA identity, rag, audit TO la_muni_runtime_test;
GRANT EXECUTE ON FUNCTION identity.authenticate_api_credential(BYTEA) TO la_muni_runtime_test;
GRANT EXECUTE ON FUNCTION identity.record_catalog_auth_failure(UUID, TEXT) TO la_muni_runtime_test;
GRANT SELECT ON rag.sources TO la_muni_runtime_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON rag.catalog_api_rate_limits TO la_muni_runtime_test;
GRANT INSERT ON audit.events TO la_muni_runtime_test;

INSERT INTO identity.tenants (id, slug, name)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'staging-reset-a', 'Staging reset tenant A');

INSERT INTO identity.principals (
  id, tenant_id, principal_kind, external_subject, display_name
) VALUES (
  '31313131-3131-4313-8313-313131313131',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'user', 'staging-reset-manager', 'Staging reset manager'
);

INSERT INTO identity.memberships (tenant_id, principal_id, role)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '31313131-3131-4313-8313-313131313131',
  'document_manager'
);

INSERT INTO identity.api_credentials (
  id, tenant_id, principal_id, label, secret_sha256
) VALUES (
  '33333333-3333-4333-8333-333333333333',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '31313131-3131-4313-8313-313131313131',
  'Disposable staging reset credential',
  digest('staging-reset-manager-token-20260722-00000001', 'sha256')
);

SET ROLE la_muni_runtime_test;
BEGIN;
SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
DO $gate$
DECLARE visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM rag.sources;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'fresh staging reset database contains sources';
  END IF;
END;
$gate$;
COMMIT;
RESET ROLE;
