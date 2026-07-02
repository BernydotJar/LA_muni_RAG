import type { Pool } from "pg";
import { pool as defaultPool } from "../db.js";
import type { VectorCandidateInput, VectorRetrievalRepository } from "../retrieval/vectorRetriever.js";
import type { EmbeddingRepository, EmbeddingVectorRecord } from "./types.js";

export const DEFAULT_VECTOR_DIMENSION = 1536;

export interface PgVectorRow {
  chunk_id: string;
  document_key: string;
  document_version: string;
  document_title: string;
  citation_label: string;
  page_start: number | null;
  page_end: number | null;
  article_number: string | null;
  source_type: string;
  section_path: unknown;
  section_type: string;
  chunk_ordinal: number;
  chunk_text: string;
  content_sha256: string;
  token_estimate: number;
  embedding_model: string;
  embedding_provider: string;
  embedding_dimension: number;
  embedding: number[] | string;
  metadata: unknown;
  indexed_at: string | Date;
  similarity?: number | string;
}

export class PgVectorRepositoryError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "PgVectorRepositoryError";
  }
}

export const assertVectorDimension = (
  vector: number[],
  expectedDimension = DEFAULT_VECTOR_DIMENSION
): void => {
  if (vector.length !== expectedDimension) {
    throw new PgVectorRepositoryError(
      "vector_dimension_mismatch",
      `Expected vector dimension ${expectedDimension}, received ${vector.length}.`
    );
  }
};

export const toPgVectorLiteral = (vector: number[]): string => {
  if (vector.some((value) => !Number.isFinite(value))) {
    throw new PgVectorRepositoryError("invalid_vector_value", "Vector contains non-finite values.");
  }
  return `[${vector.join(",")}]`;
};

const requireCitationLabel = (value: string | null): string => {
  const citationLabel = value?.trim() ?? "";
  if (!citationLabel) {
    throw new PgVectorRepositoryError("missing_citation_label", "Embedding chunks must have citation labels.");
  }
  return citationLabel;
};

export interface PgVectorUpsertValues {
  chunkId: string;
  documentKey: string;
  documentVersion: string;
  documentTitle: string;
  citationLabel: string;
  pageStart: number | null;
  pageEnd: number | null;
  articleNumber: string | null;
  sourceType: string;
  sectionPath: string[];
  sectionType: string;
  chunkOrdinal: number;
  chunkText: string;
  contentSha256: string;
  tokenEstimate: number;
  embeddingModel: string;
  embeddingProvider: string;
  embeddingDimension: number;
  embeddingLiteral: string;
  metadata: Record<string, unknown>;
  indexedAt: string;
}

export const embeddingRecordToPgVectorValues = (
  record: EmbeddingVectorRecord,
  expectedDimension = DEFAULT_VECTOR_DIMENSION
): PgVectorUpsertValues => {
  assertVectorDimension(record.embedding, expectedDimension);

  return {
    chunkId: record.chunk.chunkId,
    documentKey: record.chunk.source.documentKey,
    documentVersion: record.chunk.source.documentVersion,
    documentTitle: record.chunk.source.documentTitle,
    citationLabel: requireCitationLabel(record.chunk.source.citationLabel),
    pageStart: record.chunk.source.pageStart,
    pageEnd: record.chunk.source.pageEnd,
    articleNumber: record.chunk.source.articleNumber,
    sourceType: record.chunk.source.sourceFormat,
    sectionPath: record.chunk.source.sectionPath,
    sectionType: record.chunk.source.sectionType,
    chunkOrdinal: record.chunk.chunkOrdinal,
    chunkText: record.chunk.text,
    contentSha256: record.chunk.contentSha256,
    tokenEstimate: record.chunk.tokenEstimate,
    embeddingModel: record.embeddingModel,
    embeddingProvider: record.embeddingProvider,
    embeddingDimension: record.embeddingDimension,
    embeddingLiteral: toPgVectorLiteral(record.embedding),
    metadata: record.chunk.metadata,
    indexedAt: record.indexedAt,
  };
};

export const pgVectorRowToVectorCandidate = (row: PgVectorRow): VectorCandidateInput => ({
  chunkId: row.chunk_id,
  documentTitle: row.document_title,
  citationLabel: requireCitationLabel(row.citation_label),
  excerpt: row.chunk_text,
  sourceType: row.source_type,
  pageStart: row.page_start,
  pageEnd: row.page_end,
  articleNumber: row.article_number,
  similarity: Number(row.similarity ?? 0),
  metadata: {
    documentKey: row.document_key,
    documentVersion: row.document_version,
    sectionPath: row.section_path,
    sectionType: row.section_type,
    contentSha256: row.content_sha256,
    embeddingModel: row.embedding_model,
    embeddingProvider: row.embedding_provider,
    embeddingDimension: row.embedding_dimension,
    ...(typeof row.metadata === "object" && row.metadata !== null ? (row.metadata as Record<string, unknown>) : {}),
  },
});

