-- LA Muni RAG
-- Seed verified document version rows for files already downloaded locally.
--
-- Run after:
--   1. db/migrations/001_initial_rag_schema.sql
--   2. db/seeds/001_core_documents.sql

BEGIN;

INSERT INTO rag.document_versions (
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
WHERE d.title = 'Plan de Desarrollo Municipal y Ordenamiento Territorial de Antigua Guatemala, PDM-OT'
ON CONFLICT DO NOTHING;

COMMIT;

