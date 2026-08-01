\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('app.tenant_id', 'a7100000-0000-4000-8000-000000000001', true);

DO $gate$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM identity.tenants
    WHERE id = 'a7100000-0000-4000-8000-000000000001'::uuid
  ) THEN
    RAISE EXCEPTION 'public Antigua tenant is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM identity.principals
    WHERE id = 'a7100000-0000-4000-8000-000000000002'::uuid
      AND tenant_id = 'a7100000-0000-4000-8000-000000000001'::uuid
  ) THEN
    RAISE EXCEPTION 'public corpus ingestion principal is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM rag.municipalities
    WHERE id = 'a7100000-0000-4000-8000-000000000003'::uuid
      AND tenant_id = 'a7100000-0000-4000-8000-000000000001'::uuid
  ) THEN
    RAISE EXCEPTION 'public Antigua municipality is missing';
  END IF;
END;
$gate$;

INSERT INTO rag.sources (
  id, tenant_id, source_key, title, category,
  target_jurisdiction, source_jurisdiction, source_relation,
  discovery_status, discovery_url, artifact_url, observed_version,
  publication_date, limitations, created_by_principal_id
) VALUES
(
  'a7100000-0000-4000-8000-000000000050',
  'a7100000-0000-4000-8000-000000000001',
  'antigua-pdmot-module-3',
  'PDM-OT Modulo 3: indicadores de evaluacion y seguimiento',
  'planning',
  'Municipio de La Antigua Guatemala, Sacatepequez, Guatemala',
  'Municipio de La Antigua Guatemala, Sacatepequez, Guatemala',
  'target', 'identified',
  'https://muniantigua.gob.gt/pdmot/',
  'https://muniantigua.gob.gt/assets/backend/info/MODULO_3_PDMOT.pdf',
  'official-municipal-pdf-2025', '2025-01-01',
  '["Los indicadores requieren corroboracion de vigencia y aplicacion al caso concreto."]'::jsonb,
  'a7100000-0000-4000-8000-000000000002'
),
(
  'a7100000-0000-4000-8000-000000000070',
  'a7100000-0000-4000-8000-000000000001',
  'antigua-pdmot-module-4',
  'PDM-OT Modulo 4: implementacion, seguimiento y gestion',
  'planning',
  'Municipio de La Antigua Guatemala, Sacatepequez, Guatemala',
  'Municipio de La Antigua Guatemala, Sacatepequez, Guatemala',
  'target', 'identified',
  'https://muniantigua.gob.gt/pdmot/',
  'https://muniantigua.gob.gt/assets/backend/info/MODULO_4_PDMOT.pdf',
  'official-municipal-pdf-2025', '2025-01-01',
  '["La articulacion PEI, POM, POA y presupuesto no demuestra aprobacion para un expediente concreto."]'::jsonb,
  'a7100000-0000-4000-8000-000000000002'
)
ON CONFLICT (tenant_id, source_key) DO NOTHING;

DO $gate$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM rag.sources
    WHERE id = 'a7100000-0000-4000-8000-000000000050'::uuid
      AND tenant_id = 'a7100000-0000-4000-8000-000000000001'::uuid
      AND source_key = 'antigua-pdmot-module-3'
      AND artifact_url = 'https://muniantigua.gob.gt/assets/backend/info/MODULO_3_PDMOT.pdf'
  ) THEN
    RAISE EXCEPTION 'module 3 source identity mismatch';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM rag.sources
    WHERE id = 'a7100000-0000-4000-8000-000000000070'::uuid
      AND tenant_id = 'a7100000-0000-4000-8000-000000000001'::uuid
      AND source_key = 'antigua-pdmot-module-4'
      AND artifact_url = 'https://muniantigua.gob.gt/assets/backend/info/MODULO_4_PDMOT.pdf'
  ) THEN
    RAISE EXCEPTION 'module 4 source identity mismatch';
  END IF;
END;
$gate$;

UPDATE rag.sources
SET validation_state = 'validated',
    official_source = true,
    official_for_target_jurisdiction = true,
    updated_at = statement_timestamp()
WHERE tenant_id = 'a7100000-0000-4000-8000-000000000001'::uuid
  AND (
    (id = 'a7100000-0000-4000-8000-000000000050'::uuid
      AND source_key = 'antigua-pdmot-module-3'
      AND artifact_url = 'https://muniantigua.gob.gt/assets/backend/info/MODULO_3_PDMOT.pdf')
    OR
    (id = 'a7100000-0000-4000-8000-000000000070'::uuid
      AND source_key = 'antigua-pdmot-module-4'
      AND artifact_url = 'https://muniantigua.gob.gt/assets/backend/info/MODULO_4_PDMOT.pdf')
  );

