-- Guarded disposable PostgreSQL gate for EvidenceGapRequest v1.
\set ON_ERROR_STOP on

DO $gate$
BEGIN
  IF current_database() <> 'la_muni_rag_test' THEN
    RAISE EXCEPTION 'evidence gap gate requires la_muni_rag_test';
  END IF;
END;
$gate$;

GRANT CONNECT ON DATABASE la_muni_rag_test TO la_muni_runtime_test;
GRANT USAGE ON SCHEMA identity, rag, audit, integration TO la_muni_runtime_test;
GRANT EXECUTE ON FUNCTION identity.authenticate_api_credential(BYTEA)
  TO la_muni_runtime_test;
GRANT EXECUTE ON FUNCTION
  audit.record_evidence_gap_authentication_failure(UUID, UUID, TEXT)
  TO la_muni_runtime_test;
GRANT SELECT, INSERT ON rag.evidence_gap_requests TO la_muni_runtime_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  integration.evidence_gap_idempotency,
  integration.evidence_gap_rate_limits
TO la_muni_runtime_test;
GRANT INSERT ON audit.events TO la_muni_runtime_test;

DO $gate$
DECLARE
  is_super BOOLEAN;
  bypasses_rls BOOLEAN;
  table_name TEXT;
  row_security BOOLEAN;
  force_row_security BOOLEAN;
BEGIN
  SELECT rolsuper, rolbypassrls
  INTO is_super, bypasses_rls
  FROM pg_roles
  WHERE rolname = 'la_muni_runtime_test';

  IF is_super IS DISTINCT FROM false OR bypasses_rls IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'EvidenceGap runtime role must not be superuser or bypass RLS';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'rag.evidence_gap_requests',
    'integration.evidence_gap_idempotency',
    'integration.evidence_gap_rate_limits'
  ] LOOP
    SELECT relrowsecurity, relforcerowsecurity
    INTO row_security, force_row_security
    FROM pg_class
    WHERE oid = table_name::regclass;
    IF row_security IS DISTINCT FROM true OR force_row_security IS DISTINCT FROM true THEN
      RAISE EXCEPTION '% must enable and force RLS', table_name;
    END IF;
  END LOOP;

  IF has_table_privilege('la_muni_runtime_test', 'rag.evidence_gap_requests', 'UPDATE')
     OR has_table_privilege('la_muni_runtime_test', 'rag.evidence_gap_requests', 'DELETE') THEN
    RAISE EXCEPTION 'runtime role must not mutate immutable EvidenceGap aggregates';
  END IF;
  IF has_table_privilege(
    'la_muni_runtime_test',
    'audit.evidence_gap_authentication_failures',
    'SELECT'
  ) THEN
    RAISE EXCEPTION 'runtime role must not read pre-tenant authentication storage';
  END IF;
END;
$gate$;

SET ROLE la_muni_runtime_test;

DO $gate$
DECLARE
  visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM rag.evidence_gap_requests;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'missing tenant context exposed % evidence gaps', visible_count;
  END IF;

  PERFORM set_config('app.tenant_id', 'malformed-tenant', false);
  SELECT count(*) INTO visible_count FROM rag.evidence_gap_requests;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'malformed tenant context exposed % evidence gaps', visible_count;
  END IF;
  RESET app.tenant_id;
END;
$gate$;

DO $gate$
BEGIN
  BEGIN
    PERFORM 1 FROM audit.evidence_gap_authentication_failures;
    RAISE EXCEPTION 'runtime role unexpectedly read EvidenceGap authentication storage';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$gate$;

DO $gate$
DECLARE
  authenticated_tenant UUID;
  first_audit UUID;
  repeated_audit UUID;
