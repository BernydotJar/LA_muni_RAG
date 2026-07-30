import type { Pool } from "pg";
import { pool as defaultPool } from "../db.js";
import type { TenantTransactionClient, TenantTransactionPool } from "../security/index.js";
import {
  SearchEvidenceRepositoryError,
  type SearchEvidenceAuditInput,
  type SearchEvidenceIdempotencyClaim,
  type SearchEvidenceIdempotencyScope,
  type SearchEvidenceRepository,
  type SearchExecutionInput,
  type SemanticSearchInput,
  type StoredSearchCandidate,
} from "../api/v1/searchEvidenceTypes.js";

const rowsFrom = (result: unknown): Record<string, unknown>[] => {
  if (!result || typeof result !== "object" || !Array.isArray((result as { rows?: unknown }).rows)) {
    throw new SearchEvidenceRepositoryError("invalid_query_result", "Search persistence returned an invalid result.");
  }
  return (result as { rows: Record<string, unknown>[] }).rows;
};
const rowCountFrom = (result: unknown): number => {
  if (!result || typeof result !== "object") return 0;
  const rowCount = (result as { rowCount?: unknown }).rowCount;
  return typeof rowCount === "number" && Number.isSafeInteger(rowCount) ? rowCount : 0;
};
const bool = (value: unknown): boolean => value === true || value === "true";
const nullable = (value: unknown): string | null => value === null || value === undefined ? null : String(value);
const dateOnly = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : new Date(text).toISOString().slice(0, 10);
};
const finite = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const PUBLIC_EVIDENCE_SELECT = `
  source.tenant_id,
  source.id AS source_id,
  source.source_key,
  source.title AS source_title,
  source.source_relation,
  source.target_jurisdiction,
  source.source_jurisdiction,
  source.validation_state,
  source.official_source,
  source.official_for_target_jurisdiction,
  source.acquisition_state,
  source.ingestion_state AS source_ingestion_state,
  source.retrieval_state AS source_retrieval_state,
  COALESCE(document.publication_date, source.publication_date) AS publication_date,
  COALESCE(document.effective_date, source.effective_date) AS effective_date,
  document.repeal_date,
  document.id AS document_id,
  version.id AS document_version_id,
  section.id AS section_id,
  document.title AS document_title,
  document.document_type,
  document.document_scope,
  document.confidentiality,
  document.status AS document_status,
  version.extraction_status,
  COALESCE(version.source_url, document.source_url, source.artifact_url, source.discovery_url) AS source_url,
  version.content_sha256,
  section.citation_label,
  section.content AS excerpt,
  section.page_start,
  section.page_end,
  section.section_number AS article_number
`;

const PUBLIC_EVIDENCE_JOINS = `
  FROM rag.sources AS source
  JOIN rag.documents AS document
    ON document.tenant_id = source.tenant_id
   AND document.source_id = source.id
  JOIN rag.document_versions AS version
    ON version.tenant_id = document.tenant_id
   AND version.document_id = document.id
  JOIN rag.document_sections AS section
    ON section.tenant_id = version.tenant_id
   AND section.document_version_id = version.id
  JOIN rag.artifact_objects AS artifact
    ON artifact.tenant_id = version.tenant_id
   AND artifact.document_version_id = version.id
   AND artifact.status = 'accepted'
   AND artifact.accepted_until > statement_timestamp()
   AND encode(artifact.expected_sha256, 'hex') = version.content_sha256
  JOIN rag.artifact_scans AS scan
    ON scan.tenant_id = artifact.tenant_id
   AND scan.artifact_object_id = artifact.id
   AND scan.id = artifact.accepted_scan_id
   AND scan.verdict = 'clean'
   AND scan.inspection_generation = artifact.inspection_generation
   AND scan.content_sha256 = artifact.expected_sha256
   AND scan.detected_media_type = artifact.declared_media_type
   AND artifact.accepted_until > scan.inspected_at
   AND artifact.accepted_until <= scan.inspected_at + interval '7 days'
  JOIN rag.ingestion_jobs AS job
    ON job.tenant_id = version.tenant_id
   AND job.document_version_id = version.id
   AND job.artifact_object_id = artifact.id
   AND job.artifact_scan_id = scan.id
   AND job.status = 'processed'
  WHERE source.tenant_id = $1::uuid
    AND source.acquisition_state = 'acquired'
    AND source.ingestion_state = 'ingested'
    AND source.retrieval_state = 'indexed'
    AND document.status = 'active'
    AND document.confidentiality = 'public'
    AND version.extraction_status = 'processed'
    AND length(trim(section.citation_label)) > 0
    AND length(trim(section.content)) > 0
    AND COALESCE(version.source_url, document.source_url, source.artifact_url, source.discovery_url) IS NOT NULL
    AND ($4::text[] IS NULL OR document.document_type::text = ANY($4::text[]))
    AND ($5::text[] IS NULL OR source.source_relation = ANY($5::text[]))
    AND ($6::uuid[] IS NULL OR source.id = ANY($6::uuid[]))
`;

