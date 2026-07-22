import type { TenantTransactionClient } from "../security/index.js";
import { isCanonicalUuid } from "../security/index.js";
import type { VectorCandidateInput } from "../retrieval/vectorRetriever.js";
import { MAX_CHUNKS_PER_DOCUMENT } from "./indexer.js";
import {
  DEFAULT_VECTOR_DIMENSION,
  PgVectorRepositoryError,
  embeddingRecordToPgVectorValues,
  pgVectorRowToVectorCandidate,
  toPgVectorLiteral,
  type PgVectorRow,
} from "./pgVectorRepository.js";
import type { EmbeddingVectorRecord } from "./types.js";

export interface TenantVectorScope {
  tenantId: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: number;
}

export interface TenantVectorGenerationScope {
  documentVersionId: string;
  ingestionJobId: string;
}

export interface TenantVectorReplaceResult {
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  deletedCount: number;
}

export interface TenantVectorDocumentIdentity {
  documentKey: string;
  documentTitle: string;
  documentVersion: string;
}

const SAFE_MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const SAFE_CLASSIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,63}$/;
const SAFE_DOCUMENT_KEY = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,511}$/;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
const MAX_VECTOR_SEARCH_LIMIT = 100;
const VECTOR_WRITE_BATCH_SIZE = 64;
const VECTOR_WRITE_PARAMETERS_PER_RECORD = 23;

const rowsFrom = (value: unknown): Array<Record<string, unknown>> => {
  if (!value || typeof value !== "object" || !Array.isArray((value as { rows?: unknown }).rows)) {
    throw new PgVectorRepositoryError("vector_query_result_invalid", "Vector query returned an invalid result.");
  }
  return (value as { rows: Array<Record<string, unknown>> }).rows;
};

const rowCountFrom = (value: unknown): number => {
  if (!value || typeof value !== "object") {
    throw new PgVectorRepositoryError("vector_query_result_invalid", "Vector query returned an invalid result.");
  }
  const count = (value as { rowCount?: unknown }).rowCount;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
    throw new PgVectorRepositoryError("vector_query_result_invalid", "Vector query returned an invalid row count.");
  }
  return count;
};

const SELECT_EXISTING_BATCH_SQL = `
  SELECT chunk_id, document_version_id, contract_version
  FROM rag.embedding_vectors
  WHERE tenant_id = $1::uuid
    AND chunk_id = ANY($2::text[])
  FOR UPDATE;
`;

