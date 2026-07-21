-- Guarded disposable PostgreSQL gate for ProcedureCase v1.
\set ON_ERROR_STOP on

DO $gate$
BEGIN
  IF current_database() <> 'la_muni_rag_test' THEN
    RAISE EXCEPTION 'procedure case gate requires la_muni_rag_test';
  END IF;
END;
$gate$;

GRANT CONNECT ON DATABASE la_muni_rag_test TO la_muni_runtime_test;
GRANT USAGE ON SCHEMA identity, rag, audit, integration TO la_muni_runtime_test;
GRANT EXECUTE ON FUNCTION identity.authenticate_api_credential(BYTEA)
  TO la_muni_runtime_test;
GRANT EXECUTE ON FUNCTION audit.record_procedure_case_authentication_failure(UUID, TEXT)
  TO la_muni_runtime_test;
GRANT SELECT ON rag.procedure_versions, rag.document_versions TO la_muni_runtime_test;
GRANT SELECT, INSERT, UPDATE ON
  rag.procedure_cases,
  rag.procedure_case_steps,
  rag.procedure_case_documents,
  rag.procedure_case_blockers
TO la_muni_runtime_test;
GRANT SELECT, INSERT ON rag.procedure_case_events TO la_muni_runtime_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  integration.procedure_case_idempotency,
  integration.procedure_case_rate_limits
TO la_muni_runtime_test;
GRANT INSERT ON audit.events TO la_muni_runtime_test;

-- Reuse the author credential created by workflow_lifecycle_runtime_gate.sql and
-- grant its principal case operations without creating another secret fixture.
INSERT INTO identity.memberships (tenant_id, principal_id, role)
VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '15151515-1515-4515-8515-151515151515',
  'case_operator'
)
ON CONFLICT DO NOTHING;

DO $gate$
DECLARE
  protected_table REGCLASS;
  enabled BOOLEAN;
  forced BOOLEAN;
BEGIN
  IF (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = 'la_muni_runtime_test') THEN
    RAISE EXCEPTION 'procedure case runtime role must not bypass RLS';
  END IF;
  FOREACH protected_table IN ARRAY ARRAY[
    'rag.procedure_cases'::regclass,
    'rag.procedure_case_steps'::regclass,
    'rag.procedure_case_documents'::regclass,
    'rag.procedure_case_blockers'::regclass,
    'rag.procedure_case_events'::regclass,
    'integration.procedure_case_idempotency'::regclass,
    'integration.procedure_case_rate_limits'::regclass
  ] LOOP
    SELECT relrowsecurity, relforcerowsecurity INTO enabled, forced
    FROM pg_class WHERE oid = protected_table;
    IF enabled IS DISTINCT FROM true OR forced IS DISTINCT FROM true THEN
      RAISE EXCEPTION '% must enable and force RLS', protected_table;
    END IF;
    IF pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = protected_table)) = 'la_muni_runtime_test' THEN
      RAISE EXCEPTION 'runtime role owns protected table %', protected_table;
    END IF;
  END LOOP;
  IF has_table_privilege('la_muni_runtime_test', 'rag.procedure_cases', 'DELETE')
     OR has_table_privilege('la_muni_runtime_test', 'rag.procedure_case_events', 'UPDATE')
     OR has_table_privilege('la_muni_runtime_test', 'rag.procedure_case_events', 'DELETE')
     OR has_table_privilege('la_muni_runtime_test', 'audit.procedure_case_authentication_failures', 'SELECT') THEN
    RAISE EXCEPTION 'procedure case privilege boundary is too broad';
  END IF;
END;
$gate$;

SET ROLE la_muni_runtime_test;

DO $gate$
DECLARE
  visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM rag.procedure_cases;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'missing tenant context exposed procedure cases';
  END IF;
  PERFORM set_config('app.tenant_id', 'malformed-tenant', false);
  SELECT count(*) INTO visible_count FROM rag.procedure_cases;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'malformed tenant context exposed procedure cases';
  END IF;
  RESET app.tenant_id;
  BEGIN
    PERFORM 1 FROM audit.procedure_case_authentication_failures;
    RAISE EXCEPTION 'runtime role unexpectedly read case authentication failures';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$gate$;

DO $gate$
DECLARE audit_identity UUID;
BEGIN
  SELECT audit.record_procedure_case_authentication_failure(
    '53535353-5353-4353-8353-535353535353', 'credential_rejected'
  ) INTO audit_identity;
  IF audit_identity IS DISTINCT FROM '53535353-5353-4353-8353-535353535353'::uuid THEN
    RAISE EXCEPTION 'authentication sink changed audit identity';
  END IF;
END;
$gate$;

BEGIN;
SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