const KEYWORD_SQL = `
  SELECT
    ${PUBLIC_EVIDENCE_SELECT},
    NULL::text AS chunk_id,
    ts_rank_cd(section.content_tsv, websearch_to_tsquery('spanish', $2)) AS keyword_score,
    false AS phrase_matched,
    NULL::double precision AS semantic_score
  ${PUBLIC_EVIDENCE_JOINS}
    AND section.content_tsv @@ websearch_to_tsquery('spanish', $2)
  ORDER BY keyword_score DESC, section.page_start ASC NULLS LAST, section.id ASC
  LIMIT $3::integer;
`;

const PHRASE_SQL = `
  SELECT
    ${PUBLIC_EVIDENCE_SELECT},
    NULL::text AS chunk_id,
    NULL::double precision AS keyword_score,
    true AS phrase_matched,
    NULL::double precision AS semantic_score
  ${PUBLIC_EVIDENCE_JOINS}
    AND strpos(lower(section.content), lower($2)) > 0
  ORDER BY section.page_start ASC NULLS LAST, section.id ASC
  LIMIT $3::integer;
`;

const SEMANTIC_SQL = `
  SELECT
    source.tenant_id,
    source.id AS source_id,
    source.source_key,
    source.title AS source_title,
    source.source_relation,
    source.target_jurisdiction,
    source.source_jurisdiction,
    source.validation_state,
    source.official_source,
    source.official_for_target_jurisdiction,
    source.acquisition_state,
    source.ingestion_state AS source_ingestion_state,
    source.retrieval_state AS source_retrieval_state,
    COALESCE(document.publication_date, source.publication_date) AS publication_date,
    COALESCE(document.effective_date, source.effective_date) AS effective_date,
    document.repeal_date,
    document.id AS document_id,
    version.id AS document_version_id,
    section.id AS section_id,
    vector.chunk_id,
    document.title AS document_title,
    document.document_type,
    document.document_scope,
    document.confidentiality,
    document.status AS document_status,
    version.extraction_status,
    COALESCE(version.source_url, document.source_url, source.artifact_url, source.discovery_url) AS source_url,
    version.content_sha256,
    vector.citation_label,
    vector.chunk_text AS excerpt,
    vector.page_start,
    vector.page_end,
    vector.article_number,
    NULL::double precision AS keyword_score,
    false AS phrase_matched,
    1 - (vector.embedding <=> $6::vector) AS semantic_score
  FROM rag.embedding_vectors AS vector
  JOIN rag.document_versions AS version
    ON version.tenant_id = vector.tenant_id
   AND version.id = vector.document_version_id
  JOIN rag.documents AS document
    ON document.tenant_id = version.tenant_id
   AND document.id = version.document_id
  JOIN rag.sources AS source
    ON source.tenant_id = document.tenant_id
   AND source.id = document.source_id
  JOIN LATERAL (
    SELECT candidate.id, candidate.tenant_id, candidate.document_version_id
    FROM rag.document_sections AS candidate
    WHERE candidate.tenant_id = vector.tenant_id
      AND candidate.document_version_id = vector.document_version_id
      AND candidate.citation_label = vector.citation_label
      AND candidate.page_start IS NOT DISTINCT FROM vector.page_start
    ORDER BY candidate.id
    LIMIT 1
  ) AS section ON true
  JOIN rag.artifact_objects AS artifact
    ON artifact.tenant_id = version.tenant_id
   AND artifact.document_version_id = version.id
   AND artifact.status = 'accepted'
   AND artifact.accepted_until > statement_timestamp()
   AND encode(artifact.expected_sha256, 'hex') = version.content_sha256
  JOIN rag.artifact_scans AS scan
    ON scan.tenant_id = artifact.tenant_id
   AND scan.artifact_object_id = artifact.id
   AND scan.id = artifact.accepted_scan_id
   AND scan.verdict = 'clean'
   AND scan.inspection_generation = artifact.inspection_generation
   AND scan.content_sha256 = artifact.expected_sha256
   AND scan.detected_media_type = artifact.declared_media_type
   AND artifact.accepted_until > scan.inspected_at
   AND artifact.accepted_until <= scan.inspected_at + interval '7 days'
  JOIN rag.ingestion_jobs AS job
    ON job.tenant_id = version.tenant_id
   AND job.id = vector.ingestion_job_id
   AND job.document_version_id = version.id
   AND job.artifact_object_id = artifact.id
   AND job.artifact_scan_id = scan.id
   AND job.status = 'processed'
  WHERE vector.tenant_id = $1::uuid
    AND vector.contract_version = 1
    AND vector.embedding_provider = $7
    AND vector.embedding_model = $8
    AND vector.embedding_dimension = $9::integer
    AND source.acquisition_state = 'acquired'
    AND source.ingestion_state = 'ingested'
    AND source.retrieval_state = 'indexed'
    AND document.status = 'active'
    AND document.confidentiality = 'public'
    AND version.extraction_status = 'processed'
    AND length(trim(vector.citation_label)) > 0
    AND length(trim(vector.chunk_text)) > 0
    AND COALESCE(version.source_url, document.source_url, source.artifact_url, source.discovery_url) IS NOT NULL
    AND ($3::text[] IS NULL OR document.document_type::text = ANY($3::text[]))
    AND ($4::text[] IS NULL OR source.source_relation = ANY($4::text[]))
    AND ($5::uuid[] IS NULL OR source.id = ANY($5::uuid[]))
  ORDER BY vector.embedding <=> $6::vector, vector.chunk_id
  LIMIT $2::integer;
`;

