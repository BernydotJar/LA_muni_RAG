import type { Pool } from "pg";
import { pool as defaultPool } from "../db.js";
import type { TenantTransactionClient, TenantTransactionPool } from "../security/index.js";
import {
  CatalogRepositoryError,
  type CatalogAuditInput,
  type CatalogCursor,
  type CatalogIdempotencyClaim,
  type CatalogIdempotencyScope,
  type CatalogListInput,
  type CatalogPage,
  type CatalogRepository,
  type DocumentCreateRequestV1,
  type StoredDocument,
  type StoredIngestionJobSummary,
  type StoredProcedureSummary,
  type StoredSource,
} from "../api/v1/catalogTypes.js";

const rowsFrom = (result: unknown): Record<string, unknown>[] => {
  if (!result || typeof result !== "object") return [];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
};
const rowCountFrom = (result: unknown): number => {
  if (!result || typeof result !== "object") return 0;
  const value = (result as { rowCount?: unknown }).rowCount;
  return typeof value === "number" ? value : 0;
};
const iso = (value: unknown): string => value instanceof Date
  ? value.toISOString()
  : new Date(String(value)).toISOString();
const nullable = (value: unknown): string | null => value === null || value === undefined ? null : String(value);
const integer = (value: unknown): number => Number(value);
const boolean = (value: unknown): boolean => value === true || value === "true";
const stringArray = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((item): item is string => typeof item === "string")
  : [];

const compareDescending = (left: { createdAt: string; id: string }, right: { createdAt: string; id: string }): number => {
  const date = right.createdAt.localeCompare(left.createdAt);
  return date !== 0 ? date : right.id.localeCompare(left.id);
};
const afterCursor = (item: { createdAt: string; id: string }, cursor: CatalogCursor | null): boolean => {
  if (!cursor) return true;
  return item.createdAt < cursor.createdAt || (item.createdAt === cursor.createdAt && item.id < cursor.id);
};
const pageOf = <T extends { createdAt: string }>(
  items: T[],
  idFor: (item: T) => string,
  input: CatalogListInput
): CatalogPage<T> => {
  const ordered = items
    .filter((item) => afterCursor({ createdAt: item.createdAt, id: idFor(item) }, input.cursor))
    .sort((left, right) => compareDescending(
      { createdAt: left.createdAt, id: idFor(left) },
      { createdAt: right.createdAt, id: idFor(right) }
    ));
  const selected = ordered.slice(0, input.limit);
  const hasMore = ordered.length > input.limit;
  const last = selected.at(-1);
  return {
    items: structuredClone(selected),
    nextCursor: hasMore && last ? { createdAt: last.createdAt, id: idFor(last) } : null,
  };
};

interface InMemoryIdempotency extends CatalogIdempotencyScope {
  state: "processing" | "completed";
  responseStatus: 201 | null;
  responseBody: string | null;
  responseSha256: string | null;
  auditId: string | null;
  completedAt: string | null;
}

export class InMemoryCatalogRepository implements CatalogRepository {
  readonly sources = new Map<string, StoredSource>();
  readonly documents = new Map<string, StoredDocument>();
  readonly ingestionJobs: StoredIngestionJobSummary[] = [];
  readonly procedures: StoredProcedureSummary[] = [];
  readonly audits: CatalogAuditInput[] = [];
  readonly authenticationFailures: Array<{ auditId: string; reasonCode: string }> = [];
  readonly idempotency = new Map<string, InMemoryIdempotency>();
  readonly rateLimits = new Map<string, number>();
  listCalls = 0;

  constructor(private readonly now: () => Date = () => new Date()) {}

  private sourceKey(tenantId: string, sourceId: string): string {
    return `${tenantId.toLowerCase()}:${sourceId.toLowerCase()}`;
  }
  private documentKey(tenantId: string, documentId: string): string {
    return `${tenantId.toLowerCase()}:${documentId.toLowerCase()}`;
  }
  private replayKey(input: CatalogIdempotencyScope): string {
    return `${input.tenantId}:${input.principalId}:${input.operation}:${input.idempotencyKeySha256}`;
  }

  async consumeRateLimit(_client: TenantTransactionClient, input: {
    tenantId: string; principalId: string; operation: CatalogAuditInput["operation"];
    limit: number; windowSeconds: number; now: string; blockedAuditId: string;
  }): Promise<{ allowed: boolean; retryAfterSeconds: number; auditId?: string; shouldAudit?: boolean }> {
    const epoch = Date.parse(input.now);
    const bucket = Math.floor(epoch / (input.windowSeconds * 1000));
    const key = `${input.tenantId}:${input.principalId}:${input.operation}:${bucket}`;
    const count = (this.rateLimits.get(key) ?? 0) + 1;
    this.rateLimits.set(key, count);
    const retry = input.windowSeconds - Math.floor((epoch / 1000) % input.windowSeconds);
    return count <= input.limit
      ? { allowed: true, retryAfterSeconds: Math.max(1, retry) }
      : { allowed: false, retryAfterSeconds: Math.max(1, retry), auditId: input.blockedAuditId, shouldAudit: count === input.limit + 1 };
  }

