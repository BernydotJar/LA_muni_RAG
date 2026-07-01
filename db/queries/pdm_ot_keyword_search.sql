-- LA Muni RAG
-- Keyword retrieval baseline for the PDM-OT corpus.
--
-- In pgAdmin, edit the query text in the `params` CTE and run.

WITH params AS (
  SELECT
    'ordenamiento territorial'::text AS query_text,
    10::integer AS result_limit
),
search AS (
  SELECT
    websearch_to_tsquery('spanish', params.query_text) AS ts_query,
    params.result_limit
  FROM params
)
SELECT
  d.title AS document_title,
  s.citation_label,
  s.page_start,
  ts_rank_cd(s.content_tsv, search.ts_query) AS keyword_score,
  ts_headline(
    'spanish',
    s.content,
    search.ts_query,
    'StartSel=<mark>, StopSel=</mark>, MaxWords=45, MinWords=18'
  ) AS snippet
FROM rag.document_sections s
JOIN rag.document_versions v ON v.id = s.document_version_id
JOIN rag.documents d ON d.id = v.document_id
CROSS JOIN search
WHERE s.content_tsv @@ search.ts_query
ORDER BY keyword_score DESC, s.page_start ASC
LIMIT (SELECT result_limit FROM search);