const buildBatchUpsertSql = (recordCount: number): string => {
  const groups = Array.from({ length: recordCount }, (_, index) => {
    const offset = index * VECTOR_WRITE_PARAMETERS_PER_RECORD;
    const parameter = (position: number): string => `$${offset + position}`;
    return `(
      ${parameter(1)}::uuid, ${parameter(2)}::uuid, ${parameter(3)}::uuid, 1,
      ${parameter(4)}, ${parameter(5)}, ${parameter(6)}, ${parameter(7)},
      ${parameter(8)}, ${parameter(9)}, ${parameter(10)}, ${parameter(11)},
      ${parameter(12)}, ${parameter(13)}::jsonb, ${parameter(14)},
      ${parameter(15)}, ${parameter(16)}, ${parameter(17)}, ${parameter(18)},
      ${parameter(19)}, ${parameter(20)}, ${parameter(21)},
      ${parameter(22)}::vector, ${parameter(23)}::jsonb, statement_timestamp()
    )`;
  });
  return `
  INSERT INTO rag.embedding_vectors (
    tenant_id,
    document_version_id,
    ingestion_job_id,
    contract_version,
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
  ) VALUES ${groups.join(",\n")}
  ON CONFLICT (tenant_id, chunk_id) DO UPDATE SET
    document_version_id = EXCLUDED.document_version_id,
    ingestion_job_id = EXCLUDED.ingestion_job_id,
    contract_version = 1,
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
    indexed_at = statement_timestamp(),
    updated_at = statement_timestamp()
  WHERE embedding_vectors.document_version_id = EXCLUDED.document_version_id
    AND embedding_vectors.contract_version = 1
    AND (
      embedding_vectors.ingestion_job_id IS DISTINCT FROM EXCLUDED.ingestion_job_id
      OR embedding_vectors.document_key IS DISTINCT FROM EXCLUDED.document_key
      OR embedding_vectors.document_version IS DISTINCT FROM EXCLUDED.document_version
      OR embedding_vectors.document_title IS DISTINCT FROM EXCLUDED.document_title
      OR embedding_vectors.citation_label IS DISTINCT FROM EXCLUDED.citation_label
      OR embedding_vectors.page_start IS DISTINCT FROM EXCLUDED.page_start
      OR embedding_vectors.page_end IS DISTINCT FROM EXCLUDED.page_end
      OR embedding_vectors.article_number IS DISTINCT FROM EXCLUDED.article_number
      OR embedding_vectors.source_type IS DISTINCT FROM EXCLUDED.source_type
      OR embedding_vectors.section_path IS DISTINCT FROM EXCLUDED.section_path
      OR embedding_vectors.section_type IS DISTINCT FROM EXCLUDED.section_type
      OR embedding_vectors.chunk_ordinal IS DISTINCT FROM EXCLUDED.chunk_ordinal
      OR embedding_vectors.chunk_text IS DISTINCT FROM EXCLUDED.chunk_text
      OR embedding_vectors.content_sha256 IS DISTINCT FROM EXCLUDED.content_sha256
      OR embedding_vectors.token_estimate IS DISTINCT FROM EXCLUDED.token_estimate
      OR embedding_vectors.embedding_model IS DISTINCT FROM EXCLUDED.embedding_model
      OR embedding_vectors.embedding_provider IS DISTINCT FROM EXCLUDED.embedding_provider
      OR embedding_vectors.embedding_dimension IS DISTINCT FROM EXCLUDED.embedding_dimension
      OR embedding_vectors.embedding IS DISTINCT FROM EXCLUDED.embedding
      OR embedding_vectors.metadata IS DISTINCT FROM EXCLUDED.metadata
    )
  RETURNING chunk_id;
`;
};

const DELETE_STALE_SQL = `
  DELETE FROM rag.embedding_vectors
  WHERE tenant_id = $1::uuid
    AND document_version_id = $2::uuid
    AND contract_version = 1
    AND ingestion_job_id IS DISTINCT FROM $3::uuid;
`;

const SEARCH_SQL = `
  SELECT
    vector.tenant_id,
    vector.document_version_id,
    vector.ingestion_job_id,
    vector.chunk_id,
    vector.document_key,
    vector.document_version,
    vector.document_title,
    vector.citation_label,
    vector.page_start,
    vector.page_end,
    vector.article_number,
    vector.source_type,
    vector.section_path,
    vector.section_type,
    vector.chunk_ordinal,
    vector.chunk_text,
    vector.content_sha256,
    vector.token_estimate,
    vector.embedding_model,
    vector.embedding_provider,
    vector.embedding_dimension,
    vector.embedding,
    vector.metadata,
    vector.indexed_at,
    1 - (vector.embedding <=> $4::vector) AS similarity
  FROM rag.embedding_vectors AS vector
  JOIN rag.document_versions AS version
    ON version.id = vector.document_version_id
   AND version.tenant_id = vector.tenant_id
  JOIN rag.documents AS document
    ON document.id = version.document_id
   AND document.tenant_id = version.tenant_id
  JOIN rag.ingestion_jobs AS job
    ON job.id = vector.ingestion_job_id
   AND job.tenant_id = vector.tenant_id
  WHERE vector.tenant_id = $1::uuid
    AND vector.contract_version = 1
    AND vector.embedding_provider = $2
    AND vector.embedding_model = $3
    AND vector.embedding_dimension = $5
    AND job.status = 'processed'
    AND version.extraction_status = 'processed'
    AND document.status = 'active'
    AND document.metadata ->> 'confidentiality' = 'public'
    AND length(trim(vector.citation_label)) > 0
  ORDER BY vector.embedding <=> $4::vector
  LIMIT $6;
`;

