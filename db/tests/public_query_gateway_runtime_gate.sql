\set ON_ERROR_STOP on

DO $gate$
BEGIN
  IF current_database() <> 'la_muni_rag_search_test' THEN
    RAISE EXCEPTION 'public query runtime gate requires la_muni_rag_search_test';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'la_muni_search_runtime_test') THEN
    RAISE EXCEPTION 'public query gate requires the disposable search runtime role';
  END IF;
END;
$gate$;

GRANT SELECT, INSERT, UPDATE, DELETE ON rag.public_query_rate_limits
  TO la_muni_search_runtime_test;

DO $gate$
DECLARE
  owns_table BOOLEAN;
  is_super BOOLEAN;
  bypasses_rls BOOLEAN;
BEGIN
  SELECT rolsuper, rolbypassrls
  INTO is_super, bypasses_rls
  FROM pg_roles
  WHERE rolname = 'la_muni_search_runtime_test';

  IF is_super IS DISTINCT FROM false OR bypasses_rls IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'public query runtime role must not be superuser or bypass RLS';
  END IF;

  SELECT pg_get_userbyid(relowner) = 'la_muni_search_runtime_test'
  INTO owns_table
  FROM pg_class
  WHERE oid = 'rag.public_query_rate_limits'::regclass;

  IF owns_table IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'public query runtime role must not own the rate table';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE oid = 'rag.public_query_rate_limits'::regclass
      AND relrowsecurity
      AND relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'public query rate table must enable and force RLS';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'rag'
      AND table_name = 'public_query_rate_limits'
      AND column_name IN ('ip_address', 'user_agent', 'query_text', 'request_body', 'source_url')
  ) THEN
    RAISE EXCEPTION 'public query rate table contains forbidden raw identity or content columns';
  END IF;

  IF NOT has_table_privilege(
    'la_muni_search_runtime_test',
    'rag.public_query_rate_limits',
    'SELECT,INSERT,UPDATE,DELETE'
  ) THEN
    RAISE EXCEPTION 'public query runtime role lacks reviewed rate-table privileges';
  END IF;
END;
$gate$;

SET ROLE la_muni_search_runtime_test;

DO $gate$
DECLARE visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM rag.public_query_rate_limits;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'missing tenant context exposed public rate rows';
  END IF;
END;
$gate$;

BEGIN;
SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
INSERT INTO rag.public_query_rate_limits (
  tenant_id, client_key_sha256, operation, window_started_at, request_count
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  decode(repeat('1', 64), 'hex'),
  'public_query_client_v1',
  date_trunc('minute', statement_timestamp()),
  1
);

DO $gate$
DECLARE visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM rag.public_query_rate_limits;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'tenant A public rate visibility failed: %', visible_count;
  END IF;
END;
$gate$;
COMMIT;

BEGIN;
SELECT set_config('app.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
DO $gate$
DECLARE visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM rag.public_query_rate_limits;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'tenant B observed tenant A public rate rows';
  END IF;
END;
$gate$;
ROLLBACK;

RESET ROLE;

SELECT json_build_object(
  'result', 'public_query_gateway_sql_gate_passed',
  'postgres_version', current_setting('server_version'),
  'runtime_role_super_or_bypass', (
    SELECT rolsuper OR rolbypassrls
    FROM pg_roles
    WHERE rolname = 'la_muni_search_runtime_test'
  ),
  'rate_table_forced_rls', (
    SELECT relrowsecurity AND relforcerowsecurity
    FROM pg_class
    WHERE oid = 'rag.public_query_rate_limits'::regclass
  ),
  'raw_identity_columns', false,
  'cross_tenant_leak', false
);