INSERT INTO rag.documents (
  id, tenant_id, municipality_id, source_id, title, document_type,
  document_scope, issuing_authority, source_kind, source_url,
  official_source, confidentiality, status, registered_by_principal_id, metadata
) VALUES
(
  'a7100000-0000-4000-8000-000000000060',
  'a7100000-0000-4000-8000-000000000001',
  'a7100000-0000-4000-8000-000000000003',
  'a7100000-0000-4000-8000-000000000050',
  'PDM-OT Modulo 3: indicadores de evaluacion y seguimiento',
  'plan', 'municipal', 'Municipalidad de La Antigua Guatemala',
  'official_url', 'https://muniantigua.gob.gt/assets/backend/info/MODULO_3_PDMOT.pdf',
  true, 'public', 'active', 'a7100000-0000-4000-8000-000000000002',
  '{"document_key":"antigua-pdmot-module-3","confidentiality":"public","official_expansion":true}'::jsonb
),
(
  'a7100000-0000-4000-8000-000000000080',
  'a7100000-0000-4000-8000-000000000001',
  'a7100000-0000-4000-8000-000000000003',
  'a7100000-0000-4000-8000-000000000070',
  'PDM-OT Modulo 4: implementacion, seguimiento y gestion',
  'plan', 'municipal', 'Municipalidad de La Antigua Guatemala',
  'official_url', 'https://muniantigua.gob.gt/assets/backend/info/MODULO_4_PDMOT.pdf',
  true, 'public', 'active', 'a7100000-0000-4000-8000-000000000002',
  '{"document_key":"antigua-pdmot-module-4","confidentiality":"public","official_expansion":true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

UPDATE rag.documents
SET status = 'active',
    official_source = true,
    updated_at = statement_timestamp()
WHERE tenant_id = 'a7100000-0000-4000-8000-000000000001'::uuid
  AND (
    (id = 'a7100000-0000-4000-8000-000000000060'::uuid
      AND source_id = 'a7100000-0000-4000-8000-000000000050'::uuid
      AND source_url = 'https://muniantigua.gob.gt/assets/backend/info/MODULO_3_PDMOT.pdf')
    OR
    (id = 'a7100000-0000-4000-8000-000000000080'::uuid
      AND source_id = 'a7100000-0000-4000-8000-000000000070'::uuid
      AND source_url = 'https://muniantigua.gob.gt/assets/backend/info/MODULO_4_PDMOT.pdf')
  );

INSERT INTO rag.document_versions (
  id, tenant_id, document_id, version_label, source_url, original_filename,
  mime_type, content_sha256, extraction_status, metadata
) VALUES
(
  'a7100000-0000-4000-8000-000000000061',
  'a7100000-0000-4000-8000-000000000001',
  'a7100000-0000-4000-8000-000000000060',
  'official-municipal-pdf-2025',
  'https://muniantigua.gob.gt/assets/backend/info/MODULO_3_PDMOT.pdf',
  'antigua-pdmot-module-3.pdf', 'application/pdf',
  'dc67c503155c8fe85a6d4ac28b54c715e6293ab8261484d2531750a9ab17a3f0',
  'queued', '{"official_expansion":true}'::jsonb
),
(
  'a7100000-0000-4000-8000-000000000081',
  'a7100000-0000-4000-8000-000000000001',
  'a7100000-0000-4000-8000-000000000080',
  'official-municipal-pdf-2025',
  'https://muniantigua.gob.gt/assets/backend/info/MODULO_4_PDMOT.pdf',
  'antigua-pdmot-module-4.pdf', 'application/pdf',
  '73186847344904a6c4ee64668dad0ec43628b3ca65ed8f12a192a05705a26fa9',
  'queued', '{"official_expansion":true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

DO $gate$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM rag.document_versions
    WHERE id = 'a7100000-0000-4000-8000-000000000061'::uuid
      AND content_sha256 = 'dc67c503155c8fe85a6d4ac28b54c715e6293ab8261484d2531750a9ab17a3f0'
  ) THEN RAISE EXCEPTION 'module 3 version identity mismatch'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM rag.document_versions
    WHERE id = 'a7100000-0000-4000-8000-000000000081'::uuid
      AND content_sha256 = '73186847344904a6c4ee64668dad0ec43628b3ca65ed8f12a192a05705a26fa9'
  ) THEN RAISE EXCEPTION 'module 4 version identity mismatch'; END IF;
END;
$gate$;

INSERT INTO audit.events (
  id, tenant_id, actor_external_id, event_type, entity_schema, entity_table,
  entity_id, outcome, details, created_at
) VALUES
(
  'a7100000-0000-4000-8000-000000000090',
  'a7100000-0000-4000-8000-000000000001',
  'public-corpus-ingestion-v1', 'official_source_registered', 'rag', 'documents',
  'a7100000-0000-4000-8000-000000000060', 'success',
  '{"source_id":"antigua-pdmot-module-3","sha256":"dc67c503155c8fe85a6d4ac28b54c715e6293ab8261484d2531750a9ab17a3f0"}'::jsonb,
  statement_timestamp()
),
(
  'a7100000-0000-4000-8000-000000000091',
  'a7100000-0000-4000-8000-000000000001',
  'public-corpus-ingestion-v1', 'official_source_registered', 'rag', 'documents',
  'a7100000-0000-4000-8000-000000000080', 'success',
  '{"source_id":"antigua-pdmot-module-4","sha256":"73186847344904a6c4ee64668dad0ec43628b3ca65ed8f12a192a05705a26fa9"}'::jsonb,
  statement_timestamp()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO audit.events (
  id, tenant_id, actor_external_id, event_type, entity_schema, entity_table,
  entity_id, outcome, details, created_at
) VALUES
(
  'a7100000-0000-4000-8000-000000000092',
  'a7100000-0000-4000-8000-000000000001',
  'public-corpus-ingestion-v1', 'official_source_validated', 'rag', 'sources',
  'a7100000-0000-4000-8000-000000000050', 'success',
  '{"source_id":"antigua-pdmot-module-3","document_status":"active"}'::jsonb,
  statement_timestamp()
),
(
  'a7100000-0000-4000-8000-000000000093',
  'a7100000-0000-4000-8000-000000000001',
  'public-corpus-ingestion-v1', 'official_source_validated', 'rag', 'sources',
  'a7100000-0000-4000-8000-000000000070', 'success',
  '{"source_id":"antigua-pdmot-module-4","document_status":"active"}'::jsonb,
  statement_timestamp()
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