const arrayOrNull = <T>(values: T[]): T[] | null => values.length > 0 ? values : null;

const candidateFromRow = (row: Record<string, unknown>): StoredSearchCandidate => ({
  tenantId: String(row.tenant_id),
  sourceId: String(row.source_id),
  sourceKey: String(row.source_key),
  sourceTitle: String(row.source_title),
  sourceRelation: row.source_relation as StoredSearchCandidate["sourceRelation"],
  targetJurisdiction: String(row.target_jurisdiction),
  sourceJurisdiction: String(row.source_jurisdiction),
  validationState: row.validation_state as StoredSearchCandidate["validationState"],
  officialSource: bool(row.official_source),
  officialForTargetJurisdiction: bool(row.official_for_target_jurisdiction),
  acquisitionState: row.acquisition_state as StoredSearchCandidate["acquisitionState"],
  sourceIngestionState: row.source_ingestion_state as StoredSearchCandidate["sourceIngestionState"],
  sourceRetrievalState: row.source_retrieval_state as StoredSearchCandidate["sourceRetrievalState"],
  publicationDate: dateOnly(row.publication_date),
  effectiveDate: dateOnly(row.effective_date),
  repealDate: dateOnly(row.repeal_date),
  documentId: String(row.document_id),
  documentVersionId: String(row.document_version_id),
  sectionId: String(row.section_id),
  chunkId: nullable(row.chunk_id),
  documentTitle: String(row.document_title),
  documentType: row.document_type as StoredSearchCandidate["documentType"],
  documentScope: row.document_scope as StoredSearchCandidate["documentScope"],
  confidentiality: row.confidentiality as StoredSearchCandidate["confidentiality"],
  documentStatus: row.document_status as StoredSearchCandidate["documentStatus"],
  extractionStatus: row.extraction_status as StoredSearchCandidate["extractionStatus"],
  sourceUrl: String(row.source_url),
  contentSha256: String(row.content_sha256),
  citationLabel: String(row.citation_label),
  excerpt: String(row.excerpt).slice(0, 4000),
  pageStart: row.page_start === null || row.page_start === undefined ? null : Number(row.page_start),
  pageEnd: row.page_end === null || row.page_end === undefined ? null : Number(row.page_end),
  articleNumber: nullable(row.article_number),
  keywordScore: finite(row.keyword_score),
  phraseMatched: bool(row.phrase_matched),
  semanticScore: finite(row.semantic_score),
});

