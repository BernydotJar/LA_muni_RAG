\set ON_ERROR_STOP on

-- Supplemental destructive assertions for the disposable procedure-query DB.
DO $gate$
BEGIN
  IF current_database() <> 'la_muni_rag_test' THEN
    RAISE EXCEPTION 'claim pack runtime gate requires la_muni_rag_test';
  END IF;
END;
$gate$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  integration.claim_pack_idempotency,
  integration.claim_pack_rate_limits
  TO la_muni_runtime_test;
GRANT EXECUTE ON FUNCTION
  audit.record_claim_pack_authentication_failure(UUID, UUID, TEXT)
  TO la_muni_runtime_test;

DO $gate$
DECLARE
  idem_rls BOOLEAN;
  idem_force BOOLEAN;
  rate_rls BOOLEAN;
  rate_force BOOLEAN;
  owns_protected BOOLEAN;
BEGIN
  SELECT relrowsecurity, relforcerowsecurity
  INTO idem_rls, idem_force
  FROM pg_class
  WHERE oid = 'integration.claim_pack_idempotency'::regclass;
  SELECT relrowsecurity, relforcerowsecurity
  INTO rate_rls, rate_force
  FROM pg_class
  WHERE oid = 'integration.claim_pack_rate_limits'::regclass;
  IF NOT idem_rls OR NOT idem_force OR NOT rate_rls OR NOT rate_force THEN
    RAISE EXCEPTION 'ClaimPack state tables must enable and force RLS';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE oid IN (
      'integration.claim_pack_idempotency'::regclass,
      'integration.claim_pack_rate_limits'::regclass
    )
      AND pg_get_userbyid(relowner) = 'la_muni_runtime_test'
  ) INTO owns_protected;
  IF owns_protected THEN
    RAISE EXCEPTION 'ClaimPack runtime role owns a protected table';
  END IF;
END;
$gate$;

SET ROLE la_muni_runtime_test;

DO $gate$
DECLARE
  visible_idempotency INTEGER;
  visible_rates INTEGER;
BEGIN
  SELECT count(*) INTO visible_idempotency FROM integration.claim_pack_idempotency;
  SELECT count(*) INTO visible_rates FROM integration.claim_pack_rate_limits;
  IF visible_idempotency <> 0 OR visible_rates <> 0 THEN
    RAISE EXCEPTION 'missing tenant context exposed ClaimPack state';
  END IF;

  PERFORM set_config('app.tenant_id', 'malformed-tenant', false);
  SELECT count(*) INTO visible_idempotency FROM integration.claim_pack_idempotency;
  SELECT count(*) INTO visible_rates FROM integration.claim_pack_rate_limits;
  IF visible_idempotency <> 0 OR visible_rates <> 0 THEN
    RAISE EXCEPTION 'malformed tenant context exposed ClaimPack state';
  END IF;
  RESET app.tenant_id;
END;
$gate$;

DO $gate$
BEGIN
  BEGIN
    PERFORM 1 FROM audit.claim_pack_authentication_failures;
    RAISE EXCEPTION 'runtime role unexpectedly read ClaimPack authentication storage';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$gate$;

DO $gate$
DECLARE
  first_audit UUID;
  repeated_audit UUID;
BEGIN
  SELECT audit.record_claim_pack_authentication_failure(
    '13131313-1313-4313-8313-131313131313',
    '14141414-1414-4414-8414-141414141414',
    'credential_rejected'
  ) INTO first_audit;
  SELECT audit.record_claim_pack_authentication_failure(
    '15151515-1515-4515-8515-151515151515',
    '16161616-1616-4616-8616-161616161616',
    'credential_rejected'
  ) INTO repeated_audit;
  IF first_audit IS DISTINCT FROM repeated_audit THEN
    RAISE EXCEPTION 'ClaimPack authentication failures did not aggregate';
  END IF;
END;
$gate$;

BEGIN;
SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

DO $gate$
BEGIN
  BEGIN
    INSERT INTO integration.claim_pack_idempotency (
      tenant_id,
      principal_id,
      idempotency_key_sha256,
      request_sha256,
      state,
      expires_at
    ) VALUES (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '99999999-9999-4999-8999-999999999999',
      digest('claim-cross-tenant-key', 'sha256'),
      digest('claim-cross-tenant-request', 'sha256'),
      'processing',
      statement_timestamp() + interval '1 hour'
    );
    RAISE EXCEPTION 'tenant A unexpectedly inserted tenant B ClaimPack state';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$gate$;

INSERT INTO integration.claim_pack_idempotency (
  tenant_id,
  principal_id,
  idempotency_key_sha256,
  request_sha256,
  state,
  expires_at
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '77777777-7777-4777-8777-777777777777',
  digest('claim-shared-runtime-key', 'sha256'),
  digest('claim-tenant-a-request', 'sha256'),
  'processing',
  statement_timestamp() + interval '1 hour'
);

DO $gate$
BEGIN
  BEGIN
    UPDATE integration.claim_pack_idempotency
    SET
      state = 'completed',
      response_status = 500,
      response_body = '{}',
      audit_id = '17171717-1717-4717-8717-171717171717',
      completed_at = statement_timestamp()
    WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND idempotency_key_sha256 = digest('claim-shared-runtime-key', 'sha256');
    RAISE EXCEPTION 'ClaimPack state accepted a non-success replay';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END;
$gate$;

DELETE FROM integration.claim_pack_idempotency
WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND idempotency_key_sha256 = digest('claim-shared-runtime-key', 'sha256');
COMMIT;

BEGIN;
SELECT set_config('app.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
INSERT INTO integration.claim_pack_idempotency (
  tenant_id,
  principal_id,
  idempotency_key_sha256,
  request_sha256,
  state,
  expires_at
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '99999999-9999-4999-8999-999999999999',
  digest('claim-shared-runtime-key', 'sha256'),
  digest('claim-tenant-b-request', 'sha256'),
  'processing',
  statement_timestamp() + interval '1 hour'
);
DELETE FROM integration.claim_pack_idempotency
WHERE tenant_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  AND idempotency_key_sha256 = digest('claim-shared-runtime-key', 'sha256');
COMMIT;

RESET ROLE;

DO $gate$
DECLARE
  aggregate_count BIGINT;
BEGIN
  SELECT failure_count
  INTO aggregate_count
  FROM audit.claim_pack_authentication_failures
  WHERE audit_id = '13131313-1313-4313-8313-131313131313';
  IF aggregate_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'expected ClaimPack auth failure aggregate count 2, found %', aggregate_count;
  END IF;
END;
$gate$;

SELECT json_build_object(
  'result', 'claim_pack_sql_gate_passed',
  'postgres_version', current_setting('server_version'),
  'vector_version', (SELECT extversion FROM pg_extension WHERE extname = 'vector'),
  'cross_tenant_state_visible', false
);