INSERT INTO rag.procedures (
  id, tenant_id, procedure_key, title, jurisdiction, created_by_principal_id
) VALUES (
  '61616161-6161-4161-8161-616161616161',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'procedure-case-http-fixture',
  'Procedure case HTTP fixture',
  'Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala',
  '15151515-1515-4515-8515-151515151515'
);

INSERT INTO rag.procedure_versions (
  id, tenant_id, procedure_id, version_number, lifecycle_status,
  generation_source, created_by_principal_id, title, jurisdiction,
  workflow_definition
) VALUES (
  '62626262-6262-4262-8262-626262626262',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '61616161-6161-4161-8161-616161616161',
  1, 'draft', 'human',
  '15151515-1515-4515-8515-151515151515',
  'Approved workflow with case steps',
  'Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala',
  '{"schema_version":"v1","approval_status":"draft","steps":[{"step_id":"need-intake","title":"Registrar necesidad comunitaria","action":"Registrar necesidad comunitaria"},{"step_id":"technical-review","title":"Revisar viabilidad técnica","action":"Revisar viabilidad técnica"}]}'::jsonb
);

UPDATE rag.procedure_versions
SET lifecycle_status = 'in_review',
    submitted_by_principal_id = '15151515-1515-4515-8515-151515151515',
    submitted_at = statement_timestamp()
WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND id = '62626262-6262-4262-8262-626262626262';

INSERT INTO rag.workflow_reviews (
  id, tenant_id, workflow_version_id, reviewer_principal_id, decision, notes
) VALUES (
  '63636363-6363-4363-8363-636363636363',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '62626262-6262-4262-8262-626262626262',
  '16161616-1616-4616-8616-161616161616',
  'recommended_for_approval',
  'Reviewed for the procedure case HTTP fixture.'
);

INSERT INTO rag.workflow_approvals (
  id, tenant_id, workflow_version_id, approver_principal_id, decision, notes
) VALUES (
  '64646464-6464-4464-8464-646464646464',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '62626262-6262-4262-8262-626262626262',
  '17171717-1717-4717-8717-171717171717',
  'approved',
  'Approved for the procedure case HTTP fixture.'
);

UPDATE rag.procedure_versions
SET lifecycle_status = 'approved',
    approved_by_principal_id = '17171717-1717-4717-8717-171717171717',
    approved_at = statement_timestamp()
WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND id = '62626262-6262-4262-8262-626262626262';

-- 3434 is superseded. A superseded version must not seed a new case.
DO $gate$
BEGIN
  BEGIN
    INSERT INTO rag.procedure_cases (
      id, tenant_id, case_key, workflow_version_id, workflow_version_number,
      jurisdiction, created_by_principal_id, updated_by_principal_id,
      create_request_sha256
    ) VALUES (
      '66666666-6666-4666-8666-666666666666',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'case-from-superseded-must-fail',
      '34343434-3434-4434-8434-343434343434',
      1,
      'Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala',
      '15151515-1515-4515-8515-151515151515',
      '15151515-1515-4515-8515-151515151515',
      digest('superseded-case-request', 'sha256')
    );
    RAISE EXCEPTION 'case accepted a non-approved workflow';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'case accepted a non-approved workflow' THEN RAISE; END IF;
  END;
END;
$gate$;

INSERT INTO rag.procedure_cases (
  id, tenant_id, case_key, workflow_version_id, workflow_version_number,
  jurisdiction, community_reference, current_step_id,
  created_by_principal_id, updated_by_principal_id, create_request_sha256
) VALUES (
  '67676767-6767-4767-8767-676767676767',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'water-community-runtime-case-001',
  '62626262-6262-4262-8262-626262626262',
  1,
  'Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala',
  'community:runtime-fixture',
  'need-intake',
  '15151515-1515-4515-8515-151515151515',
  '15151515-1515-4515-8515-151515151515',
  digest('procedure-case-runtime-request', 'sha256')
);

UPDATE rag.procedure_cases
SET initial_response_status = 201,
    initial_response_body = '{"schema_version":"v1","case":"sealed"}',
    initial_response_sha256 = digest('{"schema_version":"v1","case":"sealed"}', 'sha256'),
    initial_audit_id = '72727272-7272-4272-8272-727272727272'
WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND id = '67676767-6767-4767-8767-676767676767';

DO $gate$
BEGIN
  BEGIN
    INSERT INTO rag.procedure_cases (
      id, tenant_id, case_key, workflow_version_id, workflow_version_number,
      jurisdiction, created_by_principal_id, updated_by_principal_id,
      create_request_sha256
    ) VALUES (
      '73737373-7373-4373-8373-737373737373',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'duplicate-create-request-must-fail',
      '62626262-6262-4262-8262-626262626262',
      1,
      'Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala',
      '15151515-1515-4515-8515-151515151515',
      '15151515-1515-4515-8515-151515151515',
      digest('procedure-case-runtime-request', 'sha256')
    );
    RAISE EXCEPTION 'duplicate create request produced a second case';
  EXCEPTION WHEN unique_violation THEN NULL;
  WHEN raise_exception THEN IF SQLERRM = 'duplicate create request produced a second case' THEN RAISE; END IF;
  END;
