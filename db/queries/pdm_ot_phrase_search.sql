-- LA Muni RAG
-- Exact phrase / substring retrieval baseline for the PDM-OT corpus.
--
-- This is useful when looking for names, acronyms, table labels, or phrases
-- that full-text search may normalize too aggressively.

WITH params AS (
  SELECT
    'CNPAG'::text AS phrase,
    10::integer AS result_limit
)
SELECT
  d.title AS document_title,
  s.citation_label,
  s.page_start,
  left(s.content, 700) AS preview
FROM rag.document_sections s
JOIN rag.document_versions v ON v.id = s.document_version_id
JOIN rag.documents d ON d.id = v.document_id
CROSS JOIN params
WHERE s.content ILIKE '%' || params.phrase || '%'
ORDER BY s.page_start ASC
LIMIT (SELECT result_limit FROM params);

