-- LA Muni RAG
-- Seed core document registry rows.
--
-- This does not ingest PDF text. It registers authoritative source records so
-- later extraction can attach versions, sections, embeddings, and citations.

BEGIN;

-- Migration 003 enables FORCE RLS. Seed work must therefore establish the
-- explicit legacy/bootstrap tenant in this transaction; there is no runtime
-- tenant default.
SELECT set_config(
  'app.tenant_id',
  '00000000-0000-4000-8000-000000000001',
  true
);

WITH muni AS (
  SELECT id, tenant_id
  FROM rag.municipalities
  WHERE slug = 'la-antigua-guatemala-sacatepequez'
    AND tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
)
INSERT INTO rag.documents (
  tenant_id,
  municipality_id,
  title,
  document_type,
  document_scope,
  issuing_authority,
  source_kind,
  source_url,
  official_source,
  publication_date,
  status,
  notes,
  metadata
)
SELECT
  '00000000-0000-4000-8000-000000000001'::uuid,
  seed.municipality_id,
  seed.title,
  seed.document_type::rag.document_type,
  seed.document_scope::rag.document_scope,
  seed.issuing_authority,
  seed.source_kind::rag.source_kind,
  seed.source_url,
  seed.official_source,
  seed.publication_date::date,
  seed.status::rag.document_status,
  seed.notes,
  seed.metadata::jsonb
FROM (
VALUES
(
  NULL,
  'Constitucion Politica de la Republica de Guatemala',
  'constitution',
  'national',
  'Asamblea Nacional Constituyente / Congreso de la Republica de Guatemala',
  'official_url',
  'https://www.congreso.gob.gt/contenido/20',
  true,
  NULL,
  'active',
  'Registry seed only. Confirm consolidated text and reforms before legal reliance.',
  '{"seed_batch": "core_documents_v1", "requires_vigency_review": true}'
),
(
  NULL,
  'Codigo Municipal, Decreto Numero 12-2002',
  'decree',
  'national',
  'Congreso de la Republica de Guatemala',
  'official_url',
  'https://www.congreso.gob.gt/assets/uploads/info_legislativo/decretos/12-02.pdf',
  true,
  '2002-04-02',
  'active',
  'Registry seed only. Later ingestion must account for reforms and consolidated text.',
  '{"seed_batch": "core_documents_v1", "decree": "12-2002", "requires_vigency_review": true}'
),
(
  (SELECT id FROM muni),
  'Plan de Desarrollo Municipal y Ordenamiento Territorial de Antigua Guatemala, PDM-OT',
  'plan',
  'municipal',
  'Municipalidad de La Antigua Guatemala',
  'official_url',
  'https://muniantigua.gob.gt/assets/backend/info/MODULO_1_PDMOT.pdf',
  true,
  NULL,
  'active',
  'Registry seed only. Confirm module completeness and any later amendments before relying on planning conclusions.',
  '{"seed_batch": "core_documents_v1", "document_family": "PDM-OT", "requires_completeness_review": true}'
),
(
  (SELECT id FROM muni),
  'Ley Protectora de la Ciudad de La Antigua Guatemala, Decreto Numero 60-69',
  'decree',
  'heritage',
  'Congreso de la Republica de Guatemala',
  'unknown',
  NULL,
  false,
  '1969-10-28',
  'unknown',
  'Registry placeholder. Requires verified official source URL or gazette copy before ingestion.',
  '{"seed_batch": "core_documents_v1", "decree": "60-69", "requires_source_verification": true}'
)
) AS seed(
  municipality_id,
  title,
  document_type,
  document_scope,
  issuing_authority,
  source_kind,
  source_url,
  official_source,
  publication_date,
  status,
  notes,
  metadata
)
WHERE NOT EXISTS (
  SELECT 1
  FROM rag.documents existing
  WHERE existing.tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
    AND existing.title = seed.title
    AND existing.document_scope = seed.document_scope::rag.document_scope
    AND coalesce(existing.source_url, '') = coalesce(seed.source_url, '')
);

COMMIT;