const UPSERT_SQL = `
  INSERT INTO rag.embedding_vectors (
    chunk_id,
    document_key,
    document_version,
    document_title,
    citation_label,
    page_start,
    page_end,
    article_number,
    source_type,
    section_path,
    section_type,
    chunk_ordinal,
    chunk_text,
    content_sha256,
    token_estimate,
    embedding_model,
    embedding_provider,
    embedding_dimension,
    embedding,
    metadata,
    indexed_at
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15,
    $16, $17, $18, $19::vector, $20::jsonb, $21
  )
  ON CONFLICT (chunk_id) DO UPDATE SET
    document_key = EXCLUDED.document_key,
    document_version = EXCLUDED.document_version,
    document_title = EXCLUDED.document_title,
    citation_label = EXCLUDED.citation_label,
    page_start = EXCLUDED.page_start,
    page_end = EXCLUDED.page_end,
    article_number = EXCLUDED.article_number,
    source_type = EXCLUDED.source_type,
    section_path = EXCLUDED.section_path,
    section_type = EXCLUDED.section_type,
    chunk_ordinal = EXCLUDED.chunk_ordinal,
    chunk_text = EXCLUDED.chunk_text,
    content_sha256 = EXCLUDED.content_sha256,
    token_estimate = EXCLUDED.token_estimate,
    embedding_model = EXCLUDED.embedding_model,
    embedding_provider = EXCLUDED.embedding_provider,
    embedding_dimension = EXCLUDED.embedding_dimension,
    embedding = EXCLUDED.embedding,
    metadata = EXCLUDED.metadata,
    indexed_at = EXCLUDED.indexed_at,
    updated_at = now()
  WHERE
    rag.embedding_vectors.content_sha256 IS DISTINCT FROM EXCLUDED.content_sha256 OR
    rag.embedding_vectors.embedding_model IS DISTINCT FROM EXCLUDED.embedding_model OR
    rag.embedding_vectors.embedding_provider IS DISTINCT FROM EXCLUDED.embedding_provider OR
    rag.embedding_vectors.embedding_dimension IS DISTINCT FROM EXCLUDED.embedding_dimension OR
    rag.embedding_vectors.embedding IS DISTINCT FROM EXCLUDED.embedding
  RETURNING chunk_id;
`;

const SEARCH_SQL = `
  SELECT
    chunk_id,
    document_key,
    document_version,
    document_title,
    citation_label,
    page_start,
    page_end,
    article_number,
    source_type,
    section_path,
    section_type,
    chunk_ordinal,
    chunk_text,
    content_sha256,
    token_estimate,
    embedding_model,
    embedding_provider,
    embedding_dimension,
    embedding,
    metadata,
    indexed_at,
    1 - (embedding <=> $1::vector) AS similarity
  FROM rag.embedding_vectors
  WHERE
    embedding_dimension = $2 AND
    length(trim(citation_label)) > 0
  ORDER BY embedding <=> $1::vector
  LIMIT $3;
`;

export class PgVectorEmbeddingRepository implements EmbeddingRepository, VectorRetrievalRepository {
  constructor(
    private readonly pool: Pool = defaultPool,
    private readonly expectedDimension = DEFAULT_VECTOR_DIMENSION
  ) {}

  async upsert(record: EmbeddingVectorRecord): Promise<"inserted" | "updated" | "unchanged"> {
    const values = embeddingRecordToPgVectorValues(record, this.expectedDimension);
    const result = await this.pool.query(UPSERT_SQL, [
      values.chunkId,
      values.documentKey,
      values.documentVersion,
      values.documentTitle,
      values.citationLabel,
      values.pageStart,
      values.pageEnd,
      values.articleNumber,
      values.sourceType,
      JSON.stringify(values.sectionPath),
      values.sectionType,
      values.chunkOrdinal,
      values.chunkText,
      values.contentSha256,
      values.tokenEstimate,
      values.embeddingModel,
      values.embeddingProvider,
      values.embeddingDimension,
      values.embeddingLiteral,
      JSON.stringify(values.metadata),
      values.indexedAt,
    ]);

    return result.rowCount === 0 ? "unchanged" : "updated";
  }

  async get(_chunkId: string): Promise<EmbeddingVectorRecord | null> {
    throw new PgVectorRepositoryError("not_implemented", "Reading full embedding records is not implemented yet.");
  }

  async list(): Promise<EmbeddingVectorRecord[]> {
    throw new PgVectorRepositoryError("not_implemented", "Listing full embedding records is not implemented yet.");
  }

  async search(queryVector: number[], limit: number): Promise<VectorCandidateInput[]> {
    assertVectorDimension(queryVector, this.expectedDimension);
    const vectorLiteral = toPgVectorLiteral(queryVector);
    const result = await this.pool.query<PgVectorRow>(SEARCH_SQL, [vectorLiteral, this.expectedDimension, limit]);
    return result.rows.map(pgVectorRowToVectorCandidate);
  }
}