  async claimIdempotency(_client: TenantTransactionClient, input: CatalogIdempotencyScope): Promise<CatalogIdempotencyClaim> {
    const key = this.replayKey(input);
    const existing = this.idempotency.get(key);
    if (!existing || Date.parse(existing.expiresAt) <= Date.parse(input.now)) {
      this.idempotency.set(key, {
        ...input, state: "processing", responseStatus: null, responseBody: null,
        responseSha256: null, auditId: null, completedAt: null,
      });
      return { kind: "new" };
    }
    if (existing.requestSha256 !== input.requestSha256) return { kind: "conflict" };
    if (existing.state === "processing") return { kind: "processing" };
    return {
      kind: "replay",
      responseStatus: existing.responseStatus!,
      responseBody: existing.responseBody!,
      responseSha256: existing.responseSha256!,
      auditId: existing.auditId!,
    };
  }

  async completeIdempotency(_client: TenantTransactionClient, input: CatalogIdempotencyScope & {
    responseStatus: 201; responseBody: string; responseSha256: string; auditId: string; completedAt: string;
  }): Promise<void> {
    const key = this.replayKey(input);
    const existing = this.idempotency.get(key);
    if (!existing || existing.state !== "processing" || existing.requestSha256 !== input.requestSha256) {
      throw new Error("catalog idempotency completion mismatch");
    }
    this.idempotency.set(key, {
      ...existing,
      state: "completed",
      responseStatus: input.responseStatus,
      responseBody: input.responseBody,
      responseSha256: input.responseSha256,
      auditId: input.auditId,
      completedAt: input.completedAt,
    });
  }

  async releaseIdempotency(_client: TenantTransactionClient, input: CatalogIdempotencyScope): Promise<void> {
    const key = this.replayKey(input);
    const existing = this.idempotency.get(key);
    if (existing?.state === "processing" && existing.requestSha256 === input.requestSha256) this.idempotency.delete(key);
  }

  async invalidateCompletedIdempotency(_client: TenantTransactionClient, input: CatalogIdempotencyScope): Promise<void> {
    this.idempotency.delete(this.replayKey(input));
  }

  async recordAuthenticationFailure(auditId: string, reasonCode: string): Promise<string> {
    this.authenticationFailures.push({ auditId, reasonCode });
    return auditId;
  }

  async recordAudit(_client: TenantTransactionClient, input: CatalogAuditInput): Promise<void> {
    this.audits.push(structuredClone(input));
  }

