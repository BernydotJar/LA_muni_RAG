\set ON_ERROR_STOP on

DO $gate$
BEGIN
  IF current_database() <> 'la_muni_human_session_test' THEN
    RAISE EXCEPTION 'human session runtime gate requires la_muni_human_session_test';
  END IF;
END;
$gate$;

DO $gate$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'la_muni_human_runtime_test') THEN
    CREATE ROLE la_muni_human_runtime_test;
  END IF;
END;
$gate$;

ALTER ROLE la_muni_human_runtime_test
  LOGIN
  PASSWORD 'disposable-human-runtime-password-20260727'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOBYPASSRLS;

GRANT CONNECT ON DATABASE la_muni_human_session_test TO la_muni_human_runtime_test;
GRANT USAGE ON SCHEMA identity, audit TO la_muni_human_runtime_test;
GRANT EXECUTE ON FUNCTION identity.create_human_login_transaction(BYTEA, BYTEA, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO la_muni_human_runtime_test;
GRANT EXECUTE ON FUNCTION identity.consume_human_login_transaction(BYTEA, BYTEA, TEXT, TIMESTAMPTZ) TO la_muni_human_runtime_test;
GRANT EXECUTE ON FUNCTION identity.claim_human_authorization_code(TEXT, BYTEA, TIMESTAMPTZ) TO la_muni_human_runtime_test;
GRANT EXECUTE ON FUNCTION identity.resolve_human_membership(TEXT, BYTEA, BYTEA) TO la_muni_human_runtime_test;
GRANT EXECUTE ON FUNCTION identity.create_human_session(UUID, UUID, UUID, UUID, BYTEA, BYTEA, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO la_muni_human_runtime_test;
GRANT EXECUTE ON FUNCTION identity.authenticate_human_session(BYTEA, TIMESTAMPTZ) TO la_muni_human_runtime_test;
GRANT EXECUTE ON FUNCTION identity.rotate_human_session(BYTEA, UUID, BYTEA, BYTEA, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO la_muni_human_runtime_test;
GRANT EXECUTE ON FUNCTION identity.revoke_human_session(BYTEA, TIMESTAMPTZ) TO la_muni_human_runtime_test;
GRANT EXECUTE ON FUNCTION identity.record_human_session_audit(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT) TO la_muni_human_runtime_test;
GRANT EXECUTE ON FUNCTION identity.record_human_auth_failure(UUID, TEXT) TO la_muni_human_runtime_test;
GRANT SELECT ON identity.human_subjects, identity.human_sessions TO la_muni_human_runtime_test;

DO $gate$
DECLARE
  is_super BOOLEAN;
  bypasses_rls BOOLEAN;
  protected_table REGCLASS;
BEGIN
  SELECT rolsuper, rolbypassrls INTO is_super, bypasses_rls
  FROM pg_roles WHERE rolname = 'la_muni_human_runtime_test';
  IF is_super IS DISTINCT FROM false OR bypasses_rls IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'human session runtime role must not be superuser or bypass RLS';
  END IF;

  FOREACH protected_table IN ARRAY ARRAY[
    'identity.human_subjects'::regclass,
    'identity.human_sessions'::regclass
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class
      WHERE oid = protected_table AND relrowsecurity AND relforcerowsecurity
    ) THEN
      RAISE EXCEPTION '% must enable and force RLS', protected_table;
    END IF;
    IF pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = protected_table)) =
       'la_muni_human_runtime_test' THEN
      RAISE EXCEPTION 'runtime role owns protected table %', protected_table;
    END IF;
  END LOOP;

  IF has_table_privilege('la_muni_human_runtime_test', 'identity.human_login_transactions', 'SELECT')
    OR has_table_privilege('la_muni_human_runtime_test', 'identity.human_authorization_code_claims', 'SELECT')
    OR has_table_privilege('la_muni_human_runtime_test', 'identity.human_auth_failure_buckets', 'SELECT')
  THEN
    RAISE EXCEPTION 'runtime role can read pre-tenant challenge, code, or failure state directly';
  END IF;
END;
$gate$;

INSERT INTO identity.tenants (id, slug, name) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'human-session-a', 'Human session tenant A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'human-session-b', 'Human session tenant B');

INSERT INTO identity.principals (
  id, tenant_id, principal_kind, external_subject, display_name
) VALUES
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'user', NULL, 'Opaque human A'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   'user', NULL, 'Opaque human B'),
  ('33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'integration', NULL, 'Integration principal'),
  ('aaaaaaaa-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'user', NULL, 'Human with integration-only membership');

INSERT INTO identity.memberships (tenant_id, principal_id, role) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'viewer'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '22222222-2222-4222-8222-222222222222', 'researcher'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '33333333-3333-4333-8333-333333333333', 'integration_client'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-1111-4111-8111-111111111111', 'integration_client');

INSERT INTO identity.human_subjects (
  id, tenant_id, principal_id, provider_id, issuer_sha256, subject_sha256
) VALUES
  ('44444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '11111111-1111-4111-8111-111111111111', 'approved-provider',
   digest('https://issuer.example', 'sha256'), digest('opaque-subject-a', 'sha256')),
  ('55555555-5555-4555-8555-555555555555', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
   '22222222-2222-4222-8222-222222222222', 'approved-provider',
   digest('https://issuer.example', 'sha256'), digest('opaque-subject-b', 'sha256')),
  ('aaaaaaaa-2222-4222-8222-222222222222', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'aaaaaaaa-1111-4111-8111-111111111111', 'approved-provider',
   digest('https://issuer.example', 'sha256'), digest('integration-only-human', 'sha256'));

SET ROLE la_muni_human_runtime_test;

DO $gate$
DECLARE
  created_id UUID;
  consumed_count INTEGER;
  replay_count INTEGER;
  code_first BOOLEAN;
  code_replay BOOLEAN;
  membership_count INTEGER;
  membership_roles TEXT[];
  integration_only_count INTEGER;
  integration_only_created BOOLEAN;
  created_session BOOLEAN;
  authenticated_count INTEGER;
  rotated BOOLEAN;
  old_count INTEGER;
  new_count INTEGER;
  revoked_count INTEGER;
BEGIN
  created_id := identity.create_human_login_transaction(
    digest('state-value-00000000000000000000000000000001', 'sha256'),
    digest('browser-binding-00000000000000000000000001', 'sha256'),
    'approved-provider',
    repeat('p', 48),
    '/app',
    statement_timestamp() + interval '5 minutes'
  );
  IF created_id IS NULL THEN
    RAISE EXCEPTION 'login transaction was not created';
  END IF;

  SELECT count(*) INTO consumed_count
  FROM identity.consume_human_login_transaction(
    digest('state-value-00000000000000000000000000000001', 'sha256'),
    digest('browser-binding-00000000000000000000000001', 'sha256'),
    'approved-provider',
    statement_timestamp()
  );
  IF consumed_count <> 1 THEN
    RAISE EXCEPTION 'valid state and browser binding were not consumed exactly once';
  END IF;

  SELECT count(*) INTO replay_count
  FROM identity.consume_human_login_transaction(
    digest('state-value-00000000000000000000000000000001', 'sha256'),
    digest('browser-binding-00000000000000000000000001', 'sha256'),
    'approved-provider',
    statement_timestamp()
  );
  IF replay_count <> 0 THEN
    RAISE EXCEPTION 'login state replay was accepted';
  END IF;

  code_first := identity.claim_human_authorization_code(
    'approved-provider', digest('authorization-code-secret', 'sha256'),
    statement_timestamp() + interval '10 minutes'
  );
  code_replay := identity.claim_human_authorization_code(
    'approved-provider', digest('authorization-code-secret', 'sha256'),
    statement_timestamp() + interval '10 minutes'
  );
  IF code_first IS DISTINCT FROM true OR code_replay IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'authorization code replay protection failed';
  END IF;

  SELECT count(*), min(roles) INTO membership_count, membership_roles
  FROM identity.resolve_human_membership(
    'approved-provider', digest('https://issuer.example', 'sha256'),
    digest('opaque-subject-a', 'sha256')
  );
  IF membership_count <> 1 OR membership_roles <> ARRAY['viewer']::TEXT[] THEN
    RAISE EXCEPTION 'local membership resolution failed or accepted provider role claims';
  END IF;

  IF EXISTS (
    SELECT 1 FROM identity.resolve_human_membership(
      'approved-provider', digest('https://issuer.example', 'sha256'),
      digest('missing-subject', 'sha256')
    )
  ) THEN
    RAISE EXCEPTION 'unknown human subject resolved';
  END IF;

  SELECT count(*) INTO integration_only_count
  FROM identity.resolve_human_membership(
    'approved-provider', digest('https://issuer.example', 'sha256'),
    digest('integration-only-human', 'sha256')
  );
  IF integration_only_count <> 0 THEN
    RAISE EXCEPTION 'integration-only role was accepted as human membership';
  END IF;

  integration_only_created := identity.create_human_session(
    'aaaaaaaa-3333-4333-8333-333333333333',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-1111-4111-8111-111111111111',
    'aaaaaaaa-2222-4222-8222-222222222222',
    digest('integration-only-session', 'sha256'),
    digest('integration-only-csrf', 'sha256'),
    statement_timestamp(),
    statement_timestamp() + interval '1 hour',
    1
  );
  IF integration_only_created IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'integration-only human session was created';
  END IF;

  created_session := identity.create_human_session(
    '66666666-6666-4666-8666-666666666666',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444',
    digest('raw-session-token-one', 'sha256'),
    digest('raw-csrf-token-one', 'sha256'),
    statement_timestamp(),
    statement_timestamp() + interval '1 hour',
    1
  );
  IF created_session IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'session creation failed';
  END IF;

  SELECT count(*) INTO authenticated_count
  FROM identity.authenticate_human_session(
    digest('raw-session-token-one', 'sha256'), statement_timestamp()
  );
  IF authenticated_count <> 1 THEN
    RAISE EXCEPTION 'active session did not authenticate';
  END IF;

  IF EXISTS (
    SELECT 1 FROM identity.authenticate_human_session(
      digest('raw-session-token-one', 'sha256'),
      statement_timestamp() - interval '1 day'
    )
  ) THEN
    RAISE EXCEPTION 'caller-supplied stale clock bypassed session authentication';
  END IF;

  rotated := identity.rotate_human_session(
    digest('raw-session-token-one', 'sha256'),
    '77777777-7777-4777-8777-777777777777',
    digest('raw-session-token-two', 'sha256'),
    digest('raw-csrf-token-two', 'sha256'),
    statement_timestamp(),
    statement_timestamp() + interval '1 hour',
    2
  );
  IF rotated IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'session rotation failed';
  END IF;

  SELECT count(*) INTO old_count
  FROM identity.authenticate_human_session(
    digest('raw-session-token-one', 'sha256'), statement_timestamp()
  );
  SELECT count(*) INTO new_count
  FROM identity.authenticate_human_session(
    digest('raw-session-token-two', 'sha256'), statement_timestamp()
  );
  IF old_count <> 0 OR new_count <> 1 THEN
    RAISE EXCEPTION 'rotation did not revoke old token and preserve replacement';
  END IF;

  PERFORM identity.record_human_session_audit(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    '77777777-7777-4777-8777-777777777777',
    '88888888-8888-4888-8888-888888888888',
    'identity.human_session_rotated', 'success', 'session_rotated'
  );
  PERFORM identity.record_human_auth_failure(
    '99999999-9999-4999-8999-999999999999', 'code_replay'
  );

  SELECT count(*) INTO revoked_count
  FROM identity.revoke_human_session(
    digest('raw-session-token-two', 'sha256'), statement_timestamp()
  );
  IF revoked_count <> 1 OR EXISTS (
    SELECT 1 FROM identity.authenticate_human_session(
      digest('raw-session-token-two', 'sha256'), statement_timestamp()
    )
  ) THEN
    RAISE EXCEPTION 'session revocation failed';
  END IF;
END;
$gate$;

DO $gate$
DECLARE
  visible_without_tenant INTEGER;
  visible_tenant_a INTEGER;
  visible_tenant_b INTEGER;
BEGIN
  SELECT count(*) INTO visible_without_tenant FROM identity.human_subjects;
  IF visible_without_tenant <> 0 THEN
    RAISE EXCEPTION 'human subjects were visible without tenant context';
  END IF;

  PERFORM set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
  SELECT count(*) INTO visible_tenant_a FROM identity.human_subjects;
  IF visible_tenant_a <> 2 THEN
    RAISE EXCEPTION 'tenant A human subject visibility failed: %', visible_tenant_a;
  END IF;

  PERFORM set_config('app.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
  SELECT count(*) INTO visible_tenant_b FROM identity.human_subjects;
  IF visible_tenant_b <> 1 THEN
    RAISE EXCEPTION 'tenant B human subject visibility failed: %', visible_tenant_b;
  END IF;
END;
$gate$;

RESET ROLE;

DO $gate$
DECLARE
  audit_details TEXT;
BEGIN
  SELECT details::text INTO audit_details
  FROM audit.events
  WHERE entity_table = 'human_sessions'
  ORDER BY created_at DESC
  LIMIT 1;

  IF audit_details IS NULL
    OR audit_details ~ 'raw-session|raw-csrf|authorization-code|opaque-subject|issuer.example'
    OR audit_details !~ 'reasonCode'
    OR audit_details !~ 'requestId'
    OR audit_details !~ 'sessionId'
  THEN
    RAISE EXCEPTION 'human session audit was absent or leaked forbidden material: %', audit_details;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM identity.human_auth_failure_buckets
    WHERE reason_code = 'code_replay' AND failure_count = 1
  ) THEN
    RAISE EXCEPTION 'human auth failure aggregation was not recorded';
  END IF;
END;
$gate$;