const valuesFor = (
  scope: TenantVectorScope,
  generation: TenantVectorGenerationScope,
  record: EmbeddingVectorRecord
): unknown[] => {
  const values = embeddingRecordToPgVectorValues(record, scope.embeddingDimension);
  if (!SHA256_HEX_PATTERN.test(values.contentSha256)) {
    throw new PgVectorRepositoryError("invalid_content_sha256", "Vector content digest must be lowercase SHA-256 hex.");
  }
  if (
    typeof values.chunkId !== "string" ||
    values.chunkId.length < 1 ||
    values.chunkId.length > 512 ||
    CONTROL_CHARACTER.test(values.chunkId) ||
    values.documentKey.length < 1 ||
    values.documentKey.length > 512 ||
    !SAFE_DOCUMENT_KEY.test(values.documentKey) ||
    values.documentVersion.length < 1 ||
    values.documentVersion.length > 256 ||
    CONTROL_CHARACTER.test(values.documentVersion) ||
    values.documentTitle.length < 1 ||
    values.documentTitle.length > 1_000 ||
    CONTROL_CHARACTER.test(values.documentTitle) ||
    values.citationLabel.length < 1 ||
    values.citationLabel.length > 2_000 ||
    CONTROL_CHARACTER.test(values.citationLabel) ||
    !SAFE_CLASSIFIER.test(values.sourceType) ||
    !SAFE_CLASSIFIER.test(values.sectionType) ||
    !Number.isSafeInteger(values.chunkOrdinal) ||
    values.chunkOrdinal < 1 ||
    !Number.isSafeInteger(values.tokenEstimate) ||
    values.tokenEstimate < 1 ||
    values.chunkText.length < 1 ||
    values.chunkText.length > 1_048_576 ||
    values.chunkText.includes("\u0000") ||
    (values.articleNumber !== null && (
      values.articleNumber.length < 1 ||
      values.articleNumber.length > 256 ||
      CONTROL_CHARACTER.test(values.articleNumber)
    )) ||
    (values.pageStart !== null && (!Number.isSafeInteger(values.pageStart) || values.pageStart < 1)) ||
    (values.pageEnd !== null && (!Number.isSafeInteger(values.pageEnd) || values.pageEnd < 1)) ||
    (values.pageStart !== null && values.pageEnd !== null && values.pageEnd < values.pageStart) ||
    !Array.isArray(values.sectionPath) ||
    values.sectionPath.some((part) => (
      typeof part !== "string" || part.length < 1 || part.length > 1_000 || CONTROL_CHARACTER.test(part)
    ))
  ) {
    throw new PgVectorRepositoryError(
      "vector_record_shape_invalid",
      "Prepared vector record violates the bounded persistence shape."
    );
  }
  if (typeof values.metadata !== "object" || values.metadata === null || Array.isArray(values.metadata)) {
    throw new PgVectorRepositoryError("vector_metadata_invalid", "Vector metadata must be a JSON object.");
  }
  let metadata: string | undefined;
  let sectionPath: string | undefined;
  try {
    metadata = JSON.stringify(values.metadata);
    sectionPath = JSON.stringify(values.sectionPath);
  } catch (cause) {
    throw new PgVectorRepositoryError(
      "vector_metadata_invalid",
      "Vector metadata must be safely JSON serializable.",
      { cause }
    );
  }
  if (typeof metadata !== "string" || typeof sectionPath !== "string") {
    throw new PgVectorRepositoryError(
      "vector_metadata_invalid",
      "Vector metadata must produce a JSON object and array."
    );
  }
  if (Buffer.byteLength(metadata, "utf8") > 262_144) {
    throw new PgVectorRepositoryError("vector_metadata_too_large", "Vector metadata exceeds the bounded persistence limit.");
  }
  if (Buffer.byteLength(sectionPath, "utf8") > 65_536) {
    throw new PgVectorRepositoryError("vector_section_path_too_large", "Vector section path exceeds the bounded persistence limit.");
  }
  return [
    scope.tenantId,
    generation.documentVersionId,
    generation.ingestionJobId,
    values.chunkId,
    values.documentKey,
    values.documentVersion,
    values.documentTitle,
    values.citationLabel,
    values.pageStart,
    values.pageEnd,
    values.articleNumber,
    values.sourceType,
    sectionPath,
    values.sectionType,
    values.chunkOrdinal,
    values.chunkText,
    values.contentSha256,
    values.tokenEstimate,
    values.embeddingModel,
    values.embeddingProvider,
    values.embeddingDimension,
    values.embeddingLiteral,
    metadata,
  ];
};

