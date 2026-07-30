\set ON_ERROR_STOP on

-- Destructive assertions for the disposable procedure-query database only.
DO $gate$
BEGIN
  IF current_database() <> 'la_muni_rag_test' THEN
    RAISE EXCEPTION 'workflow lifecycle runtime gate requires la_muni_rag_test';
  END IF;
END;
$gate$;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  rag.procedures,
  rag.procedure_versions,
  rag.workflow_reviews,
  rag.workflow_approvals,
  integration.workflow_lifecycle_idempotency,
  integration.workflow_lifecycle_rate_limits
  TO la_muni_runtime_test;
GRANT EXECUTE ON FUNCTION
  audit.record_workflow_lifecycle_authentication_failure(UUID, UUID, TEXT)
  TO la_muni_runtime_test;

INSERT INTO identity.principals (
  id, tenant_id, principal_kind, external_subject, display_name
)
VALUES
  (
    '15151515-1515-4515-8515-151515151515',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'user',
    'workflow-author-a',
    'Workflow author A'
  ),
  (
    '16161616-1616-4616-8616-161616161616',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'user',
    'workflow-reviewer-a',
    'Workflow reviewer A'
  ),
  (
    '17171717-1717-4717-8717-171717171717',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'user',
    'workflow-approver-a',
    'Workflow approver A'
  ),
  (
    '18181818-1818-4818-8818-181818181818',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'user',
    'workflow-viewer-a',
    'Workflow viewer A'
  ),
  (
    '19191919-1919-4919-8919-191919191919',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'user',
    'workflow-author-b',
    'Workflow author B'
  ),
  (
    '20202020-2020-4020-8020-202020202020',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'user',
    'workflow-viewer-b',
    'Workflow viewer B'
  );

INSERT INTO identity.memberships (tenant_id, principal_id, role)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '15151515-1515-4515-8515-151515151515', 'procedure_author'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '16161616-1616-4616-8616-161616161616', 'procedure_reviewer'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '17171717-1717-4717-8717-171717171717', 'procedure_approver'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '18181818-1818-4818-8818-181818181818', 'viewer'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '19191919-1919-4919-8919-191919191919', 'procedure_author'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '20202020-2020-4020-8020-202020202020', 'viewer');

INSERT INTO identity.api_credentials (
  id, tenant_id, principal_id, label, secret_sha256
)
VALUES
  (
    '21212121-2121-4121-8121-212121212121',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '15151515-1515-4515-8515-151515151515',
    'Disposable workflow author credential',
    digest('workflow-author-api-token-20260721-0000000001', 'sha256')
  ),
  (
    '23232323-2323-4323-8323-232323232323',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '16161616-1616-4616-8616-161616161616',
    'Disposable workflow reviewer credential',
    digest('workflow-reviewer-api-token-20260721-00000001', 'sha256')
  ),
  (
    '24242424-2424-4424-8424-242424242424',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '17171717-1717-4717-8717-171717171717',
    'Disposable workflow approver credential',
    digest('workflow-approver-api-token-20260721-00000001', 'sha256')
  ),
  (
    '25252525-2525-4525-8525-252525252525',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '18181818-1818-4818-8818-181818181818',
    'Disposable workflow viewer credential',
    digest('workflow-viewer-api-token-20260721-0000000001', 'sha256')
  ),
  (
    '26262626-2626-4626-8626-262626262626',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '19191919-1919-4919-8919-191919191919',
    'Disposable workflow author B credential',
    digest('workflow-author-b-api-token-20260721-00000001', 'sha256')
  ),
  (
    '27272727-2727-4727-8727-272727272727',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '20202020-2020-4020-8020-202020202020',
    'Disposable workflow viewer B credential',
    digest('workflow-viewer-b-api-token-20260721-00000001', 'sha256')
  );

DO $gate$
DECLARE
  is_super BOOLEAN;
  bypasses_rls BOOLEAN;
  owns_protected BOOLEAN;
  protected_table REGCLASS;
  enabled BOOLEAN;
  forced BOOLEAN;
BEGIN
  SELECT rolsuper, rolbypassrls
  INTO is_super, bypasses_rls
  FROM pg_roles
  WHERE rolname = 'la_muni_runtime_test';
  IF is_super IS DISTINCT FROM false OR bypasses_rls IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'workflow lifecycle runtime role must not bypass RLS';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE oid IN (
      'rag.procedures'::regclass,
      'rag.procedure_versions'::regclass,
      'rag.workflow_reviews'::regclass,
      'rag.workflow_approvals'::regclass,
      'integration.workflow_lifecycle_idempotency'::regclass,
      'integration.workflow_lifecycle_rate_limits'::regclass
    )
      AND pg_get_userbyid(relowner) = 'la_muni_runtime_test'
  ) INTO owns_protected;
  IF owns_protected THEN
    RAISE EXCEPTION 'workflow lifecycle runtime role owns a protected table';
  END IF;

  FOREACH protected_table IN ARRAY ARRAY[
    'rag.procedures'::regclass,
    'rag.procedure_versions'::regclass,
    'rag.workflow_reviews'::regclass,
    'rag.workflow_approvals'::regclass,
    'integration.workflow_lifecycle_idempotency'::regclass,
    'integration.workflow_lifecycle_rate_limits'::regclass
  ]
  LOOP
    SELECT relrowsecurity, relforcerowsecurity
    INTO enabled, forced
    FROM pg_class
    WHERE oid = protected_table;
    IF NOT enabled OR NOT forced THEN
      RAISE EXCEPTION '% must enable and force RLS', protected_table;
    END IF;
  END LOOP;