const queryValues = (input: SearchExecutionInput): unknown[] => [
  input.tenantId,
  input.query,
  input.limit,
  arrayOrNull(input.filters.document_types),
  arrayOrNull(input.filters.source_relations),
  arrayOrNull(input.filters.source_ids),
];

const safelyPublicUrl = (value: string): boolean => {
  if (value.length < 8 || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username || url.password) return false;
    for (const key of url.searchParams.keys()) {
      const name = key.toLowerCase();
      if (["access_token", "token", "sig", "signature", "api_key", "key", "auth", "se", "sp"].includes(name)
        || name.startsWith("x-amz-") || name.startsWith("x-goog-")) return false;
    }
    return true;
  } catch {
    return false;
  }
};

const eligibleInMemory = (candidate: StoredSearchCandidate, input: SearchExecutionInput): boolean =>
  candidate.tenantId.toLowerCase() === input.tenantId.toLowerCase()
  && candidate.acquisitionState === "acquired"
  && candidate.sourceIngestionState === "ingested"
  && candidate.sourceRetrievalState === "indexed"
  && candidate.documentStatus === "active"
  && candidate.confidentiality === "public"
  && candidate.extractionStatus === "processed"
  && candidate.citationLabel.trim().length > 0
  && candidate.excerpt.trim().length > 0
  && /^[a-f0-9]{64}$/.test(candidate.contentSha256)
  && safelyPublicUrl(candidate.sourceUrl)
  && (input.filters.document_types.length === 0 || input.filters.document_types.includes(candidate.documentType))
  && (input.filters.source_relations.length === 0 || input.filters.source_relations.includes(candidate.sourceRelation))
  && (input.filters.source_ids.length === 0 || input.filters.source_ids.includes(candidate.sourceId.toLowerCase()));

export interface InMemorySearchEvidenceIdempotency extends SearchEvidenceIdempotencyScope {
  state: "processing" | "completed";
  responseStatus: 200 | null;
  responseBody: string | null;
  responseSha256: string | null;
  auditId: string | null;
  completedAt: string | null;
}

export class InMemorySearchEvidenceRepository implements SearchEvidenceRepository {
  readonly candidates: StoredSearchCandidate[] = [];
  readonly searchCalls: Array<{ mode: "keyword" | "phrase" | "semantic"; input: SearchExecutionInput }> = [];
  readonly audits: SearchEvidenceAuditInput[] = [];
  readonly authenticationFailures: Array<{ auditId: string; reasonCode: string }> = [];
  readonly idempotency = new Map<string, InMemorySearchEvidenceIdempotency>();
  readonly rateLimits = new Map<string, { count: number; auditId: string | null }>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  seedCandidate(candidate: StoredSearchCandidate): void {
    this.candidates.push(structuredClone(candidate));
  }

  private replayKey(input: SearchEvidenceIdempotencyScope): string {
    return `${input.tenantId}:${input.principalId}:${input.operation}:${input.idempotencyKeySha256}`;
  }

  async consumeRateLimit(_client: TenantTransactionClient, input: Parameters<SearchEvidenceRepository["consumeRateLimit"]>[1]) {
    const epoch = Date.parse(input.now);
    const bucket = Math.floor(epoch / (input.windowSeconds * 1000));
    const key = `${input.tenantId}:${input.principalId}:${input.operation}:${bucket}`;
    const existing = this.rateLimits.get(key) ?? { count: 0, auditId: null };
    const count = existing.count + 1;
    const auditId = count === input.limit + 1 ? input.blockedAuditId : existing.auditId;
    this.rateLimits.set(key, { count, auditId });
    const retryAfterSeconds = Math.max(1, input.windowSeconds - Math.floor((epoch / 1000) % input.windowSeconds));
    return count <= input.limit
      ? { allowed: true, retryAfterSeconds }
      : { allowed: false, retryAfterSeconds, auditId: auditId ?? input.blockedAuditId, shouldAudit: count === input.limit + 1 };
  }

