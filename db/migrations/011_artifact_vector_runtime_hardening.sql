-- LA Muni RAG
-- Feature 060: exact persisted artifact acceptance and lease/publication fencing.
--
-- Apply after 007_persisted_artifact_acceptance.sql. The migration is additive
-- and refuses to install over accepted rows whose referenced scan does not prove
-- the exact current immutable bytes. It stores no object bytes, URLs, signed
-- requests, credentials, raw idempotency keys, worker identities, or lease tokens.

BEGIN;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM rag.artifact_objects AS object
    LEFT JOIN rag.artifact_scans AS scan
      ON scan.id = object.accepted_scan_id
     AND scan.tenant_id = object.tenant_id
     AND scan.artifact_object_id = object.id
    WHERE object.status = 'accepted'
      AND (
        scan.id IS NULL
        OR scan.verdict IS DISTINCT FROM 'clean'
        OR scan.inspection_generation IS DISTINCT FROM object.inspection_generation
        OR scan.content_sha256 IS DISTINCT FROM object.expected_sha256
        OR scan.detected_media_type IS DISTINCT FROM object.declared_media_type
        OR object.accepted_until IS NULL
        OR object.accepted_until <= scan.inspected_at
        OR object.accepted_until > scan.inspected_at + interval '7 days'
      )
  ) THEN
    RAISE EXCEPTION
      'existing accepted artifact rows violate the exact clean-scan boundary';
  END IF;
END;
$migration$;

CREATE FUNCTION rag.validate_artifact_acceptance_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, rag
AS $function$
DECLARE
  scan rag.artifact_scans%ROWTYPE;
BEGIN
  IF NEW.status <> 'accepted' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status = 'accepted'
     AND (
       NEW.id IS DISTINCT FROM OLD.id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.document_version_id IS DISTINCT FROM OLD.document_version_id
       OR NEW.store_name IS DISTINCT FROM OLD.store_name
       OR NEW.object_namespace IS DISTINCT FROM OLD.object_namespace
       OR NEW.object_key IS DISTINCT FROM OLD.object_key
       OR NEW.object_version IS DISTINCT FROM OLD.object_version
       OR NEW.original_filename IS DISTINCT FROM OLD.original_filename
       OR NEW.declared_media_type IS DISTINCT FROM OLD.declared_media_type
       OR NEW.expected_sha256 IS DISTINCT FROM OLD.expected_sha256
       OR NEW.inspection_generation IS DISTINCT FROM OLD.inspection_generation
       OR NEW.accepted_scan_id IS DISTINCT FROM OLD.accepted_scan_id
       OR NEW.accepted_until IS DISTINCT FROM OLD.accepted_until
     ) THEN
    RAISE EXCEPTION 'accepted artifact identity is immutable; start a new inspection generation'
      USING ERRCODE = '23514';
  END IF;

  SELECT stored.*
  INTO scan
  FROM rag.artifact_scans AS stored
  WHERE stored.id = NEW.accepted_scan_id
    AND stored.tenant_id = NEW.tenant_id
    AND stored.artifact_object_id = NEW.id;

  IF NOT FOUND
     OR scan.verdict IS DISTINCT FROM 'clean'
     OR scan.inspection_generation IS DISTINCT FROM NEW.inspection_generation
     OR scan.content_sha256 IS DISTINCT FROM NEW.expected_sha256
     OR scan.detected_media_type IS DISTINCT FROM NEW.declared_media_type
     OR NEW.accepted_until IS NULL
     OR NEW.accepted_until <= scan.inspected_at
     OR NEW.accepted_until <= statement_timestamp()
     OR NEW.accepted_until > scan.inspected_at + interval '7 days' THEN
    RAISE EXCEPTION
      'accepted artifact requires the exact current clean scan and bounded acceptance window'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION rag.validate_artifact_acceptance_v1() FROM PUBLIC;

CREATE TRIGGER artifact_objects_validate_acceptance_v1
BEFORE INSERT OR UPDATE ON rag.artifact_objects
FOR EACH ROW
EXECUTE FUNCTION rag.validate_artifact_acceptance_v1();

CREATE FUNCTION rag.prevent_artifact_scan_update_v1()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, rag
AS $function$
BEGIN
  RAISE EXCEPTION 'artifact scan evidence is append-only'
    USING ERRCODE = '55000';
END;
$function$;

REVOKE ALL ON FUNCTION rag.prevent_artifact_scan_update_v1() FROM PUBLIC;

CREATE FUNCTION rag.lock_valid_artifact_acceptance_v1(
  p_artifact_object_id UUID,
  p_tenant_id UUID,
  p_document_version_id UUID,
  p_expected_sha256 TEXT,
  p_artifact_scan_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, rag, identity
AS $function$
BEGIN
  IF p_tenant_id IS DISTINCT FROM identity.current_tenant_id()
     OR p_expected_sha256 !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;

  PERFORM 1
  FROM rag.artifact_objects AS object
  JOIN rag.artifact_scans AS scan
    ON scan.id = object.accepted_scan_id
   AND scan.tenant_id = object.tenant_id
   AND scan.artifact_object_id = object.id
  WHERE object.id = p_artifact_object_id
    AND object.tenant_id = p_tenant_id
    AND object.document_version_id = p_document_version_id
    AND object.expected_sha256 = decode(p_expected_sha256, 'hex')
    AND scan.id = p_artifact_scan_id
    AND scan.verdict = 'clean'
    AND scan.inspection_generation = object.inspection_generation
    AND scan.content_sha256 = object.expected_sha256
    AND scan.detected_media_type = object.declared_media_type
    AND object.status = 'accepted'
    AND object.accepted_until > statement_timestamp()
    AND object.accepted_until > scan.inspected_at
    AND object.accepted_until <= scan.inspected_at + interval '7 days'
  FOR SHARE OF object, scan;

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION rag.lock_valid_artifact_acceptance_v1(UUID, UUID, UUID, TEXT, UUID)
  FROM PUBLIC;

CREATE TRIGGER artifact_scans_append_only_v1
BEFORE UPDATE ON rag.artifact_scans
FOR EACH ROW
EXECUTE FUNCTION rag.prevent_artifact_scan_update_v1();

COMMENT ON FUNCTION rag.validate_artifact_acceptance_v1() IS
  'Rejects accepted artifact state unless the referenced current clean scan proves the exact bytes, media type, and a future window of at most seven days.';
COMMENT ON FUNCTION rag.prevent_artifact_scan_update_v1() IS
  'Makes persisted artifact scan evidence append-only; later inspections create a new generation and scan row.';
COMMENT ON FUNCTION rag.lock_valid_artifact_acceptance_v1(UUID, UUID, UUID, TEXT, UUID) IS
  'Tenant-bound SECURITY DEFINER boundary that validates and row-locks exact accepted object/scan evidence without granting mutation privileges to the ingestion runtime.';

COMMIT;