END;
$gate$;

INSERT INTO rag.procedure_case_steps (
  case_id, tenant_id, step_id, title, ordinal, updated_by_principal_id
) VALUES (
  '67676767-6767-4767-8767-676767676767',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'need-intake',
  'Registrar necesidad comunitaria',
  1,
  '15151515-1515-4515-8515-151515151515'
);

INSERT INTO rag.procedure_case_events (
  id, tenant_id, case_id, actor_principal_id, event_type, revision, details
) VALUES (
  '68686868-6868-4868-8868-686868686868',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '67676767-6767-4767-8767-676767676767',
  '15151515-1515-4515-8515-151515151515',
  'procedure_case.created',
  1,
  '{"workflow_version_id":"62626262-6262-4262-8262-626262626262","workflow_version_number":1}'::jsonb
);

DO $gate$
BEGIN
  BEGIN
    UPDATE rag.procedure_cases
    SET workflow_version_id = '34343434-3434-4434-8434-343434343434',
        workflow_version_number = 1,
        revision = revision + 1
    WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND id = '67676767-6767-4767-8767-676767676767';
    RAISE EXCEPTION 'case workflow binding was mutable';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'case workflow binding was mutable' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE rag.procedure_cases
    SET status = 'blocked'
    WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND id = '67676767-6767-4767-8767-676767676767';
    RAISE EXCEPTION 'case revision did not advance';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'case revision did not advance' THEN RAISE; END IF;
  END;
END;
$gate$;

UPDATE rag.procedure_cases
SET status = 'blocked', revision = revision + 1,
    updated_by_principal_id = '15151515-1515-4515-8515-151515151515'
WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND id = '67676767-6767-4767-8767-676767676767';

INSERT INTO rag.procedure_case_events (
  id, tenant_id, case_id, actor_principal_id, event_type, revision, details
) VALUES (
  '69696969-6969-4969-8969-696969696969',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '67676767-6767-4767-8767-676767676767',
  '15151515-1515-4515-8515-151515151515',
  'procedure_case.add_blocker',
  2,
  '{"action":"add_blocker","blocker_code":"missing_source"}'::jsonb
);

DO $gate$
BEGIN
  BEGIN
    UPDATE rag.procedure_case_events SET details = '{"changed":true}'::jsonb
    WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND id = '68686868-6868-4868-8868-686868686868';
    RAISE EXCEPTION 'case event was mutable';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  WHEN raise_exception THEN IF SQLERRM = 'case event was mutable' THEN RAISE; END IF;
  END;
END;
$gate$;

INSERT INTO integration.procedure_case_idempotency (
  tenant_id, principal_id, operation, idempotency_key_sha256,
  request_sha256, state, response_status, response_body, response_sha256,
  audit_id, created_at, completed_at, expires_at
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '15151515-1515-4515-8515-151515151515',
  'procedure_case_create_v1',
  digest('procedure-case-gate-key', 'sha256'),
  digest('procedure-case-gate-request', 'sha256'),
  'completed', 201, '{"schema_version":"v1"}',
  digest('{"schema_version":"v1"}', 'sha256'),
  '70707070-7070-4070-8070-707070707070',
  statement_timestamp(), statement_timestamp(), statement_timestamp() + interval '1 hour'
);

DO $gate$
BEGIN
  BEGIN
    UPDATE integration.procedure_case_idempotency
    SET response_body = '{"corrupt":true}'
    WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND principal_id = '15151515-1515-4515-8515-151515151515'
      AND operation = 'procedure_case_create_v1'
      AND idempotency_key_sha256 = digest('procedure-case-gate-key', 'sha256');
    RAISE EXCEPTION 'replay hash constraint was bypassed';
  EXCEPTION WHEN check_violation THEN NULL;
  WHEN raise_exception THEN IF SQLERRM = 'replay hash constraint was bypassed' THEN RAISE; END IF;
  END;
END;
$gate$;

COMMIT;

BEGIN;
SELECT set_config('app.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);
DO $gate$
DECLARE visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM rag.procedure_cases;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'tenant B saw % tenant A procedure cases', visible_count;
  END IF;
END;
$gate$;
ROLLBACK;

RESET ROLE;
SELECT json_build_object(
  'result', 'procedure_case_runtime_gate_passed',
  'postgres_version', current_setting('server_version'),
  'approved_workflow_binding', true,
  'forced_rls', true,
  'append_only_audit', true,
  'exact_replay_hash', true,
  'cross_tenant_denial', true
);
