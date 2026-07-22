-- LA Muni RAG
-- Seed verified document version rows for files already downloaded locally.
--
-- Run after:
--   1. db/migrations/001_initial_rag_schema.sql
--   2. db/migrations/002_procedure_feedback.sql
--   3. db/migrations/003_identity_tenancy_rbac.sql
--   4. db/seeds/001_core_documents.sql

BEGIN;

SELECT set_config(
  'app.tenant_id',
  '00000000-0000-4000-8000-000000000001',
  true
);

INSERT INTO rag.document_versions (
  tenant_id,
  document_id,
  version_label,
  source_url,
  storage_uri,
  original_filename,
  mime_type,
  content_sha256,
  page_count,
  extraction_status,
  extraction_method,
  metadata
)
SELECT
  d.tenant_id,
  d.id,
  'official-municipal-pdf-2026-06-22',
  'https://muniantigua.gob.gt/assets/backend/info/MODULO_1_PDMOT.pdf',
  'data/raw/core-documents/pdm-ot-antigua-modulo-1.pdf',
  'MODULO_1_PDMOT.pdf',
  'application/pdf',
  '824f0ee47106f062269a7c65cb3433435470bbe609054972eb29c360f368cd0b',
  NULL,
  'queued',
  NULL,
  '{"verified_download": true, "downloaded_at": "2026-06-22", "file_size_bytes": 34822596}'::jsonb
FROM rag.documents d
WHERE d.tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
  AND d.title = 'Plan de Desarrollo Municipal y Ordenamiento Territorial de Antigua Guatemala, PDM-OT'
ON CONFLICT DO NOTHING;

COMMIT;