END;
$gate$;

SET ROLE la_muni_runtime_test;

DO $gate$
DECLARE
  visible_count INTEGER;
  protected_table REGCLASS;
BEGIN
  FOREACH protected_table IN ARRAY ARRAY[
    'rag.procedures'::regclass,
    'rag.procedure_versions'::regclass,
    'rag.workflow_reviews'::regclass,
    'rag.workflow_approvals'::regclass,
    'integration.workflow_lifecycle_idempotency'::regclass,
    'integration.workflow_lifecycle_rate_limits'::regclass
  ]
  LOOP
    EXECUTE format('SELECT count(*) FROM %s', protected_table) INTO visible_count;
    IF visible_count <> 0 THEN
      RAISE EXCEPTION 'missing tenant context exposed %', protected_table;
    END IF;
  END LOOP;

  PERFORM set_config('app.tenant_id', 'malformed-tenant', false);
  SELECT count(*) INTO visible_count FROM rag.procedures;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'malformed tenant context exposed workflow lifecycle rows';
  END IF;
  RESET app.tenant_id;
END;
$gate$;

DO $gate$
BEGIN
  BEGIN
    PERFORM 1 FROM audit.workflow_lifecycle_authentication_failures;
    RAISE EXCEPTION 'runtime role unexpectedly read workflow authentication storage';
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
  SELECT audit.record_workflow_lifecycle_authentication_failure(
    '28282828-2828-4828-8828-282828282828',
    '29292929-2929-4929-8929-292929292929',
    'credential_rejected'
  ) INTO first_audit;
  SELECT audit.record_workflow_lifecycle_authentication_failure(
    '30303030-3030-4030-8030-303030303030',
    '31313131-3131-4131-8131-313131313131',
    'credential_rejected'
  ) INTO repeated_audit;
  IF first_audit IS DISTINCT FROM repeated_audit THEN
    RAISE EXCEPTION 'workflow authentication failures did not aggregate';
  END IF;
END;
$gate$;

BEGIN;
SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

DO $gate$
BEGIN
  BEGIN
    INSERT INTO rag.procedures (
      id, tenant_id, procedure_key, title, jurisdiction, created_by_principal_id
    ) VALUES (
      '32323232-3232-4232-8232-323232323232',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'cross-tenant-workflow',
      'Cross tenant workflow',
      'Tenant B secret jurisdiction',
      '19191919-1919-4919-8919-191919191919'
    );
    RAISE EXCEPTION 'tenant A unexpectedly inserted tenant B workflow metadata';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;
END;
$gate$;

INSERT INTO rag.procedures (
  id, tenant_id, procedure_key, title, jurisdiction, created_by_principal_id
) VALUES (
  '33333333-3333-4333-8333-333333333330',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'water-community-runtime-gate',
  'Water community runtime gate',
  'Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala',
  '15151515-1515-4515-8515-151515151515'
);

INSERT INTO rag.procedure_versions (
  id, tenant_id, procedure_id, version_number, lifecycle_status,
  generation_source, created_by_principal_id, title, jurisdiction,
  workflow_definition
) VALUES (
  '34343434-3434-4434-8434-343434343434',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '33333333-3333-4333-8333-333333333330',
  1,
  'draft',
  'ai',
  '15151515-1515-4515-8515-151515151515',
  'Water workflow draft',
  'Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala',
  '{"schema_version":"v1","approval_status":"draft","gaps":["Documento o regla pendiente de localizar y validar."]}'::jsonb
);

DO $gate$
BEGIN
  BEGIN
    INSERT INTO rag.procedure_versions (
      id, tenant_id, procedure_id, version_number, lifecycle_status,
      generation_source, created_by_principal_id, title, jurisdiction,
      workflow_definition, approved_by_principal_id, approved_at
    ) VALUES (
      '35353535-3535-4535-8535-353535353535',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '33333333-3333-4333-8333-333333333330',
      2,
      'approved',
      'human',
      '15151515-1515-4515-8515-151515151515',
      'Invalid direct approval',
      'Antigua Guatemala',
      '{}'::jsonb,
      '17171717-1717-4717-8717-171717171717',
      statement_timestamp()
    );
    RAISE EXCEPTION 'new workflow version bypassed draft state';
  EXCEPTION
    WHEN raise_exception THEN NULL;
  END;