  async recordAuthenticationFailure(auditId: string, reasonCode: string): Promise<string> {
    this.authenticationFailures.push({ auditId, reasonCode });
    return auditId;
  }

  async recordAudit(_client: TenantTransactionClient, input: SearchEvidenceAuditInput): Promise<void> {
    this.audits.push(structuredClone(input));
  }

  private rows(input: SearchExecutionInput): StoredSearchCandidate[] {
    return this.candidates.filter((candidate) => eligibleInMemory(candidate, input));
  }

  async searchKeyword(_client: TenantTransactionClient, input: SearchExecutionInput): Promise<StoredSearchCandidate[]> {
    this.searchCalls.push({ mode: "keyword", input: structuredClone(input) });
    return this.rows(input)
      .filter((candidate) => candidate.keywordScore !== null)
      .sort((left, right) => (right.keywordScore ?? 0) - (left.keywordScore ?? 0))
      .slice(0, input.limit).map((item) => structuredClone(item));
  }

  async searchPhrase(_client: TenantTransactionClient, input: SearchExecutionInput): Promise<StoredSearchCandidate[]> {
    this.searchCalls.push({ mode: "phrase", input: structuredClone(input) });
    return this.rows(input).filter((candidate) => candidate.phraseMatched)
      .slice(0, input.limit).map((item) => structuredClone(item));
  }

  async searchSemantic(_client: TenantTransactionClient, input: SemanticSearchInput): Promise<StoredSearchCandidate[]> {
    this.searchCalls.push({ mode: "semantic", input: structuredClone(input) });
    if (input.embeddingDimension !== 1536 || input.queryVector.length !== 1536) {
      throw new SearchEvidenceRepositoryError("semantic_dimension_mismatch", "Semantic vector dimension mismatch.");
    }
    return this.rows(input)
      .filter((candidate) => candidate.semanticScore !== null)
      .sort((left, right) => (right.semanticScore ?? 0) - (left.semanticScore ?? 0))
      .slice(0, input.limit).map((item) => structuredClone(item));
  }

  async claimIdempotency(_client: TenantTransactionClient, input: SearchEvidenceIdempotencyScope): Promise<SearchEvidenceIdempotencyClaim> {
    const key = this.replayKey(input);
    const existing = this.idempotency.get(key);
    if (!existing || Date.parse(existing.expiresAt) <= Date.parse(input.now)) {
      this.idempotency.set(key, {
        ...input,
        state: "processing",
        responseStatus: null,
        responseBody: null,
        responseSha256: null,
        auditId: null,
        completedAt: null,
      });
      return { kind: "new" };
    }
    if (existing.requestSha256 !== input.requestSha256) return { kind: "conflict" };
    if (existing.state === "processing") return { kind: "processing" };
    return {
      kind: "replay",
      responseStatus: 200,
      responseBody: existing.responseBody!,
      responseSha256: existing.responseSha256!,
      auditId: existing.auditId!,
    };
  }

  async completeIdempotency(_client: TenantTransactionClient, input: SearchEvidenceIdempotencyScope & {
    responseStatus: 200; responseBody: string; responseSha256: string; auditId: string; completedAt: string;
  }): Promise<void> {
    const key = this.replayKey(input);
    const existing = this.idempotency.get(key);
    if (!existing || existing.state !== "processing" || existing.requestSha256 !== input.requestSha256) {
      throw new SearchEvidenceRepositoryError("idempotency_completion_mismatch", "EvidenceBundle replay completion mismatch.");
    }
    this.idempotency.set(key, {
      ...existing,
      state: "completed",
      responseStatus: 200,
      responseBody: input.responseBody,
      responseSha256: input.responseSha256,
      auditId: input.auditId,
      completedAt: input.completedAt,
    });
  }

  async releaseIdempotency(_client: TenantTransactionClient, input: SearchEvidenceIdempotencyScope): Promise<void> {
    const key = this.replayKey(input);
    const existing = this.idempotency.get(key);
    if (existing?.state === "processing" && existing.requestSha256 === input.requestSha256) this.idempotency.delete(key);
  }

  async invalidateCompletedIdempotency(_client: TenantTransactionClient, input: SearchEvidenceIdempotencyScope): Promise<void> {
    this.idempotency.delete(this.replayKey(input));
  }
}

