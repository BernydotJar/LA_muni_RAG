-- Reapply reviewed runtime grants to an isolated logical restore target.
-- The dump intentionally excludes ACLs; platform provisioning owns this step.
\set ON_ERROR_STOP on

DO $gate$
BEGIN
  IF current_database() <> 'la_muni_rag_restore_target' THEN
    RAISE EXCEPTION 'restore runtime gate requires la_muni_rag_restore_target';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'la_muni_runtime_test') THEN
    RAISE EXCEPTION 'expected disposable runtime role is absent';
  END IF;
END;
$gate$;

GRANT CONNECT ON DATABASE la_muni_rag_restore_target TO la_muni_runtime_test;
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

DO $gate$
DECLARE protected_table REGCLASS;
DECLARE enabled BOOLEAN;
DECLARE forced BOOLEAN;
BEGIN
  IF (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = 'la_muni_runtime_test') THEN
    RAISE EXCEPTION 'restored runtime role must not bypass RLS';
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
      RAISE EXCEPTION 'restored table % lost forced RLS', protected_table;
    END IF;
  END LOOP;
  IF has_table_privilege('la_muni_runtime_test', 'rag.procedure_cases', 'DELETE')
     OR has_table_privilege('la_muni_runtime_test', 'rag.procedure_case_events', 'UPDATE')
     OR has_table_privilege('la_muni_runtime_test', 'audit.procedure_case_authentication_failures', 'SELECT') THEN
    RAISE EXCEPTION 'restored runtime privilege boundary is too broad';
  END IF;
END;
$gate$;

SET ROLE la_muni_runtime_test;
DO $gate$
DECLARE visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM rag.procedure_cases;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'missing tenant context exposed restored procedure cases';
  END IF;
  PERFORM set_config('app.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', false);
  SELECT count(*) INTO visible_count FROM rag.procedure_cases;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'tenant B saw restored tenant A procedure cases';
  END IF;
  RESET app.tenant_id;
END;
$gate$;
RESET ROLE;

SELECT json_build_object(
  'result', 'restored_runtime_access_gate_passed',
  'runtime_role_bypasses_rls', false,
  'forced_rls_preserved', true,
  'cross_tenant_state_visible', false
);