END;
$gate$;

UPDATE rag.procedure_versions
SET lifecycle_status = 'in_review',
    submitted_by_principal_id = '15151515-1515-4515-8515-151515151515',
    submitted_at = statement_timestamp()
WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND id = '34343434-3434-4434-8434-343434343434';

DO $gate$
BEGIN
  BEGIN
    INSERT INTO rag.workflow_reviews (
      id, tenant_id, workflow_version_id, reviewer_principal_id, decision, notes
    ) VALUES (
      '36363636-3636-4636-8636-363636363636',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      '34343434-3434-4434-8434-343434343434',
      '15151515-1515-4515-8515-151515151515',
      'recommended_for_approval',
      'Creator must not review their own version.'
    );
    RAISE EXCEPTION 'workflow creator reviewed their own version';
  EXCEPTION
    WHEN raise_exception THEN NULL;
  END;
END;
$gate$;

INSERT INTO rag.workflow_reviews (
  id, tenant_id, workflow_version_id, reviewer_principal_id, decision, notes
) VALUES (
  '37373737-3737-4737-8737-373737373737',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '34343434-3434-4434-8434-343434343434',
  '16161616-1616-4616-8616-161616161616',
  'recommended_for_approval',
  'Distinct human reviewer recommends approval with explicit evidence limitations.'
);

INSERT INTO rag.workflow_approvals (
  id, tenant_id, workflow_version_id, approver_principal_id, decision, notes
) VALUES (
  '38383838-3838-4838-8838-383838383838',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '34343434-3434-4434-8434-343434343434',
  '17171717-1717-4717-8717-171717171717',
  'approved',
  'Distinct human approver confirms governance review.'
);

UPDATE rag.procedure_versions
SET lifecycle_status = 'approved',
    approved_by_principal_id = '17171717-1717-4717-8717-171717171717',
    approved_at = statement_timestamp()
WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND id = '34343434-3434-4434-8434-343434343434';

DO $gate$
BEGIN
  BEGIN
    UPDATE rag.procedure_versions
    SET workflow_definition = '{"silently_promoted":true}'::jsonb
    WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND id = '34343434-3434-4434-8434-343434343434';
    RAISE EXCEPTION 'approved workflow content was mutable';
  EXCEPTION
    WHEN raise_exception THEN NULL;
  END;
END;
$gate$;

INSERT INTO rag.procedure_versions (
  id, tenant_id, procedure_id, version_number, lifecycle_status,
  generation_source, created_by_principal_id, title, jurisdiction,
  workflow_definition
) VALUES (
  '41414141-4141-4141-8141-414141414141',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '33333333-3333-4333-8333-333333333330',
  2,
  'draft',
  'human',
  '15151515-1515-4515-8515-151515151515',
  'Reviewed replacement workflow',
  'Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala',
  '{"schema_version":"v1","approval_status":"draft","revision":2}'::jsonb
);

UPDATE rag.procedure_versions
SET lifecycle_status = 'in_review',
    submitted_by_principal_id = '15151515-1515-4515-8515-151515151515',
    submitted_at = statement_timestamp()
WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND id = '41414141-4141-4141-8141-414141414141';

INSERT INTO rag.workflow_reviews (
  id, tenant_id, workflow_version_id, reviewer_principal_id, decision, notes
) VALUES (
  '42424242-4242-4242-8242-424242424242',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '41414141-4141-4141-8141-414141414141',
  '16161616-1616-4616-8616-161616161616',
  'recommended_for_approval',
  'Distinct human reviewer recommends the replacement version.'
);

UPDATE rag.procedure_versions
SET lifecycle_status = 'superseded',
    superseded_by_workflow_version_id = '41414141-4141-4141-8141-414141414141'
WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND id = '34343434-3434-4434-8434-343434343434';

INSERT INTO rag.workflow_approvals (
  id, tenant_id, workflow_version_id, approver_principal_id, decision, notes
) VALUES (
  '43434343-4343-4343-8343-434343434343',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '41414141-4141-4141-8141-414141414141',
  '17171717-1717-4717-8717-171717171717',
  'approved',
  'Replacement approved in the same transaction that superseded the former version.'
);

UPDATE rag.procedure_versions
SET lifecycle_status = 'approved',
    approved_by_principal_id = '17171717-1717-4717-8717-171717171717',
    approved_at = statement_timestamp()
WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND id = '41414141-4141-4141-8141-414141414141';

DO $gate$
DECLARE
  current_status TEXT;
  replacement_status TEXT;
  approved_count INTEGER;