  async createSource(_client: TenantTransactionClient, input: Parameters<CatalogRepository["createSource"]>[1]): Promise<StoredSource> {
    const duplicate = [...this.sources.values()].some((source) =>
      source.tenantId === input.request.tenant_id && source.sourceKey === input.request.source_key
    );
    if (duplicate) throw new CatalogRepositoryError("duplicate_source", "source key already exists");
    const record: StoredSource = {
      sourceId: input.sourceId,
      tenantId: input.request.tenant_id,
      sourceKey: input.request.source_key,
      title: input.request.title,
      category: input.request.category,
      targetJurisdiction: input.request.target_jurisdiction,
      sourceJurisdiction: input.request.source_jurisdiction,
      sourceRelation: input.request.source_relation,
      discoveryStatus: input.request.discovery_status,
      discoveryUrl: input.request.discovery_url,
      artifactUrl: input.request.artifact_url,
      observedVersion: input.request.observed_version,
      publicationDate: input.request.publication_date,
      effectiveDate: input.request.effective_date,
      limitations: [...input.request.limitations],
      validationState: "unreviewed",
      officialSource: false,
      officialForTargetJurisdiction: false,
      acquisitionState: "not_acquired",
      ingestionState: "not_ingested",
      retrievalState: "not_indexed",
      createdByPrincipalId: input.principal.principalId,
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.sources.set(this.sourceKey(record.tenantId, record.sourceId), record);
    return structuredClone(record);
  }

  async getSource(_client: TenantTransactionClient, tenantId: string, sourceId: string): Promise<StoredSource | null> {
    const record = this.sources.get(this.sourceKey(tenantId, sourceId));
    return record ? structuredClone(record) : null;
  }

  async listSources(_client: TenantTransactionClient, input: CatalogListInput): Promise<CatalogPage<StoredSource>> {
    this.listCalls += 1;
    const items = [...this.sources.values()].filter((source) =>
      source.tenantId === input.tenantId
      && (!input.filters.discovery_status || source.discoveryStatus === input.filters.discovery_status)
      && (!input.filters.source_relation || source.sourceRelation === input.filters.source_relation)
      && (!input.filters.category || source.category === input.filters.category)
    );
    return pageOf(items, (item) => item.sourceId, input);
  }

  async createDocument(_client: TenantTransactionClient, input: Parameters<CatalogRepository["createDocument"]>[1]): Promise<StoredDocument | null> {
    const source = this.sources.get(this.sourceKey(input.request.tenant_id, input.request.source_id));
    if (!source) return null;
    const duplicate = [...this.documents.values()].some((document) =>
      document.tenantId === input.request.tenant_id
      && document.version.contentSha256 === input.request.version.content_sha256
    );
    if (duplicate) throw new CatalogRepositoryError("duplicate_document", "document content already exists");
    const record: StoredDocument = {
      documentId: input.documentId,
      tenantId: input.request.tenant_id,
      sourceId: input.request.source_id,
      title: input.request.title,
      documentType: input.request.document_type,
      documentScope: input.request.document_scope,
      issuingAuthority: input.request.issuing_authority,
      officialSource: source.officialSource,
      documentStatus: "draft",
      confidentiality: input.request.confidentiality,
      registeredByPrincipalId: input.principal.principalId,
      createdAt: input.now,
      updatedAt: input.now,
      version: {
        documentVersionId: input.documentVersionId,
        versionLabel: input.request.version.version_label,
        sourceUrl: input.request.version.source_url,
        originalFilename: input.request.version.original_filename,
        mimeType: input.request.version.mime_type,
        contentSha256: input.request.version.content_sha256,
        pageCount: input.request.version.page_count,
        extractionState: "queued",
        createdAt: input.now,
      },
      artifactAcceptance: {
        state: "not_accepted", artifactObjectId: null, artifactScanId: null, acceptedUntil: null,
      },
      ingestionState: "not_started",
      retrievalState: "not_indexed",
    };
    this.documents.set(this.documentKey(record.tenantId, record.documentId), record);
    return structuredClone(record);
  }

  async getDocument(_client: TenantTransactionClient, tenantId: string, documentId: string): Promise<StoredDocument | null> {
    const record = this.documents.get(this.documentKey(tenantId, documentId));
    return record ? structuredClone(record) : null;
  }

  async listDocuments(_client: TenantTransactionClient, input: CatalogListInput): Promise<CatalogPage<StoredDocument>> {
    this.listCalls += 1;
    const items = [...this.documents.values()].filter((document) =>
      document.tenantId === input.tenantId
      && (!input.filters.document_type || document.documentType === input.filters.document_type)
      && (!input.filters.confidentiality || document.confidentiality === input.filters.confidentiality)
      && (!input.filters.source_id || document.sourceId === input.filters.source_id)
      && (!input.filters.document_status || document.documentStatus === input.filters.document_status)
    );
    return pageOf(items, (item) => item.documentId, input);
  }

  seedIngestionJob(record: StoredIngestionJobSummary): void {
    this.ingestionJobs.push(structuredClone(record));
  }
  async listIngestionJobs(_client: TenantTransactionClient, input: CatalogListInput): Promise<CatalogPage<StoredIngestionJobSummary>> {
    this.listCalls += 1;
    const items = this.ingestionJobs.filter((job) =>
      job.tenantId === input.tenantId
      && (!input.filters.document_version_id || job.documentVersionId === input.filters.document_version_id)
      && (!input.filters.status || job.status === input.filters.status)
    );
    return pageOf(items, (item) => item.jobId, input);
  }

  seedProcedure(record: StoredProcedureSummary): void {
    this.procedures.push(structuredClone(record));
  }
  async listProcedures(_client: TenantTransactionClient, input: CatalogListInput): Promise<CatalogPage<StoredProcedureSummary>> {
    this.listCalls += 1;
    const items = this.procedures.filter((procedure) =>
      procedure.tenantId === input.tenantId
      && (!input.filters.lifecycle_status || procedure.latestLifecycleStatus === input.filters.lifecycle_status)
    );
    return pageOf(items, (item) => item.procedureId, input);
  }
}

const sourceFromRow = (row: Record<string, unknown>): StoredSource => ({
  sourceId: String(row.id),
  tenantId: String(row.tenant_id),
  sourceKey: String(row.source_key),
  title: String(row.title),
  category: row.category as StoredSource["category"],
  targetJurisdiction: String(row.target_jurisdiction),
  sourceJurisdiction: String(row.source_jurisdiction),
  sourceRelation: row.source_relation as StoredSource["sourceRelation"],
  discoveryStatus: row.discovery_status as StoredSource["discoveryStatus"],
  discoveryUrl: nullable(row.discovery_url),
  artifactUrl: nullable(row.artifact_url),
  observedVersion: nullable(row.observed_version),
  publicationDate: nullable(row.publication_date),
  effectiveDate: nullable(row.effective_date),
  limitations: stringArray(row.limitations),
  validationState: row.validation_state as StoredSource["validationState"],
  officialSource: boolean(row.official_source),
  officialForTargetJurisdiction: boolean(row.official_for_target_jurisdiction),
  acquisitionState: row.acquisition_state as StoredSource["acquisitionState"],
  ingestionState: row.ingestion_state as StoredSource["ingestionState"],
  retrievalState: row.retrieval_state as StoredSource["retrievalState"],
  createdByPrincipalId: String(row.created_by_principal_id),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

const documentFromRow = (row: Record<string, unknown>): StoredDocument => ({
  documentId: String(row.document_id),
  tenantId: String(row.tenant_id),
  sourceId: String(row.source_id),
  title: String(row.title),
  documentType: row.document_type as StoredDocument["documentType"],
  documentScope: row.document_scope as StoredDocument["documentScope"],
  issuingAuthority: nullable(row.issuing_authority),
  officialSource: boolean(row.official_source),
  documentStatus: row.document_status as StoredDocument["documentStatus"],
  confidentiality: row.confidentiality as StoredDocument["confidentiality"],
  registeredByPrincipalId: String(row.registered_by_principal_id),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  version: {
    documentVersionId: String(row.document_version_id),
    versionLabel: String(row.version_label),
    sourceUrl: nullable(row.version_source_url),
    originalFilename: nullable(row.original_filename),
    mimeType: nullable(row.mime_type),
    contentSha256: String(row.content_sha256),
    pageCount: row.page_count === null || row.page_count === undefined ? null : integer(row.page_count),
    extractionState: row.extraction_status as StoredDocument["version"]["extractionState"],
    createdAt: iso(row.version_created_at),
  },
  artifactAcceptance: {
    state: (row.artifact_status ?? "not_accepted") as StoredDocument["artifactAcceptance"]["state"],
    artifactObjectId: nullable(row.artifact_object_id),
    artifactScanId: nullable(row.accepted_scan_id),
    acceptedUntil: row.accepted_until ? iso(row.accepted_until) : null,
  },
  ingestionState: (row.ingestion_state ?? "not_started") as StoredDocument["ingestionState"],
  retrievalState: (row.retrieval_state ?? "not_indexed") as StoredDocument["retrievalState"],
});

const DOCUMENT_SELECT = `
  SELECT
    d.id AS document_id, d.tenant_id, d.source_id, d.title, d.document_type,
    d.document_scope, d.issuing_authority, s.official_source,
    d.status AS document_status, d.confidentiality, d.registered_by_principal_id,
    d.created_at, d.updated_at,
    v.id AS document_version_id, v.version_label, v.source_url AS version_source_url,
    v.original_filename, v.mime_type, v.content_sha256, v.page_count,
    v.extraction_status, v.created_at AS version_created_at,
    COALESCE(artifact.status, 'not_accepted') AS artifact_status,
    artifact.id AS artifact_object_id, artifact.accepted_scan_id, artifact.accepted_until,
    CASE
      WHEN job.id IS NULL THEN 'not_started'
      WHEN job.status = 'queued' AND job.last_error_retryable IS TRUE
        AND job.available_at > statement_timestamp() THEN 'retry_wait'
      ELSE job.status::text
    END AS ingestion_state,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM rag.embedding_vectors ev
        WHERE ev.tenant_id = d.tenant_id AND ev.document_version_id = v.id
      ) THEN 'indexed'
      WHEN job.status = 'processing' THEN 'indexing'
      WHEN job.status = 'failed' THEN 'failed'
      ELSE 'not_indexed'
    END AS retrieval_state
  FROM rag.documents d
  JOIN rag.sources s ON s.tenant_id = d.tenant_id AND s.id = d.source_id
  JOIN LATERAL (
    SELECT
      version.id, version.tenant_id, version.document_id, version.version_label,
      version.source_url, version.original_filename, version.mime_type,
      version.content_sha256, version.page_count, version.extraction_status,
      version.created_at
    FROM rag.document_versions version
    WHERE version.tenant_id = d.tenant_id AND version.document_id = d.id
    ORDER BY version.created_at DESC, version.id DESC LIMIT 1
  ) v ON true
  LEFT JOIN LATERAL (
    SELECT
      object.id, object.tenant_id, object.document_version_id, object.status,
      object.accepted_scan_id, object.accepted_until, object.updated_at
    FROM rag.artifact_objects object
    WHERE object.tenant_id = d.tenant_id AND object.document_version_id = v.id
    ORDER BY object.updated_at DESC, object.id DESC LIMIT 1
  ) artifact ON true
  LEFT JOIN LATERAL (
    SELECT
      ingestion.id, ingestion.tenant_id, ingestion.document_version_id,
      ingestion.status, ingestion.available_at, ingestion.last_error_retryable,
      ingestion.created_at
    FROM rag.ingestion_jobs ingestion
    WHERE ingestion.tenant_id = d.tenant_id AND ingestion.document_version_id = v.id
    ORDER BY ingestion.created_at DESC, ingestion.id DESC LIMIT 1
  ) job ON true
`;

export class PostgresCatalogRepository implements CatalogRepository {
  constructor(
    private readonly pool: TenantTransactionPool = defaultPool,
    private readonly authenticationDb: Pick<Pool, "query"> = defaultPool
  ) {}

  async consumeRateLimit(client: TenantTransactionClient, input: Parameters<CatalogRepository["consumeRateLimit"]>[1]) {
    const rows = rowsFrom(await client.query(`
      INSERT INTO rag.catalog_api_rate_limits (
        tenant_id, principal_id, operation, window_started_at, request_count, blocked_audit_id
      ) VALUES (
        $1::uuid, $2::uuid, $3,
        to_timestamp(floor(extract(epoch FROM $6::timestamptz) / $5::integer) * $5::integer),
        1, NULL
      )
      ON CONFLICT (tenant_id, principal_id, operation, window_started_at) DO UPDATE
      SET request_count = LEAST(rag.catalog_api_rate_limits.request_count + 1, 1000000),
          blocked_audit_id = CASE
            WHEN rag.catalog_api_rate_limits.request_count + 1 = $4::integer + 1 THEN $7::uuid
            ELSE rag.catalog_api_rate_limits.blocked_audit_id
          END
      RETURNING request_count,
        GREATEST(1, ceil(extract(epoch FROM (
          window_started_at + make_interval(secs => $5::integer) - $6::timestamptz
        ))))::integer AS retry_after_seconds,
        blocked_audit_id,
        blocked_audit_id = $7::uuid AS should_audit
    `, [
      input.tenantId, input.principalId, input.operation, input.limit,
      input.windowSeconds, input.now, input.blockedAuditId,
    ]));
    const row = rows[0];
    if (!row) throw new Error("catalog rate decision missing");
    const count = integer(row.request_count);
    return {
      allowed: count <= input.limit,
      retryAfterSeconds: integer(row.retry_after_seconds),
      ...(row.blocked_audit_id ? { auditId: String(row.blocked_audit_id) } : {}),
      shouldAudit: boolean(row.should_audit),
    };
  }

  async claimIdempotency(client: TenantTransactionClient, input: CatalogIdempotencyScope): Promise<CatalogIdempotencyClaim> {
    await client.query(`DELETE FROM rag.catalog_api_idempotency
      WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
        AND expires_at <= $4::timestamptz`, [
      input.tenantId, input.principalId, input.operation, input.now,
    ]);
    const inserted = await client.query(`INSERT INTO rag.catalog_api_idempotency (
      tenant_id, principal_id, operation, idempotency_key_sha256, request_sha256,
      created_at, expires_at
    ) VALUES (
      $1::uuid, $2::uuid, $3, decode($4, 'hex'), decode($5, 'hex'),
      $6::timestamptz, $7::timestamptz
    ) ON CONFLICT DO NOTHING`, [
      input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256,
      input.requestSha256, input.now, input.expiresAt,
    ]);
    if (rowCountFrom(inserted) === 1) return { kind: "new" };
    const rows = rowsFrom(await client.query(`SELECT state, encode(request_sha256, 'hex') AS request_sha256,
      response_status, response_body, encode(response_sha256, 'hex') AS response_sha256, audit_id
      FROM rag.catalog_api_idempotency
      WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
        AND idempotency_key_sha256 = decode($4, 'hex')
      FOR UPDATE`, [input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256]));
    const row = rows[0];
    if (!row) throw new Error("catalog idempotency claim missing");
    if (String(row.request_sha256) !== input.requestSha256) return { kind: "conflict" };
    if (row.state === "processing") return { kind: "processing" };
    return {
      kind: "replay",
      responseStatus: 201,
      responseBody: String(row.response_body),
      responseSha256: String(row.response_sha256),
      auditId: String(row.audit_id),
    };
  }

  async completeIdempotency(client: TenantTransactionClient, input: CatalogIdempotencyScope & {
    responseStatus: 201; responseBody: string; responseSha256: string; auditId: string; completedAt: string;
  }): Promise<void> {
    const result = await client.query(`UPDATE rag.catalog_api_idempotency SET
      state = 'completed', response_status = $6, response_body = $7,
      response_sha256 = decode($8, 'hex'), audit_id = $9::uuid, completed_at = $10::timestamptz
      WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
        AND idempotency_key_sha256 = decode($4, 'hex')
        AND request_sha256 = decode($5, 'hex') AND state = 'processing'`, [
      input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256,
      input.requestSha256, input.responseStatus, input.responseBody, input.responseSha256,
      input.auditId, input.completedAt,
    ]);
    if (rowCountFrom(result) !== 1) throw new Error("catalog idempotency completion mismatch");
  }

  async releaseIdempotency(client: TenantTransactionClient, input: CatalogIdempotencyScope): Promise<void> {
    await client.query(`DELETE FROM rag.catalog_api_idempotency
      WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
        AND idempotency_key_sha256 = decode($4, 'hex')
        AND request_sha256 = decode($5, 'hex') AND state = 'processing'`, [
      input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256, input.requestSha256,
    ]);
  }

  async invalidateCompletedIdempotency(client: TenantTransactionClient, input: CatalogIdempotencyScope): Promise<void> {
    await client.query(`DELETE FROM rag.catalog_api_idempotency
      WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
        AND idempotency_key_sha256 = decode($4, 'hex')`, [
      input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256,
    ]);
  }

  async recordAuthenticationFailure(auditId: string, reasonCode: string): Promise<string> {
    const rows = rowsFrom(await this.authenticationDb.query(
      "SELECT identity.record_catalog_auth_failure($1::uuid, $2) AS audit_id",
      [auditId, reasonCode]
    ));
    return String(rows[0]?.audit_id ?? auditId);
  }

  async recordAudit(client: TenantTransactionClient, input: CatalogAuditInput): Promise<void> {
    await client.query(`INSERT INTO audit.events (
      id, tenant_id, actor_external_id, event_type, entity_schema, entity_table,
      entity_id, outcome, details, created_at
    ) VALUES ($1::uuid, $2::uuid, $3, $4, 'rag', $5, $6::uuid, $7, $8::jsonb, statement_timestamp())`, [
      input.auditId, input.tenantId, input.principalId, input.eventType, input.entityTable,
      input.entityId, input.outcome, JSON.stringify({
        reason_code: input.reasonCode,
        request_id: input.requestId,
        operation: input.operation,
        credential_id: input.credentialId,
      }),
    ]);
  }

  async createSource(client: TenantTransactionClient, input: Parameters<CatalogRepository["createSource"]>[1]): Promise<StoredSource> {
    try {
      const rows = rowsFrom(await client.query(`INSERT INTO rag.sources (
        id, tenant_id, source_key, title, category, target_jurisdiction, source_jurisdiction,
        source_relation, discovery_status, discovery_url, artifact_url, observed_version,
        publication_date, effective_date, limitations, created_by_principal_id, created_at, updated_at
      ) VALUES (
        $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13::date, $14::date, $15::jsonb, $16::uuid, $17::timestamptz, $17::timestamptz
      ) RETURNING *`, [
        input.sourceId, input.request.tenant_id, input.request.source_key, input.request.title,
        input.request.category, input.request.target_jurisdiction, input.request.source_jurisdiction,
        input.request.source_relation, input.request.discovery_status, input.request.discovery_url,
        input.request.artifact_url, input.request.observed_version, input.request.publication_date,
        input.request.effective_date, JSON.stringify(input.request.limitations),
        input.principal.principalId, input.now,
      ]));
      if (!rows[0]) throw new Error("source insert returned no row");
      return sourceFromRow(rows[0]);
    } catch (error) {
      if ((error as { code?: unknown }).code === "23505") {
        throw new CatalogRepositoryError("duplicate_source", "source key already exists");
      }
      throw error;
    }
  }

  async getSource(client: TenantTransactionClient, tenantId: string, sourceId: string): Promise<StoredSource | null> {
    const rows = rowsFrom(await client.query(
      "SELECT * FROM rag.sources WHERE tenant_id = $1::uuid AND id = $2::uuid",
      [tenantId, sourceId]
    ));
    return rows[0] ? sourceFromRow(rows[0]) : null;
  }

  async listSources(client: TenantTransactionClient, input: CatalogListInput): Promise<CatalogPage<StoredSource>> {
    const rows = rowsFrom(await client.query(`SELECT * FROM rag.sources
      WHERE tenant_id = $1::uuid
        AND ($2::text IS NULL OR discovery_status = $2)
        AND ($3::text IS NULL OR source_relation = $3)
        AND ($4::text IS NULL OR category = $4)
        AND ($5::timestamptz IS NULL OR (created_at, id) < ($5::timestamptz, $6::uuid))
      ORDER BY created_at DESC, id DESC LIMIT $7::integer`, [
      input.tenantId, input.filters.discovery_status ?? null, input.filters.source_relation ?? null,
      input.filters.category ?? null, input.cursor?.createdAt ?? null, input.cursor?.id ?? null,
      input.limit + 1,
    ]));
    const hasMore = rows.length > input.limit;
    const mapped = rows.slice(0, input.limit).map(sourceFromRow);
    const last = mapped.at(-1);
    return { items: mapped, nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.sourceId } : null };
  }

  async getDocument(client: TenantTransactionClient, tenantId: string, documentId: string): Promise<StoredDocument | null> {
    const rows = rowsFrom(await client.query(`${DOCUMENT_SELECT}
      WHERE d.tenant_id = $1::uuid AND d.id = $2::uuid`, [tenantId, documentId]));
    return rows[0] ? documentFromRow(rows[0]) : null;
  }

  async createDocument(client: TenantTransactionClient, input: Parameters<CatalogRepository["createDocument"]>[1]): Promise<StoredDocument | null> {
    try {
      const inserted = await client.query(`WITH source AS (
        SELECT id, official_source FROM rag.sources
        WHERE tenant_id = $2::uuid AND id = $3::uuid
      ), document AS (
        INSERT INTO rag.documents (
          id, tenant_id, source_id, title, document_type, document_scope,
          issuing_authority, source_kind, source_url,
          confidentiality, registered_by_principal_id, created_at, updated_at
        )
        SELECT $1::uuid, $2::uuid, source.id, $4, $5::rag.document_type,
          $6::rag.document_scope, $7, 'unknown'::rag.source_kind, $8,
          $9, $10::uuid, $11::timestamptz, $11::timestamptz
        FROM source RETURNING id
      )
      INSERT INTO rag.document_versions (
        id, tenant_id, document_id, version_label, source_url, original_filename,
        mime_type, content_sha256, page_count, created_at
      )
      SELECT $12::uuid, $2::uuid, document.id, $13, $8, $14, $15,
        $16, $17::integer, $11::timestamptz
      FROM document`, [
        input.documentId, input.request.tenant_id, input.request.source_id, input.request.title,
        input.request.document_type, input.request.document_scope, input.request.issuing_authority,
        input.request.version.source_url, input.request.confidentiality, input.principal.principalId,
        input.now, input.documentVersionId, input.request.version.version_label,
        input.request.version.original_filename, input.request.version.mime_type,
        input.request.version.content_sha256, input.request.version.page_count,
      ]);
      if (rowCountFrom(inserted) !== 1) return null;
      return this.getDocument(client, input.request.tenant_id, input.documentId);
    } catch (error) {
      if ((error as { code?: unknown }).code === "23505") {
        throw new CatalogRepositoryError("duplicate_document", "document identity already exists");
      }
      throw error;
    }
  }

  async listDocuments(client: TenantTransactionClient, input: CatalogListInput): Promise<CatalogPage<StoredDocument>> {
    const rows = rowsFrom(await client.query(`${DOCUMENT_SELECT}
      WHERE d.tenant_id = $1::uuid
        AND ($2::text IS NULL OR d.document_type::text = $2)
        AND ($3::text IS NULL OR d.confidentiality = $3)
        AND ($4::uuid IS NULL OR d.source_id = $4::uuid)
        AND ($5::text IS NULL OR d.status::text = $5)
        AND ($6::timestamptz IS NULL OR (d.created_at, d.id) < ($6::timestamptz, $7::uuid))
      ORDER BY d.created_at DESC, d.id DESC LIMIT $8::integer`, [
      input.tenantId, input.filters.document_type ?? null, input.filters.confidentiality ?? null,
      input.filters.source_id ?? null, input.filters.document_status ?? null,
      input.cursor?.createdAt ?? null, input.cursor?.id ?? null, input.limit + 1,
    ]));
    const hasMore = rows.length > input.limit;
    const mapped = rows.slice(0, input.limit).map(documentFromRow);
    const last = mapped.at(-1);
    return { items: mapped, nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.documentId } : null };
  }

  async listIngestionJobs(client: TenantTransactionClient, input: CatalogListInput): Promise<CatalogPage<StoredIngestionJobSummary>> {
    const rows = rowsFrom(await client.query(`SELECT tenant_id, id, document_version_id, status,
      attempt_count, max_attempts, available_at, started_at, finished_at,
      last_error_code, last_error_retryable, created_at, updated_at
      FROM rag.ingestion_jobs
      WHERE tenant_id = $1::uuid
        AND ($2::uuid IS NULL OR document_version_id = $2::uuid)
        AND ($3::text IS NULL OR status::text = $3)
        AND ($4::timestamptz IS NULL OR (created_at, id) < ($4::timestamptz, $5::uuid))
      ORDER BY created_at DESC, id DESC LIMIT $6::integer`, [
      input.tenantId, input.filters.document_version_id ?? null, input.filters.status ?? null,
      input.cursor?.createdAt ?? null, input.cursor?.id ?? null, input.limit + 1,
    ]));
    const hasMore = rows.length > input.limit;
    const mapped = rows.slice(0, input.limit).map((row): StoredIngestionJobSummary => ({
      tenantId: String(row.tenant_id),
      jobId: String(row.id),
      documentVersionId: String(row.document_version_id),
      status: row.status as StoredIngestionJobSummary["status"],
      attemptCount: integer(row.attempt_count),
      maxAttempts: integer(row.max_attempts),
      availableAt: iso(row.available_at),
      startedAt: row.started_at ? iso(row.started_at) : null,
      finishedAt: row.finished_at ? iso(row.finished_at) : null,
      lastErrorCode: nullable(row.last_error_code),
      lastErrorRetryable: row.last_error_retryable === null || row.last_error_retryable === undefined
        ? null : boolean(row.last_error_retryable),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    }));
    const last = mapped.at(-1);
    return { items: mapped, nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.jobId } : null };
  }