BEGIN
  SELECT tenant_id
  INTO authenticated_tenant
  FROM identity.authenticate_api_credential(
    digest('disposable-tenant-a-api-token-20260718', 'sha256')
  );
  IF authenticated_tenant IS DISTINCT FROM 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid THEN
    RAISE EXCEPTION 'credential authentication returned the wrong EvidenceGap tenant';
  END IF;

  SELECT audit.record_evidence_gap_authentication_failure(
    '15151515-1515-4515-8515-151515151515',
    '16161616-1616-4616-8616-161616161616',
    'credential_rejected'
  ) INTO first_audit;
  SELECT audit.record_evidence_gap_authentication_failure(
    '17171717-1717-4717-8717-171717171717',
    '18181818-1818-4818-8818-181818181818',
    'credential_rejected'
  ) INTO repeated_audit;
  IF first_audit IS DISTINCT FROM repeated_audit THEN
    RAISE EXCEPTION 'EvidenceGap authentication failures did not aggregate';
  END IF;
END;
$gate$;

BEGIN;
SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

INSERT INTO rag.evidence_gap_requests (
  tenant_id, id, request_id, requester_product, jurisdiction, subject,
  missing_document, reason, priority, campaign_reference, request_sha256,
  created_by_principal_id, credential_id, original_audit_id,
  response_body, response_sha256, status
)
SELECT
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '19191919-1919-4919-8919-191919191919',
  '20202020-2020-4020-8020-202020202020',
  'os_electoral',
  'Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala',
  'Procedimiento municipal para agua comunitaria',
  'Manual oficial vigente de agua y saneamiento',
  'Se requiere una fuente local para validar responsables y pasos.',
  'critical',
  'campaign-antigua-2027',
  digest('tenant-a-gap-request', 'sha256'),
  '77777777-7777-4777-8777-777777777777',
  '88888888-8888-4888-8888-888888888888',
  '21212121-2121-4121-8121-212121212121',
  body,
  digest(body, 'sha256'),
  'open'
FROM (VALUES ('{"schema_version":"v1","response_type":"evidence_gap_request"}'::text)) AS response(body);

DO $gate$
DECLARE
  visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM rag.evidence_gap_requests;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'tenant A expected one EvidenceGap record, found %', visible_count;
  END IF;

  BEGIN
    INSERT INTO rag.evidence_gap_requests (
      tenant_id, id, request_id, requester_product, jurisdiction, subject,
      missing_document, reason, priority, campaign_reference, request_sha256,
      created_by_principal_id, credential_id, original_audit_id,
      response_body, response_sha256, status
    ) VALUES (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      '22222222-2222-4222-8222-222222222229',
      '23232323-2323-4323-8323-232323232323',
      'os_electoral',
      'Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala',
      'cross tenant marker',
      'cross tenant document',
      'cross tenant reason',
      'high',
      'campaign-cross-tenant',
      digest('cross-tenant-gap', 'sha256'),
      '99999999-9999-4999-8999-999999999999',
      'aaaaaaaa-0000-4000-8000-000000000002',
      '24242424-2424-4424-8424-242424242424',
      '{}',
      digest('{}', 'sha256'),
      'open'
    );
    RAISE EXCEPTION 'tenant A unexpectedly inserted a tenant B EvidenceGap';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO rag.evidence_gap_requests (
      tenant_id, id, request_id, requester_product, jurisdiction, subject,
      missing_document, reason, priority, campaign_reference, request_sha256,
      created_by_principal_id, credential_id, original_audit_id,
      response_body, response_sha256, status
    ) VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '25252525-2525-4525-8525-252525252525',
      '26262626-2626-4626-8626-262626262626',
      'os_electoral',
      'Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala',
      'invalid priority',
      'document',
      'reason',
      'urgent',
      'campaign-invalid-priority',
      digest('invalid-priority-gap', 'sha256'),
      '77777777-7777-4777-8777-777777777777',
      '88888888-8888-4888-8888-888888888888',
      '27272727-2727-4727-8727-272727272727',
      '{}',
      digest('{}', 'sha256'),
      'open'
    );
    RAISE EXCEPTION 'EvidenceGap accepted unsupported urgent priority';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE rag.evidence_gap_requests SET priority = 'low'
    WHERE id = '19191919-1919-4919-8919-191919191919';
    RAISE EXCEPTION 'runtime role unexpectedly updated immutable EvidenceGap';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$gate$;

