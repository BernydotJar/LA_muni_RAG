\set ON_ERROR_STOP on

DO $gate$
BEGIN
  IF current_database() <> 'la_muni_rag_ingestion_test' THEN
    RAISE EXCEPTION 'artifact/vector hardening gate requires la_muni_rag_ingestion_test';
  END IF;
END;
$gate$;

DO $gate$
DECLARE
  acceptance_trigger_count INTEGER;
  append_only_trigger_count INTEGER;
  lock_is_security_definer BOOLEAN;
  lock_config TEXT[];
  public_can_execute BOOLEAN;
BEGIN
  SELECT count(*)
  INTO acceptance_trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'rag.artifact_objects'::regclass
    AND tgname = 'artifact_objects_validate_acceptance_v1'
    AND NOT tgisinternal;

  SELECT count(*)
  INTO append_only_trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'rag.artifact_scans'::regclass
    AND tgname = 'artifact_scans_append_only_v1'
    AND NOT tgisinternal;

  SELECT prosecdef, proconfig
  INTO lock_is_security_definer, lock_config
  FROM pg_proc
  WHERE oid = 'rag.lock_valid_artifact_acceptance_v1(uuid,uuid,uuid,text,uuid)'::regprocedure;

  SELECT EXISTS (
    SELECT 1
    FROM pg_proc AS function
    CROSS JOIN LATERAL aclexplode(
      COALESCE(function.proacl, acldefault('f', function.proowner))
    ) AS privilege
    WHERE function.oid = 'rag.lock_valid_artifact_acceptance_v1(uuid,uuid,uuid,text,uuid)'::regprocedure
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  ) INTO public_can_execute;

  IF acceptance_trigger_count <> 1
     OR append_only_trigger_count <> 1
     OR lock_is_security_definer IS DISTINCT FROM true
     OR NOT ('search_path=pg_catalog, rag, identity' = ANY(lock_config))
     OR public_can_execute IS DISTINCT FROM false
     OR has_table_privilege('la_muni_ingestion_runtime_test', 'rag.artifact_objects', 'UPDATE')
     OR has_table_privilege('la_muni_ingestion_runtime_test', 'rag.artifact_scans', 'UPDATE') THEN
    RAISE EXCEPTION 'artifact acceptance hardening privilege boundary is invalid';
  END IF;
END;
$gate$;

SET ROLE la_muni_ingestion_runtime_test;
BEGIN;
SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);
DO $gate$
DECLARE
  own_acceptance BOOLEAN;
  foreign_acceptance BOOLEAN;
BEGIN
  SELECT rag.lock_valid_artifact_acceptance_v1(
    'aaaaaaaa-1000-4000-8000-000000000101',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'aaaaaaaa-0000-4000-8000-000000000101',
    repeat('1', 64),
    'aaaaaaaa-2000-4000-8000-000000000101'
  ) INTO own_acceptance;

  SELECT rag.lock_valid_artifact_acceptance_v1(
    'bbbbbbbb-1000-4000-8000-000000000101',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'bbbbbbbb-0000-4000-8000-000000000101',
    repeat('1', 64),
    'bbbbbbbb-2000-4000-8000-000000000101'
  ) INTO foreign_acceptance;

  IF own_acceptance IS DISTINCT FROM true OR foreign_acceptance IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'tenant-bound artifact lock leaked or rejected valid own-tenant evidence';
  END IF;
END;
$gate$;
ROLLBACK;
RESET ROLE;

BEGIN;
SELECT set_config('app.tenant_id', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', true);

DO $gate$
BEGIN
  BEGIN
    UPDATE rag.artifact_objects AS object
    SET accepted_until = scan.inspected_at + interval '8 days'
    FROM rag.artifact_scans AS scan
    WHERE object.id = 'aaaaaaaa-1000-4000-8000-000000000101'::uuid
      AND object.tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
      AND scan.id = object.accepted_scan_id;
    RAISE EXCEPTION 'accepted artifact unexpectedly exceeded the seven-day scan window';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END;
$gate$;

DO $gate$
BEGIN
  BEGIN
    UPDATE rag.artifact_objects
    SET inspection_generation = inspection_generation + 1
    WHERE id = 'aaaaaaaa-1000-4000-8000-000000000101'::uuid
      AND tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
    RAISE EXCEPTION 'accepted artifact unexpectedly changed its current inspection generation';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END;
$gate$;

DO $gate$
BEGIN
  BEGIN
    UPDATE rag.artifact_objects
    SET object_key = 'versions/changed-after-acceptance.pdf'
    WHERE id = 'aaaaaaaa-1000-4000-8000-000000000101'::uuid
      AND tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
    RAISE EXCEPTION 'accepted artifact unexpectedly changed immutable object coordinates';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END;
$gate$;

DO $gate$
BEGIN
  BEGIN
    UPDATE rag.artifact_scans
    SET scanner_definitions_version = 'mutated-definitions'
    WHERE id = 'aaaaaaaa-2000-4000-8000-000000000101'::uuid
      AND tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
    RAISE EXCEPTION 'artifact scan evidence unexpectedly allowed mutation';
  EXCEPTION
    WHEN SQLSTATE '55000' THEN NULL;
  END;
END;
$gate$;

INSERT INTO rag.artifact_objects (
  id,
  tenant_id,
  document_version_id,
  registered_by_principal_id,
  store_name,
  object_namespace,
  object_key,
  object_version,
  original_filename,
  declared_media_type,
  expected_sha256,
  inspection_generation,
  status
)
VALUES (
  'aaaaaaaa-1000-4000-8000-000000000199',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-0000-4000-8000-000000000101',
  '11111111-1111-4111-8111-111111111111',
  'fixture_store',
  'tenant-a-private',
  'versions/a199.pdf',
  'generation-0001',
  'runtime-a199.pdf',
  'application/pdf',
  decode(repeat('1', 64), 'hex'),
  1,
  'scanning'
);

INSERT INTO rag.artifact_scans (
  id,
  tenant_id,
  artifact_object_id,
  inspection_generation,
  inspected_by_principal_id,
  verdict,
  content_sha256,
  byte_length,
  detected_media_type,
  structural_signature,
  inspected_at,
  scanner_engine,
  scanner_engine_version,
  scanner_definitions_version
)
VALUES (
  'aaaaaaaa-2000-4000-8000-000000000199',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'aaaaaaaa-1000-4000-8000-000000000199',
  1,
  '11111111-1111-4111-8111-111111111111',
  'clean',
  decode(repeat('2', 64), 'hex'),
  1024,
  'application/pdf',
  'pdf-1.4',
  statement_timestamp(),
  'fixture_scanner',
  '1.0.0',
  '20990101.1'
);

DO $gate$
BEGIN
  BEGIN
    UPDATE rag.artifact_objects
    SET status = 'accepted',
        accepted_scan_id = 'aaaaaaaa-2000-4000-8000-000000000199'::uuid,
        accepted_until = statement_timestamp() + interval '1 day'
    WHERE id = 'aaaaaaaa-1000-4000-8000-000000000199'::uuid
      AND tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
    RAISE EXCEPTION 'wrong-hash clean scan unexpectedly accepted';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END;
$gate$;

ROLLBACK;

SELECT json_build_object(
  'result', 'artifact_vector_runtime_hardening_gate_passed',
  'postgres_version', current_setting('server_version'),
  'vector_version', extversion,
  'wrong_hash_rejected', true,
  'stale_generation_rejected', true,
  'oversized_acceptance_window_rejected', true,
  'scan_update_rejected', true
)
FROM pg_extension
WHERE extname = 'vector';