  async listProcedures(client: TenantTransactionClient, input: CatalogListInput): Promise<CatalogPage<StoredProcedureSummary>> {
    const rows = rowsFrom(await client.query(`SELECT p.tenant_id, p.id, p.procedure_key, p.title,
      p.jurisdiction, p.created_at, p.updated_at,
      latest.version_number AS latest_version_number,
      latest.lifecycle_status AS latest_lifecycle_status,
      approved.id AS approved_workflow_version_id,
      approved.version_number AS approved_version_number
      FROM rag.procedures p
      LEFT JOIN LATERAL (
        SELECT version_number, lifecycle_status FROM rag.procedure_versions v
        WHERE v.tenant_id = p.tenant_id AND v.procedure_id = p.id
        ORDER BY version_number DESC LIMIT 1
      ) latest ON true
      LEFT JOIN LATERAL (
        SELECT id, version_number FROM rag.procedure_versions v
        WHERE v.tenant_id = p.tenant_id AND v.procedure_id = p.id
          AND v.lifecycle_status = 'approved'
        ORDER BY version_number DESC LIMIT 1
      ) approved ON true
      WHERE p.tenant_id = $1::uuid
        AND ($2::text IS NULL OR latest.lifecycle_status = $2)
        AND ($3::timestamptz IS NULL OR (p.created_at, p.id) < ($3::timestamptz, $4::uuid))
      ORDER BY p.created_at DESC, p.id DESC LIMIT $5::integer`, [
      input.tenantId, input.filters.lifecycle_status ?? null,
      input.cursor?.createdAt ?? null, input.cursor?.id ?? null, input.limit + 1,
    ]));
    const hasMore = rows.length > input.limit;
    const mapped = rows.slice(0, input.limit).map((row): StoredProcedureSummary => ({
      tenantId: String(row.tenant_id),
      procedureId: String(row.id),
      procedureKey: String(row.procedure_key),
      title: String(row.title),
      jurisdiction: String(row.jurisdiction),
      latestVersionNumber: row.latest_version_number === null || row.latest_version_number === undefined
        ? null : integer(row.latest_version_number),
      latestLifecycleStatus: row.latest_lifecycle_status as StoredProcedureSummary["latestLifecycleStatus"],
      approvedWorkflowVersionId: nullable(row.approved_workflow_version_id),
      approvedVersionNumber: row.approved_version_number === null || row.approved_version_number === undefined
        ? null : integer(row.approved_version_number),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    }));
    const last = mapped.at(-1);
    return { items: mapped, nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.procedureId } : null };
  }
}