INSERT INTO integration.evidence_gap_idempotency (
  tenant_id, principal_id, idempotency_key_sha256, request_sha256, state, expires_at
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '77777777-7777-4777-8777-777777777777',
  digest('evidence-gap-shared-key', 'sha256'),
  digest('evidence-gap-shared-request', 'sha256'),
  'processing',
  statement_timestamp() + interval '1 hour'
);

UPDATE integration.evidence_gap_idempotency
SET state = 'completed', response_status = 200, response_body = '{}',
  response_sha256 = digest('{}', 'sha256'),
  audit_id = '28282828-2828-4828-8828-282828282828',
  completed_at = statement_timestamp()
WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND principal_id = '77777777-7777-4777-8777-777777777777'
  AND idempotency_key_sha256 = digest('evidence-gap-shared-key', 'sha256');

DO $gate$
BEGIN
  BEGIN
    UPDATE integration.evidence_gap_idempotency
    SET response_body = '{"tampered":true}'
    WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND principal_id = '77777777-7777-4777-8777-777777777777'
      AND idempotency_key_sha256 = digest('evidence-gap-shared-key', 'sha256');
    RAISE EXCEPTION 'EvidenceGap idempotency accepted a wrong response hash';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END;
$gate$;

DELETE FROM integration.evidence_gap_idempotency
WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND principal_id = '77777777-7777-4777-8777-777777777777'
  AND idempotency_key_sha256 = digest('evidence-gap-shared-key', 'sha256');
COMMIT;

BEGIN;
SELECT set_config('app.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
DO $gate$
DECLARE
  visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM rag.evidence_gap_requests;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'tenant B observed % tenant A EvidenceGap rows', visible_count;
  END IF;
END;
$gate$;

INSERT INTO rag.evidence_gap_requests (
  tenant_id, id, request_id, requester_product, jurisdiction, subject,
  missing_document, reason, priority, campaign_reference, request_sha256,
  created_by_principal_id, credential_id, original_audit_id,
  response_body, response_sha256, status
)
SELECT
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '19191919-1919-4919-8919-191919191919',
  '29292929-2929-4929-8929-292929292929',
  'os_electoral',
  'Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala',
  'TENANT_B_EVIDENCE_GAP_MARKER',
  'tenant B document',
  'tenant B reason',
  'low',
  'campaign-tenant-b',
  digest('tenant-b-gap-request', 'sha256'),
  '99999999-9999-4999-8999-999999999999',
  'aaaaaaaa-0000-4000-8000-000000000002',
  '30303030-3030-4030-8030-303030303030',
  body,
  digest(body, 'sha256'),
  'open'
FROM (VALUES ('{"schema_version":"v1","response_type":"evidence_gap_request"}'::text)) AS response(body);
COMMIT;

RESET ROLE;

BEGIN;
SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
DO $gate$
BEGIN
  BEGIN
    UPDATE rag.evidence_gap_requests
    SET priority = 'medium'
    WHERE id = '19191919-1919-4919-8919-191919191919';
    RAISE EXCEPTION 'migration owner bypassed EvidenceGap immutability trigger';
  EXCEPTION
    WHEN object_not_in_prerequisite_state THEN NULL;
  END;
END;
$gate$;
COMMIT;

DO $gate$
DECLARE
  aggregate_count BIGINT;
BEGIN
  SELECT failure_count
  INTO aggregate_count
  FROM audit.evidence_gap_authentication_failures
  WHERE audit_id = '15151515-1515-4515-8515-151515151515';
  IF aggregate_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'expected two aggregated EvidenceGap auth failures, found %', aggregate_count;
  END IF;
END;
$gate$;

SELECT json_build_object(
  'result', 'evidence_gap_sql_gate_passed',
  'postgres_version', current_setting('server_version'),
  'vector_version', (SELECT extversion FROM pg_extension WHERE extname = 'vector'),
  'runtime_role_bypasses_rls', (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'la_muni_runtime_test'),
  'cross_tenant_state_visible', false,
  'aggregate_immutable', true,
  'response_hash_enforced', true
);