export class PostgresSearchEvidenceRepository implements SearchEvidenceRepository {
  constructor(
    private readonly transactionPool: TenantTransactionPool = defaultPool,
    private readonly authenticationDb: Pick<Pool, "query"> = defaultPool
  ) {
    void this.transactionPool;
  }

  async consumeRateLimit(client: TenantTransactionClient, input: Parameters<SearchEvidenceRepository["consumeRateLimit"]>[1]) {
    const rows = rowsFrom(await client.query(`
      INSERT INTO rag.search_evidence_api_rate_limits (
        tenant_id, principal_id, operation, window_started_at, request_count, blocked_audit_id
      ) VALUES (
        $1::uuid, $2::uuid, $3,
        to_timestamp(floor(extract(epoch FROM $6::timestamptz) / $5::integer) * $5::integer),
        1, NULL
      )
      ON CONFLICT (tenant_id, principal_id, operation, window_started_at) DO UPDATE
      SET request_count = LEAST(rag.search_evidence_api_rate_limits.request_count + 1, 1000000),
          blocked_audit_id = CASE
            WHEN rag.search_evidence_api_rate_limits.request_count + 1 = $4::integer + 1 THEN $7::uuid
            ELSE rag.search_evidence_api_rate_limits.blocked_audit_id
          END
      RETURNING request_count,
        GREATEST(1, ceil(extract(epoch FROM (
          window_started_at + make_interval(secs => $5::integer) - $6::timestamptz
        ))))::integer AS retry_after_seconds,
        blocked_audit_id,
        blocked_audit_id = $7::uuid AS should_audit
    `, [input.tenantId, input.principalId, input.operation, input.limit,
      input.windowSeconds, input.now, input.blockedAuditId]));
    const row = rows[0];
    if (!row) throw new SearchEvidenceRepositoryError("rate_decision_missing", "Search rate decision missing.");
    const count = Number(row.request_count);
    return {
      allowed: count <= input.limit,
      retryAfterSeconds: Number(row.retry_after_seconds),
      ...(row.blocked_audit_id ? { auditId: String(row.blocked_audit_id) } : {}),
      shouldAudit: bool(row.should_audit),
    };
  }

  async recordAuthenticationFailure(auditId: string, reasonCode: string): Promise<string> {
    const rows = rowsFrom(await this.authenticationDb.query(
      "SELECT identity.record_search_evidence_auth_failure($1::uuid, $2) AS audit_id",
      [auditId, reasonCode]
    ));
    return String(rows[0]?.audit_id ?? auditId);
  }

  async recordAudit(client: TenantTransactionClient, input: SearchEvidenceAuditInput): Promise<void> {
    await client.query(`INSERT INTO audit.events (
      id, tenant_id, actor_external_id, event_type, entity_schema, entity_table,
      entity_id, outcome, details, created_at
    ) VALUES (
      $1::uuid, $2::uuid, $3, $4, 'rag', 'search_evidence', NULL, $5, $6::jsonb, statement_timestamp()
    )`, [input.auditId, input.tenantId, input.principalId, input.eventType, input.outcome, JSON.stringify({
      reason_code: input.reasonCode,
      request_id: input.requestId,
      operation: input.operation,
      credential_id: input.credentialId,
      ...(input.resultCount === undefined ? {} : { result_count: input.resultCount }),
      ...(input.requestedMode === undefined ? {} : { requested_mode: input.requestedMode }),
    })]);
  }

  async searchKeyword(client: TenantTransactionClient, input: SearchExecutionInput): Promise<StoredSearchCandidate[]> {
    return rowsFrom(await client.query(KEYWORD_SQL, queryValues(input)))
      .map(candidateFromRow)
      .filter((candidate) => eligibleInMemory(candidate, input));
  }

  async searchPhrase(client: TenantTransactionClient, input: SearchExecutionInput): Promise<StoredSearchCandidate[]> {
    return rowsFrom(await client.query(PHRASE_SQL, queryValues(input)))
      .map(candidateFromRow)
      .filter((candidate) => eligibleInMemory(candidate, input));
  }

