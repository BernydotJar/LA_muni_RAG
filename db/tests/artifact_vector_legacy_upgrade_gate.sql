\set ON_ERROR_STOP on

DO $gate$
BEGIN
  IF current_database() <> 'la_muni_rag_legacy_ingestion_test' THEN
    RAISE EXCEPTION 'artifact/vector legacy upgrade gate requires la_muni_rag_legacy_ingestion_test';
  END IF;
END;
$gate$;

DO $gate$
DECLARE
  tenant_not_null BOOLEAN;
  vector_rls BOOLEAN;
  vector_force BOOLEAN;
  object_rls BOOLEAN;
  object_force BOOLEAN;
  vector_primary_key TEXT;
  acceptance_trigger_count INTEGER;
  lock_function_security_definer BOOLEAN;
  lock_function_config TEXT[];
BEGIN
  SELECT is_nullable = 'NO'
  INTO tenant_not_null
  FROM information_schema.columns
  WHERE table_schema = 'rag'
    AND table_name = 'embedding_vectors'
    AND column_name = 'tenant_id';

  SELECT relrowsecurity, relforcerowsecurity
  INTO vector_rls, vector_force
  FROM pg_class
  WHERE oid = 'rag.embedding_vectors'::regclass;

  SELECT relrowsecurity, relforcerowsecurity
  INTO object_rls, object_force
  FROM pg_class
  WHERE oid = 'rag.artifact_objects'::regclass;

  SELECT pg_get_constraintdef(oid)
  INTO vector_primary_key
  FROM pg_constraint
  WHERE conrelid = 'rag.embedding_vectors'::regclass
    AND contype = 'p';

  SELECT count(*)
  INTO acceptance_trigger_count
  FROM pg_trigger
  WHERE tgrelid = 'rag.artifact_objects'::regclass
    AND tgname = 'artifact_objects_validate_acceptance_v1'
    AND NOT tgisinternal;

  SELECT prosecdef, proconfig
  INTO lock_function_security_definer, lock_function_config
  FROM pg_proc
  WHERE oid = 'rag.lock_valid_artifact_acceptance_v1(uuid,uuid,uuid,text,uuid)'::regprocedure;

  IF tenant_not_null IS DISTINCT FROM true
     OR vector_rls IS DISTINCT FROM true
     OR vector_force IS DISTINCT FROM true
     OR object_rls IS DISTINCT FROM true
     OR object_force IS DISTINCT FROM true
     OR vector_primary_key NOT LIKE '%tenant_id%chunk_id%'
     OR acceptance_trigger_count <> 1
     OR lock_function_security_definer IS DISTINCT FROM true
     OR NOT ('search_path=pg_catalog, rag, identity' = ANY(lock_function_config)) THEN
    RAISE EXCEPTION 'legacy vector path did not converge to the hardened tenant runtime';
  END IF;
END;
$gate$;

SELECT json_build_object(
  'result', 'artifact_vector_legacy_upgrade_gate_passed',
  'postgres_version', current_setting('server_version'),
  'vector_version', extversion,
  'tenant_vector_primary_key', true,
  'forced_rls', true,
  'exact_acceptance_trigger', true
)
FROM pg_extension
WHERE extname = 'vector';