export class TenantPgVectorRepository {
  constructor(
    private readonly client: TenantTransactionClient,
    private readonly scope: TenantVectorScope
  ) {
    if (!isCanonicalUuid(scope.tenantId)) {
      throw new PgVectorRepositoryError("vector_scope_invalid", "Vector access requires canonical tenant scope.");
    }
    if (!SAFE_MODEL_NAME.test(scope.embeddingProvider) || !SAFE_MODEL_NAME.test(scope.embeddingModel)) {
      throw new PgVectorRepositoryError("vector_scope_invalid", "Embedding provider and model identifiers are invalid.");
    }
    if (scope.embeddingDimension !== DEFAULT_VECTOR_DIMENSION) {
      throw new PgVectorRepositoryError(
        "vector_dimension_mismatch",
        `Tenant vector persistence requires dimension ${DEFAULT_VECTOR_DIMENSION}.`
      );
    }
  }

  async replaceDocumentVersion(
    records: EmbeddingVectorRecord[],
    documentIdentity: TenantVectorDocumentIdentity,
    generation: TenantVectorGenerationScope
  ): Promise<TenantVectorReplaceResult> {
    if (!isCanonicalUuid(generation?.documentVersionId) || !isCanonicalUuid(generation.ingestionJobId)) {
      throw new PgVectorRepositoryError(
        "vector_scope_invalid",
        "Vector persistence requires canonical document-version and ingestion-job scope."
      );
    }
    if (
      typeof documentIdentity?.documentKey !== "string" ||
      !SAFE_DOCUMENT_KEY.test(documentIdentity.documentKey) ||
      typeof documentIdentity.documentTitle !== "string" ||
      documentIdentity.documentTitle.length < 1 ||
      documentIdentity.documentTitle.length > 1_000 ||
      CONTROL_CHARACTER.test(documentIdentity.documentTitle) ||
      typeof documentIdentity.documentVersion !== "string" ||
      documentIdentity.documentVersion.length < 1 ||
      documentIdentity.documentVersion.length > 256 ||
      CONTROL_CHARACTER.test(documentIdentity.documentVersion)
    ) {
      throw new PgVectorRepositoryError(
        "vector_document_identity_invalid",
        "Vector replacement requires a bounded canonical document identity."
      );
    }
    if (!Array.isArray(records) || records.length < 1 || records.length > MAX_CHUNKS_PER_DOCUMENT) {
      throw new PgVectorRepositoryError(
        "vector_record_count_invalid",
        `Vector replacement requires between 1 and ${MAX_CHUNKS_PER_DOCUMENT} records.`
      );
    }
    const chunkIds = new Set<string>();
    let sourceIdentity: string | undefined;
    const result: TenantVectorReplaceResult = {
      insertedCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      deletedCount: 0,
    };
    const prepared: Array<{ chunkId: string; values: unknown[] }> = [];

    for (const record of records) {
      if (
        record.status !== "embedded" ||
        record.failure !== null ||
        record.chunk.source.documentKey !== documentIdentity.documentKey ||
        record.chunk.source.documentTitle !== documentIdentity.documentTitle ||
        record.chunk.source.documentVersion !== documentIdentity.documentVersion ||
        record.embeddingProvider !== this.scope.embeddingProvider ||
        record.embeddingModel !== this.scope.embeddingModel ||
        record.embeddingDimension !== this.scope.embeddingDimension
      ) {
        throw new PgVectorRepositoryError("vector_record_scope_mismatch", "Prepared vector does not match the leased job scope.");
      }
      if (chunkIds.has(record.chunk.chunkId)) {
        throw new PgVectorRepositoryError("duplicate_vector_chunk", "Prepared vectors contain a duplicate chunk identity.");
      }
      chunkIds.add(record.chunk.chunkId);
      const identity = `${record.chunk.source.documentKey}\u0000${record.chunk.source.documentVersion}`;
      if (sourceIdentity !== undefined && sourceIdentity !== identity) {
        throw new PgVectorRepositoryError("vector_record_scope_mismatch", "Prepared vectors span multiple document identities.");
      }
      sourceIdentity = identity;
      prepared.push({ chunkId: record.chunk.chunkId, values: valuesFor(this.scope, generation, record) });
    }

    for (let start = 0; start < prepared.length; start += VECTOR_WRITE_BATCH_SIZE) {
      const batch = prepared.slice(start, start + VECTOR_WRITE_BATCH_SIZE);
      const batchIds = batch.map(({ chunkId }) => chunkId);
      const batchIdSet = new Set(batchIds);
      const existingRows = rowsFrom(await this.client.query(SELECT_EXISTING_BATCH_SQL, [
        this.scope.tenantId,
        batchIds,
      ]));
      const existingIds = new Set<string>();
      for (const existing of existingRows) {
        if (
          typeof existing.chunk_id !== "string" ||
          !batchIdSet.has(existing.chunk_id) ||
          existingIds.has(existing.chunk_id)
        ) {
          throw new PgVectorRepositoryError(
            "vector_query_result_invalid",
            "Vector conflict lookup returned an invalid result."
          );
        }
        if (
          existing.document_version_id !== generation.documentVersionId ||
          existing.contract_version !== 1
        ) {
          throw new PgVectorRepositoryError(
            "vector_chunk_identity_conflict",
            "Vector chunk identity is already bound to a different document generation."
          );
        }
        existingIds.add(existing.chunk_id);
      }

      const writtenRows = rowsFrom(await this.client.query(
        buildBatchUpsertSql(batch.length),
        batch.flatMap(({ values }) => values)
      ));
      const writtenIds = new Set<string>();
      for (const written of writtenRows) {
        if (
          typeof written.chunk_id !== "string" ||
          !batchIdSet.has(written.chunk_id) ||
          writtenIds.has(written.chunk_id)
        ) {
          throw new PgVectorRepositoryError(
            "vector_query_result_invalid",
            "Vector upsert returned an invalid result."
          );
        }
        writtenIds.add(written.chunk_id);
      }

      for (const { chunkId } of batch) {
        if (writtenIds.has(chunkId)) {
          if (existingIds.has(chunkId)) result.updatedCount += 1;
          else result.insertedCount += 1;
        } else if (existingIds.has(chunkId)) {
          result.unchangedCount += 1;
        } else {
          throw new PgVectorRepositoryError(
            "vector_chunk_identity_conflict",
            "A concurrent vector chunk conflict prevented a complete generation."
          );
        }
      }
    }

    result.deletedCount = rowCountFrom(
      await this.client.query(DELETE_STALE_SQL, [
        this.scope.tenantId,
        generation.documentVersionId,
        generation.ingestionJobId,
      ])
    );
    return result;
  }

