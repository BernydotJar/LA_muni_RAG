\set ON_ERROR_STOP on

DO $fixture$
BEGIN
  IF current_database() <> 'la_muni_rag_invalid_artifact_test' THEN
    RAISE EXCEPTION 'invalid artifact history fixture requires la_muni_rag_invalid_artifact_test';
  END IF;
END;
$fixture$;

INSERT INTO identity.tenants (id, slug, name)
VALUES (
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'invalid-artifact-history',
  'Invalid artifact history fixture'
);

INSERT INTO identity.principals (
  id,
  tenant_id,
  principal_kind,
  external_subject,
  display_name
)
VALUES (
  '33333333-3333-4333-8333-333333333333',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'service',
  'invalid-artifact-fixture',
  'Invalid artifact fixture'
);

BEGIN;
SELECT set_config('app.tenant_id', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', true);

INSERT INTO rag.municipalities (id, tenant_id, name, department, slug)
VALUES (
  'cccccccc-0000-4000-8000-000000000001',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'Invalid fixture municipality',
  'Sacatepéquez',
  'invalid-fixture-municipality'
);

INSERT INTO rag.documents (
  id,
  tenant_id,
  municipality_id,
  title,
  document_type,
  document_scope,
  source_kind,
  official_source,
  status,
  metadata
)
VALUES (
  'cccccccc-0000-4000-8000-000000000010',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'cccccccc-0000-4000-8000-000000000001',
  'Invalid fixture document',
  'manual',
  'municipal',
  'official_upload',
  true,
  'active',
  '{"confidentiality":"public"}'::jsonb
);

INSERT INTO rag.document_versions (
  id,
  tenant_id,
  document_id,
  version_label,
  content_sha256,
  extraction_status
)
VALUES (
  'cccccccc-0000-4000-8000-000000000101',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'cccccccc-0000-4000-8000-000000000010',
  'v1',
  repeat('1', 64),
  'queued'
);

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
  'cccccccc-1000-4000-8000-000000000101',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'cccccccc-0000-4000-8000-000000000101',
  '33333333-3333-4333-8333-333333333333',
  'fixture_store',
  'tenant-private',
  'invalid/document.pdf',
  'generation-0001',
  'document.pdf',
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
  'cccccccc-2000-4000-8000-000000000101',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'cccccccc-1000-4000-8000-000000000101',
  1,
  '33333333-3333-4333-8333-333333333333',
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

UPDATE rag.artifact_objects
SET status = 'accepted',
    accepted_scan_id = 'cccccccc-2000-4000-8000-000000000101',
    accepted_until = statement_timestamp() + interval '30 days'
WHERE id = 'cccccccc-1000-4000-8000-000000000101'
  AND tenant_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

COMMIT;

SELECT json_build_object(
  'result', 'invalid_artifact_history_fixture_ready',
  'object_hash', repeat('1', 64),
  'scan_hash', repeat('2', 64),
  'accepted_window_days', 30
);