  async searchSemantic(client: TenantTransactionClient, input: SemanticSearchInput): Promise<StoredSearchCandidate[]> {
    if (input.embeddingDimension !== 1536 || input.queryVector.length !== 1536
      || input.queryVector.some((value) => !Number.isFinite(value))) {
      throw new SearchEvidenceRepositoryError("semantic_dimension_mismatch", "Semantic vector dimension mismatch.");
    }
    const literal = `[${input.queryVector.join(",")}]`;
    return rowsFrom(await client.query(SEMANTIC_SQL, [
      input.tenantId,
      input.limit,
      arrayOrNull(input.filters.document_types),
      arrayOrNull(input.filters.source_relations),
      arrayOrNull(input.filters.source_ids),
      literal,
      input.embeddingProvider,
      input.embeddingModel,
      input.embeddingDimension,
    ]))
      .map(candidateFromRow)
      .filter((candidate) => eligibleInMemory(candidate, input));
  }

  async claimIdempotency(client: TenantTransactionClient, input: SearchEvidenceIdempotencyScope): Promise<SearchEvidenceIdempotencyClaim> {
    await client.query(`DELETE FROM rag.search_evidence_api_idempotency
      WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
        AND expires_at <= $4::timestamptz`, [input.tenantId, input.principalId, input.operation, input.now]);
    const inserted = await client.query(`INSERT INTO rag.search_evidence_api_idempotency (
      tenant_id, principal_id, operation, idempotency_key_sha256, request_sha256, created_at, expires_at
    ) VALUES ($1::uuid, $2::uuid, $3, decode($4, 'hex'), decode($5, 'hex'), $6::timestamptz, $7::timestamptz)
    ON CONFLICT DO NOTHING`, [input.tenantId, input.principalId, input.operation,
      input.idempotencyKeySha256, input.requestSha256, input.now, input.expiresAt]);
    if (rowCountFrom(inserted) === 1) return { kind: "new" };
    const rows = rowsFrom(await client.query(`SELECT state, encode(request_sha256, 'hex') AS request_sha256,
      response_status, response_body, encode(response_sha256, 'hex') AS response_sha256, audit_id
      FROM rag.search_evidence_api_idempotency
      WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
        AND idempotency_key_sha256 = decode($4, 'hex') FOR UPDATE`, [
      input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256,
    ]));
    const row = rows[0];
    if (!row) throw new SearchEvidenceRepositoryError("idempotency_claim_missing", "EvidenceBundle replay claim missing.");
    if (String(row.request_sha256) !== input.requestSha256) return { kind: "conflict" };
    if (row.state === "processing") return { kind: "processing" };
    return {
      kind: "replay",
      responseStatus: 200,
      responseBody: String(row.response_body),
      responseSha256: String(row.response_sha256),
      auditId: String(row.audit_id),
    };
  }

  async completeIdempotency(client: TenantTransactionClient, input: SearchEvidenceIdempotencyScope & {
    responseStatus: 200; responseBody: string; responseSha256: string; auditId: string; completedAt: string;
  }): Promise<void> {
    const result = await client.query(`UPDATE rag.search_evidence_api_idempotency SET
      state = 'completed', response_status = $6, response_body = $7,
      response_sha256 = decode($8, 'hex'), audit_id = $9::uuid, completed_at = $10::timestamptz
      WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
        AND idempotency_key_sha256 = decode($4, 'hex')
        AND request_sha256 = decode($5, 'hex') AND state = 'processing'`, [
      input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256,
      input.requestSha256, input.responseStatus, input.responseBody, input.responseSha256,
      input.auditId, input.completedAt,
    ]);
    if (rowCountFrom(result) !== 1) {
      throw new SearchEvidenceRepositoryError("idempotency_completion_mismatch", "EvidenceBundle replay completion mismatch.");
    }
  }

  async releaseIdempotency(client: TenantTransactionClient, input: SearchEvidenceIdempotencyScope): Promise<void> {
    await client.query(`DELETE FROM rag.search_evidence_api_idempotency
      WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
        AND idempotency_key_sha256 = decode($4, 'hex')
        AND request_sha256 = decode($5, 'hex') AND state = 'processing'`, [
      input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256, input.requestSha256,
    ]);
  }

  async invalidateCompletedIdempotency(client: TenantTransactionClient, input: SearchEvidenceIdempotencyScope): Promise<void> {
    await client.query(`DELETE FROM rag.search_evidence_api_idempotency
      WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
        AND idempotency_key_sha256 = decode($4, 'hex')`, [
      input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256,
    ]);
  }
}