  async searchPublic(queryVector: number[], limit: number): Promise<VectorCandidateInput[]> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_VECTOR_SEARCH_LIMIT) {
      throw new PgVectorRepositoryError(
        "vector_search_limit_invalid",
        `Vector search limit must be between 1 and ${MAX_VECTOR_SEARCH_LIMIT}.`
      );
    }
    if (!Array.isArray(queryVector) || queryVector.length !== this.scope.embeddingDimension) {
      throw new PgVectorRepositoryError(
        "vector_dimension_mismatch",
        `Expected vector dimension ${this.scope.embeddingDimension}.`
      );
    }
    const vectorLiteral = toPgVectorLiteral(queryVector);
    const rows = rowsFrom(await this.client.query(SEARCH_SQL, [
      this.scope.tenantId,
      this.scope.embeddingProvider,
      this.scope.embeddingModel,
      vectorLiteral,
      this.scope.embeddingDimension,
      limit,
    ]));
    return rows.map((row) => pgVectorRowToVectorCandidate(row as unknown as PgVectorRow));
  }
}

export const TENANT_VECTOR_SEARCH_LIMIT = MAX_VECTOR_SEARCH_LIMIT;
export const TENANT_VECTOR_WRITE_BATCH_SIZE = VECTOR_WRITE_BATCH_SIZE;
