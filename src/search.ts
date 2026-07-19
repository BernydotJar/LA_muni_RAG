import { pool } from "./db.js";

export interface KeywordSearchResult {
  documentTitle: string;
  documentType: string;
  citationLabel: string;
  pageStart: number | null;
  keywordScore: number;
  snippet: string;
  sourceUrl?: string | null;
  documentId?: string;
  documentVersionId?: string;
  sectionId?: string;
  contentSha256?: string | null;
  officialSource?: boolean;
  documentScope?: string;
  documentStatus?: string;
  versionExtractionStatus?: string;
  documentMetadata?: Record<string, unknown>;
  municipalityName?: string | null;
  municipalitySlug?: string | null;
}

export interface PhraseSearchResult {
  documentTitle: string;
  documentType: string;
  citationLabel: string;
  pageStart: number | null;
  preview: string;
  sourceUrl?: string | null;
  documentId?: string;
  documentVersionId?: string;
  sectionId?: string;
  contentSha256?: string | null;
  officialSource?: boolean;
  documentScope?: string;
  documentStatus?: string;
  versionExtractionStatus?: string;
  documentMetadata?: Record<string, unknown>;
  municipalityName?: string | null;
  municipalitySlug?: string | null;
}

export type ScopedSearchResult = KeywordSearchResult | PhraseSearchResult;

export interface TenantScopedQueryClient {
  query(sql: string, values?: unknown[]): Promise<unknown>;
}

const rowSourceUrl = (row: { source_url?: unknown }): string | null =>
  typeof row.source_url === "string" && row.source_url.trim().length > 0
    ? row.source_url
    : null;

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const optionalNullableString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const rowMetadata = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const rowsFromQuery = (value: unknown): Array<Record<string, unknown>> => {
  if (!value || typeof value !== "object" || !Array.isArray((value as { rows?: unknown }).rows)) {
    throw new Error("Tenant-scoped search returned an invalid query result");
  }
  return (value as { rows: Array<Record<string, unknown>> }).rows;
};

const sourceMetadata = (row: Record<string, unknown>) => ({
  documentId: optionalString(row.document_id),
  documentVersionId: optionalString(row.document_version_id),
  sectionId: optionalString(row.section_id),
  contentSha256: optionalNullableString(row.content_sha256),
  officialSource: row.official_source === true,
  documentScope: optionalString(row.document_scope),
  documentStatus: optionalString(row.document_status),
  versionExtractionStatus: optionalString(row.version_extraction_status),
  documentMetadata: rowMetadata(row.document_metadata),
  municipalityName: optionalNullableString(row.municipality_name),
  municipalitySlug: optionalNullableString(row.municipality_slug),
});

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
        COALESCE(v.source_url, d.source_url) AS source_url,
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
    sourceUrl: rowSourceUrl(row),
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
        COALESCE(v.source_url, d.source_url) AS source_url,
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
    sourceUrl: rowSourceUrl(row),
  }));
};

const TENANT_KEYWORD_SEARCH_SQL = `
  WITH search AS (
    SELECT websearch_to_tsquery('spanish', $1) AS ts_query
  )
  SELECT
    d.id AS document_id,
    v.id AS document_version_id,
    s.id AS section_id,
    d.title AS document_title,
    d.document_type,
    d.document_scope,
    d.status AS document_status,
    v.extraction_status AS version_extraction_status,
    d.official_source,
    d.metadata AS document_metadata,
    v.content_sha256,
    s.citation_label,
    s.page_start,
    municipality.name AS municipality_name,
    municipality.slug AS municipality_slug,
    COALESCE(v.source_url, d.source_url) AS source_url,
    ts_rank_cd(s.content_tsv, search.ts_query) AS keyword_score,
    ts_headline(
      'spanish',
      s.content,
      search.ts_query,
      'StartSel=<mark>, StopSel=</mark>, MaxWords=45, MinWords=18'
    ) AS snippet
  FROM rag.document_sections AS s
  JOIN rag.document_versions AS v
    ON v.id = s.document_version_id
   AND v.tenant_id = $3::uuid
  JOIN rag.documents AS d
    ON d.id = v.document_id
   AND d.tenant_id = $3::uuid
  LEFT JOIN rag.municipalities AS municipality
    ON municipality.id = d.municipality_id
   AND municipality.tenant_id = $3::uuid
  CROSS JOIN search
  WHERE s.tenant_id = $3::uuid
    AND d.status = 'active'
    AND v.extraction_status = 'processed'
    AND d.metadata ->> 'confidentiality' = 'public'
    AND s.content_tsv @@ search.ts_query
  ORDER BY keyword_score DESC, s.page_start ASC, s.id ASC
  LIMIT $2;
`;

