\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('app.tenant_id', 'a7100000-0000-4000-8000-000000000001', true);

DO $gate$
DECLARE
  module3_vectors INTEGER;
  module4_vectors INTEGER;
BEGIN
  SELECT count(*)::integer INTO module3_vectors
  FROM rag.embedding_vectors vector
  JOIN rag.ingestion_jobs job
    ON job.tenant_id = vector.tenant_id
   AND job.id = vector.ingestion_job_id
   AND job.document_version_id = vector.document_version_id
   AND job.status = 'processed'
  JOIN rag.artifact_objects artifact
    ON artifact.tenant_id = job.tenant_id
   AND artifact.id = job.artifact_object_id
   AND artifact.document_version_id = job.document_version_id
   AND artifact.status = 'accepted'
   AND artifact.accepted_until > statement_timestamp()
  JOIN rag.artifact_scans scan
    ON scan.tenant_id = artifact.tenant_id
   AND scan.id = artifact.accepted_scan_id
   AND scan.artifact_object_id = artifact.id
   AND scan.verdict = 'clean'
   AND scan.inspection_generation = artifact.inspection_generation
   AND scan.content_sha256 = artifact.expected_sha256
  WHERE vector.tenant_id = 'a7100000-0000-4000-8000-000000000001'::uuid
    AND vector.document_version_id = 'a7100000-0000-4000-8000-000000000061'::uuid
    AND job.artifact_scan_id = scan.id;

  SELECT count(*)::integer INTO module4_vectors
  FROM rag.embedding_vectors vector
  JOIN rag.ingestion_jobs job
    ON job.tenant_id = vector.tenant_id
   AND job.id = vector.ingestion_job_id
   AND job.document_version_id = vector.document_version_id
   AND job.status = 'processed'
  JOIN rag.artifact_objects artifact
    ON artifact.tenant_id = job.tenant_id
   AND artifact.id = job.artifact_object_id
   AND artifact.document_version_id = job.document_version_id
   AND artifact.status = 'accepted'
   AND artifact.accepted_until > statement_timestamp()
  JOIN rag.artifact_scans scan
    ON scan.tenant_id = artifact.tenant_id
   AND scan.id = artifact.accepted_scan_id
   AND scan.artifact_object_id = artifact.id
   AND scan.verdict = 'clean'
   AND scan.inspection_generation = artifact.inspection_generation
   AND scan.content_sha256 = artifact.expected_sha256
  WHERE vector.tenant_id = 'a7100000-0000-4000-8000-000000000001'::uuid
    AND vector.document_version_id = 'a7100000-0000-4000-8000-000000000081'::uuid
    AND job.artifact_scan_id = scan.id;

  IF module3_vectors < 1 THEN
    RAISE EXCEPTION 'module 3 has no accepted processed vector generation';
  END IF;
  IF module4_vectors < 1 THEN
    RAISE EXCEPTION 'module 4 has no accepted processed vector generation';
  END IF;
END;
$gate$;

UPDATE rag.sources source
SET acquisition_state = 'acquired',
    ingestion_state = 'ingested',
    retrieval_state = 'indexed',
    updated_at = statement_timestamp()
FROM rag.documents document
JOIN rag.document_versions version
  ON version.tenant_id = document.tenant_id
 AND version.document_id = document.id
WHERE source.tenant_id = 'a7100000-0000-4000-8000-000000000001'::uuid
  AND source.validation_state = 'validated'
  AND source.official_source
  AND source.official_for_target_jurisdiction
  AND document.tenant_id = source.tenant_id
  AND document.source_id = source.id
  AND document.status = 'active'
  AND document.confidentiality = 'public'
  AND version.extraction_status = 'processed'
  AND (
    (source.id = 'a7100000-0000-4000-8000-000000000050'::uuid
      AND document.id = 'a7100000-0000-4000-8000-000000000060'::uuid
      AND version.id = 'a7100000-0000-4000-8000-000000000061'::uuid
      AND version.content_sha256 = 'dc67c503155c8fe85a6d4ac28b54c715e6293ab8261484d2531750a9ab17a3f0')
    OR
    (source.id = 'a7100000-0000-4000-8000-000000000070'::uuid
      AND document.id = 'a7100000-0000-4000-8000-000000000080'::uuid
      AND version.id = 'a7100000-0000-4000-8000-000000000081'::uuid
      AND version.content_sha256 = '73186847344904a6c4ee64668dad0ec43628b3ca65ed8f12a192a05705a26fa9')
  );

DO $gate$
BEGIN
  IF (SELECT count(*) FROM rag.sources
      WHERE id IN (
        'a7100000-0000-4000-8000-000000000050'::uuid,
        'a7100000-0000-4000-8000-000000000070'::uuid
      )
        AND acquisition_state = 'acquired'
        AND ingestion_state = 'ingested'
        AND retrieval_state = 'indexed') <> 2 THEN
    RAISE EXCEPTION 'official expansion catalog promotion did not close both sources';
  END IF;
END;
$gate$;

INSERT INTO audit.events (
  id, tenant_id, actor_external_id, event_type, entity_schema, entity_table,
  entity_id, outcome, details, created_at
)
SELECT
  event_id,
  'a7100000-0000-4000-8000-000000000001'::uuid,
  'public-corpus-ingestion-v1',
  'official_source_ingested',
  'rag',
  'sources',
  source_id,
  'success',
  jsonb_build_object(
    'document_version_id', document_version_id,
    'vector_count', vector_count,
    'catalog_state', 'validated/acquired/ingested/indexed'
  ),
  statement_timestamp()
FROM (
  SELECT
    'a7100000-0000-4000-8000-000000000094'::uuid AS event_id,
    'a7100000-0000-4000-8000-000000000050'::uuid AS source_id,
    'a7100000-0000-4000-8000-000000000061'::uuid AS document_version_id,
    count(*)::integer AS vector_count
  FROM rag.embedding_vectors
  WHERE tenant_id = 'a7100000-0000-4000-8000-000000000001'::uuid
    AND document_version_id = 'a7100000-0000-4000-8000-000000000061'::uuid
  UNION ALL
  SELECT
    'a7100000-0000-4000-8000-000000000095'::uuid,
    'a7100000-0000-4000-8000-000000000070'::uuid,
    'a7100000-0000-4000-8000-000000000081'::uuid,
    count(*)::integer
  FROM rag.embedding_vectors
  WHERE tenant_id = 'a7100000-0000-4000-8000-000000000001'::uuid
    AND document_version_id = 'a7100000-0000-4000-8000-000000000081'::uuid
) evidence
ON CONFLICT (id) DO NOTHING;

COMMIT;
