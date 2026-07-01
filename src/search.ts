import { pool } from "./db.js";

export interface KeywordSearchResult {
  documentTitle: string;
  documentType: string;
  citationLabel: string;
  pageStart: number | null;
  keywordScore: number;
  snippet: string;
}

export interface PhraseSearchResult {
  documentTitle: string;
  documentType: string;
  citationLabel: string;
  pageStart: number | null;
  preview: string;
}

export const keywordSearch = async (
  queryText: string,
  limit = 10
): Promise<KeywordSearchResult[]> => {
  const result = await pool.query(
    `
      WITH search AS (
        SELECT websearch_to_tsquery('spanish', $1) AS ts_query
      )
      SELECT
        d.title AS document_title,
        d.document_type,
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
      LIMIT $2;
    `,
    [queryText, limit]
  );

  return result.rows.map((row) => ({
    documentTitle: row.document_title,
    documentType: row.document_type as string,
    citationLabel: row.citation_label,
    pageStart: row.page_start,
    keywordScore: Number(row.keyword_score),
    snippet: row.snippet,
  }));
};

export const phraseSearch = async (
  phrase: string,
  limit = 10
): Promise<PhraseSearchResult[]> => {
  const result = await pool.query(
    `
      SELECT
        d.title AS document_title,
        d.document_type,
        s.citation_label,
        s.page_start,
        left(s.content, 700) AS preview
      FROM rag.document_sections s
      JOIN rag.document_versions v ON v.id = s.document_version_id
      JOIN rag.documents d ON d.id = v.document_id
      WHERE s.content ILIKE '%' || $1 || '%'
      ORDER BY s.page_start ASC
      LIMIT $2;
    `,
    [phrase, limit]
  );

  return result.rows.map((row) => ({
    documentTitle: row.document_title,
    documentType: row.document_type as string,
    citationLabel: row.citation_label,
    pageStart: row.page_start,
    preview: row.preview,
  }));
};