BEGIN
  SELECT lifecycle_status
  INTO current_status
  FROM rag.procedure_versions
  WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    AND id = '34343434-3434-4434-8434-343434343434';
  SELECT lifecycle_status
  INTO replacement_status
  FROM rag.procedure_versions
  WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    AND id = '41414141-4141-4141-8141-414141414141';
  SELECT count(*)
  INTO approved_count
  FROM rag.procedure_versions
  WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    AND procedure_id = '33333333-3333-4333-8333-333333333330'
    AND lifecycle_status = 'approved';
  IF current_status IS DISTINCT FROM 'superseded'
     OR replacement_status IS DISTINCT FROM 'approved'
     OR approved_count <> 1 THEN
    RAISE EXCEPTION 'atomic workflow supersession did not leave exactly one approved replacement';
  END IF;
END;
$gate$;

INSERT INTO integration.workflow_lifecycle_idempotency (
  tenant_id, principal_id, operation, idempotency_key_sha256,
  request_sha256, state, expires_at
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '15151515-1515-4515-8515-151515151515',
  'workflow_draft_create_v1',
  digest('shared-workflow-key', 'sha256'),
  digest('tenant-a-workflow-request', 'sha256'),
  'processing',
  statement_timestamp() + interval '1 hour'
);

DO $gate$
BEGIN
  BEGIN
    UPDATE integration.workflow_lifecycle_idempotency
    SET state = 'completed', response_status = 201,
        audit_id = '39393939-3939-4939-8939-393939393939',
        completed_at = statement_timestamp()
    WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      AND idempotency_key_sha256 = digest('shared-workflow-key', 'sha256');
    RAISE EXCEPTION 'completed lifecycle replay accepted missing response bytes';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END;
$gate$;

UPDATE integration.workflow_lifecycle_idempotency
SET state = 'completed', response_status = 201,
    response_body = '{"response_type":"workflow_version"}',
    audit_id = '39393939-3939-4939-8939-393939393939',
    completed_at = statement_timestamp()
WHERE tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND idempotency_key_sha256 = digest('shared-workflow-key', 'sha256');

INSERT INTO integration.workflow_lifecycle_rate_limits (
  tenant_id, principal_id, operation, window_started_at, request_count
) VALUES (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '15151515-1515-4515-8515-151515151515',
  'workflow_draft_create_v1',
  date_trunc('minute', statement_timestamp()),
  1
);

COMMIT;

BEGIN;
SELECT set_config('app.tenant_id', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true);

DO $gate$
DECLARE
  visible_count INTEGER;
BEGIN
  SELECT count(*) INTO visible_count FROM rag.procedures;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'tenant B observed tenant A procedure metadata';
  END IF;
  SELECT count(*) INTO visible_count FROM integration.workflow_lifecycle_idempotency;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'tenant B observed tenant A lifecycle replay metadata';
  END IF;
END;
$gate$;

INSERT INTO rag.procedures (
  id, tenant_id, procedure_key, title, jurisdiction, created_by_principal_id
) VALUES (
  '40404040-4040-4040-8040-404040404040',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'water-community-runtime-gate',
  'TENANT_B_SECRET_WORKFLOW_TITLE',
  'TENANT_B_SECRET_JURISDICTION',
  '19191919-1919-4919-8919-191919191919'
);

INSERT INTO integration.workflow_lifecycle_idempotency (
  tenant_id, principal_id, operation, idempotency_key_sha256,
  request_sha256, state, expires_at
) VALUES (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '19191919-1919-4919-8919-191919191919',
  'workflow_draft_create_v1',
  digest('shared-workflow-key', 'sha256'),
  digest('tenant-b-workflow-request', 'sha256'),
  'processing',
  statement_timestamp() + interval '1 hour'
);

COMMIT;
RESET ROLE;

DO $gate$
DECLARE
  aggregate_count BIGINT;
  approved_count INTEGER;
BEGIN
  SELECT failure_count
  INTO aggregate_count
  FROM audit.workflow_lifecycle_authentication_failures
  WHERE audit_id = '28282828-2828-4828-8828-282828282828';
  IF aggregate_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'expected workflow auth failure aggregate count 2, found %', aggregate_count;
  END IF;

  PERFORM set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
  SELECT count(*) INTO approved_count
  FROM rag.procedure_versions
  WHERE lifecycle_status = 'approved';
  RESET app.tenant_id;
  IF approved_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one approved tenant-A workflow, found %', approved_count;
  END IF;
END;
$gate$;

SELECT json_build_object(
  'result', 'workflow_lifecycle_sql_gate_passed',
  'postgres_version', current_setting('server_version'),
  'vector_version', (SELECT extversion FROM pg_extension WHERE extname = 'vector'),
  'runtime_role_bypasses_rls', false,
  'cross_tenant_metadata_visible', false,
  'human_approval_separation_enforced', true
);