const TENANT_PHRASE_SEARCH_SQL = `
  SELECT
    d.id AS document_id,
    v.id AS document_version_id,
    s.id AS section_id,
    d.title AS document_title,
    d.document_type,
    d.document_scope,
    d.status AS document_status,
    v.extraction_status AS version_extraction_status,
    d.official_source,
    d.metadata AS document_metadata,
    v.content_sha256,
    s.citation_label,
    s.page_start,
    municipality.name AS municipality_name,
    municipality.slug AS municipality_slug,
    COALESCE(v.source_url, d.source_url) AS source_url,
    left(s.content, 700) AS preview
  FROM rag.document_sections AS s
  JOIN rag.document_versions AS v
    ON v.id = s.document_version_id
   AND v.tenant_id = $3::uuid
  JOIN rag.documents AS d
    ON d.id = v.document_id
   AND d.tenant_id = $3::uuid
  LEFT JOIN rag.municipalities AS municipality
    ON municipality.id = d.municipality_id
   AND municipality.tenant_id = $3::uuid
  WHERE s.tenant_id = $3::uuid
    AND d.status = 'active'
    AND v.extraction_status = 'processed'
    AND d.metadata ->> 'confidentiality' = 'public'
    AND s.content ILIKE '%' || $1 || '%'
  ORDER BY s.page_start ASC, s.id ASC
  LIMIT $2;
`;

const mapTenantKeywordRow = (row: Record<string, unknown>): KeywordSearchResult => ({
  documentTitle: String(row.document_title ?? ""),
  documentType: String(row.document_type ?? "other"),
  citationLabel: String(row.citation_label ?? ""),
  pageStart: typeof row.page_start === "number" ? row.page_start : null,
  keywordScore: Number(row.keyword_score),
  snippet: String(row.snippet ?? ""),
  sourceUrl: rowSourceUrl(row),
  ...sourceMetadata(row),
});

const mapTenantPhraseRow = (row: Record<string, unknown>): PhraseSearchResult => ({
  documentTitle: String(row.document_title ?? ""),
  documentType: String(row.document_type ?? "other"),
  citationLabel: String(row.citation_label ?? ""),
  pageStart: typeof row.page_start === "number" ? row.page_start : null,
  preview: String(row.preview ?? ""),
  sourceUrl: rowSourceUrl(row),
  ...sourceMetadata(row),
});

/**
 * These closures must be created from the same transaction client that holds
 * the transaction-local tenant setting. SQL also carries explicit tenant
 * predicates as defense in depth; no global pool or vector repository is used.
 */
export const createTenantScopedSearches = (
  client: TenantScopedQueryClient,
  tenantId: string,
  collect?: (results: readonly ScopedSearchResult[]) => void
) => ({
  keywordSearch: async (queryText: string, limit = 10): Promise<KeywordSearchResult[]> => {
    const result = await client.query(TENANT_KEYWORD_SEARCH_SQL, [queryText, limit, tenantId]);
    const rows = rowsFromQuery(result).map(mapTenantKeywordRow);
    collect?.(rows);
    return rows;
  },
  phraseSearch: async (phrase: string, limit = 10): Promise<PhraseSearchResult[]> => {
    const result = await client.query(TENANT_PHRASE_SEARCH_SQL, [phrase, limit, tenantId]);
    const rows = rowsFromQuery(result).map(mapTenantPhraseRow);
    collect?.(rows);
    return rows;
  },
});
