import { createHash, randomBytes, randomUUID } from "node:crypto";
import { TenantPgVectorRepository } from "../embeddings/tenantPgVectorRepository.js";
import type { TenantTransactionClient, TenantTransactionPool } from "../security/index.js";
import { isCanonicalUuid, withTenantTransaction } from "../security/index.js";
import { buildIngestionJobIdentity, canonicalPipelineConfig } from "./jobIdentity.js";
import {
  INGESTION_JOB_TYPE,
  IngestionJobError,
  type CompleteIngestionJobInput,
  type CompleteIngestionJobResult,
  type DurableIngestionJob,
  type DurableIngestionJobStatus,
  type EnqueueIngestionJobInput,
  type EnqueueIngestionJobResult,
  type FailIngestionJobInput,
  type HeartbeatIngestionJobInput,
  type IngestionPipelineConfigV1,
  type LeasedIngestionJob,
} from "./jobTypes.js";

const JOB_COLUMNS = `
  id,
  tenant_id,
  requested_by_principal_id,
  document_version_id,
  encode(artifact_sha256, 'hex') AS artifact_sha256,
  status,
  attempt_count,
  max_attempts,
  available_at,
  started_at,
  finished_at,
  lease_expires_at,
  heartbeat_at,
  last_error_code,
  last_error_retryable,
  pipeline_config,
  created_at,
  updated_at
`;

const QUALIFIED_JOB_COLUMNS = `
  job.id,
  job.tenant_id,
  job.requested_by_principal_id,
  job.document_version_id,
  encode(job.artifact_sha256, 'hex') AS artifact_sha256,
  job.status,
  job.attempt_count,
  job.max_attempts,
  job.available_at,
  job.started_at,
  job.finished_at,
  job.lease_expires_at,
  job.heartbeat_at,
  job.last_error_code,
  job.last_error_retryable,
  job.pipeline_config,
  job.created_at,
  job.updated_at
`;

const INSERT_JOB_SQL = `
  INSERT INTO rag.ingestion_jobs (
    id,
    tenant_id,
    document_version_id,
    status,
    job_type,
    requested_by_principal_id,
    contract_version,
    idempotency_key_sha256,
    request_sha256,
    artifact_sha256,
    pipeline_config_sha256,
    work_sha256,
    pipeline_config,
    attempt_count,
    max_attempts,
    available_at,
    metrics
  ) VALUES (
    $1::uuid,
    $2::uuid,
    $3::uuid,
    'queued',
    '${INGESTION_JOB_TYPE}',
    $4::uuid,
    1,
    decode($5, 'hex'),
    decode($6, 'hex'),
    decode($7, 'hex'),
    decode($8, 'hex'),
    decode($9, 'hex'),
    $10::jsonb,
    0,
    $11,
    statement_timestamp(),
    '{}'::jsonb
  )
  ON CONFLICT DO NOTHING
  RETURNING ${JOB_COLUMNS};
`;

const SELECT_DOCUMENT_IDENTITY_SQL = `
  SELECT version.content_sha256
  FROM rag.document_versions AS version
  JOIN rag.documents AS document
    ON document.id = version.document_id
   AND document.tenant_id = version.tenant_id
  WHERE version.id = $1::uuid
    AND version.tenant_id = $2::uuid
    AND document.status = 'active'
  FOR SHARE OF version;
`;

const SELECT_BY_IDEMPOTENCY_SQL = `
  SELECT ${JOB_COLUMNS}, encode(request_sha256, 'hex') AS request_sha256
  FROM rag.ingestion_jobs
  WHERE tenant_id = $1::uuid
    AND requested_by_principal_id = $2::uuid
    AND job_type = '${INGESTION_JOB_TYPE}'
    AND idempotency_key_sha256 = decode($3, 'hex');
`;

const SELECT_BY_WORK_SQL = `
  SELECT ${JOB_COLUMNS}
  FROM rag.ingestion_jobs
  WHERE tenant_id = $1::uuid
    AND job_type = '${INGESTION_JOB_TYPE}'
    AND work_sha256 = decode($2, 'hex')
    AND status IN ('queued', 'processing', 'processed')
  LIMIT 1;
`;

const EXHAUST_EXPIRED_SQL = `
  WITH exhausted AS (
    SELECT id
    FROM rag.ingestion_jobs
    WHERE tenant_id = $1::uuid
      AND job_type = '${INGESTION_JOB_TYPE}'
      AND status = 'processing'
      AND lease_expires_at <= statement_timestamp()
      AND attempt_count >= max_attempts
    ORDER BY lease_expires_at, id
    FOR UPDATE SKIP LOCKED
    LIMIT 100
  )
  UPDATE rag.ingestion_jobs AS job
  SET
    status = 'failed',
    finished_at = statement_timestamp(),
    lease_owner_sha256 = NULL,
    lease_token_sha256 = NULL,
    lease_expires_at = NULL,
    heartbeat_at = NULL,
    last_error_code = 'lease_expired',
    last_error_retryable = false,
    updated_at = statement_timestamp()
  FROM exhausted
  WHERE job.id = exhausted.id
    AND job.tenant_id = $1::uuid
  RETURNING ${QUALIFIED_JOB_COLUMNS};
`;

const LEASE_NEXT_SQL = `
  WITH candidate AS (
    SELECT id
    FROM rag.ingestion_jobs
    WHERE tenant_id = $1::uuid
      AND job_type = '${INGESTION_JOB_TYPE}'
      AND attempt_count < max_attempts
      AND (
        (status = 'queued' AND available_at <= statement_timestamp())
        OR
        (status = 'processing' AND lease_expires_at <= statement_timestamp())
      )
    ORDER BY available_at, created_at, id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE rag.ingestion_jobs AS job
  SET
    status = 'processing',
    attempt_count = job.attempt_count + 1,
    started_at = COALESCE(job.started_at, statement_timestamp()),
    finished_at = NULL,
    lease_owner_sha256 = decode($2, 'hex'),
    lease_token_sha256 = decode($3, 'hex'),
    lease_expires_at = statement_timestamp() + make_interval(secs => $4),
    heartbeat_at = statement_timestamp(),
    last_error_code = NULL,
    last_error_retryable = NULL,
    updated_at = statement_timestamp()
  FROM candidate
  WHERE job.id = candidate.id
    AND job.tenant_id = $1::uuid
  RETURNING ${QUALIFIED_JOB_COLUMNS};
`;

const HEARTBEAT_SQL = `
  UPDATE rag.ingestion_jobs
  SET
    heartbeat_at = statement_timestamp(),
    lease_expires_at = statement_timestamp() + make_interval(secs => $4),
    updated_at = statement_timestamp()
  WHERE id = $1::uuid
    AND tenant_id = $2::uuid
    AND job_type = '${INGESTION_JOB_TYPE}'
    AND status = 'processing'
    AND lease_token_sha256 = decode($3, 'hex')
    AND lease_expires_at > statement_timestamp()
  RETURNING ${JOB_COLUMNS};
`;

const LOCK_LEASE_SQL = `
  SELECT ${JOB_COLUMNS}
  FROM rag.ingestion_jobs
  WHERE id = $1::uuid
    AND tenant_id = $2::uuid
    AND job_type = '${INGESTION_JOB_TYPE}'
    AND status = 'processing'
    AND lease_token_sha256 = decode($3, 'hex')
    AND lease_expires_at > statement_timestamp()
  FOR UPDATE;
`;

const LOCK_DOCUMENT_VERSION_SQL = `
  SELECT
    version.id,
    version.content_sha256,
    version.version_label,
    document.title AS document_title,
    COALESCE(NULLIF(document.metadata ->> 'document_key', ''), document.id::text) AS document_key
  FROM rag.document_versions AS version
  JOIN rag.documents AS document
    ON document.id = version.document_id
   AND document.tenant_id = version.tenant_id
  WHERE version.id = $1::uuid
    AND version.tenant_id = $2::uuid
    AND document.status = 'active'
  FOR UPDATE OF version;
`;

const COMPLETE_JOB_SQL = `
  UPDATE rag.ingestion_jobs
  SET
    status = 'processed',
    finished_at = statement_timestamp(),
    lease_owner_sha256 = NULL,
    lease_token_sha256 = NULL,
    lease_expires_at = NULL,
    heartbeat_at = NULL,
    last_error_code = NULL,
    last_error_retryable = NULL,
    metrics = $4::jsonb,
    updated_at = statement_timestamp()
  WHERE id = $1::uuid
    AND tenant_id = $2::uuid
    AND status = 'processing'
    AND lease_token_sha256 = decode($3, 'hex')
    AND lease_expires_at > statement_timestamp()
  RETURNING ${JOB_COLUMNS};
`;

const RETRY_JOB_SQL = `
  UPDATE rag.ingestion_jobs
  SET
    status = 'queued',
    available_at = statement_timestamp() + make_interval(secs => $4),
    finished_at = NULL,
    lease_owner_sha256 = NULL,
    lease_token_sha256 = NULL,
    lease_expires_at = NULL,
    heartbeat_at = NULL,
    last_error_code = $5,
    last_error_retryable = true,
    updated_at = statement_timestamp()
  WHERE id = $1::uuid
    AND tenant_id = $2::uuid
    AND status = 'processing'
    AND lease_token_sha256 = decode($3, 'hex')
    AND lease_expires_at > statement_timestamp()
  RETURNING ${JOB_COLUMNS};
`;

const FAIL_JOB_SQL = `
  UPDATE rag.ingestion_jobs
  SET
    status = 'failed',
    finished_at = statement_timestamp(),
    lease_owner_sha256 = NULL,
    lease_token_sha256 = NULL,
    lease_expires_at = NULL,
    heartbeat_at = NULL,
    last_error_code = $4,
    last_error_retryable = $5,
    updated_at = statement_timestamp()
  WHERE id = $1::uuid
    AND tenant_id = $2::uuid
    AND status = 'processing'
    AND lease_token_sha256 = decode($3, 'hex')
    AND lease_expires_at > statement_timestamp()
  RETURNING ${JOB_COLUMNS};
`;

const UPDATE_DOCUMENT_VERSION_SQL = `
  UPDATE rag.document_versions
  SET
    extraction_status = $3::rag.ingestion_status,
    extraction_method = CASE WHEN $3 = 'processed' THEN 'tenant_ingestion_job_v1' ELSE extraction_method END,
    extracted_at = CASE WHEN $3 = 'processed' THEN statement_timestamp() ELSE extracted_at END
  WHERE id = $1::uuid
    AND tenant_id = $2::uuid
  RETURNING id;
`;

const SELECT_JOB_SQL = `
  SELECT ${JOB_COLUMNS}
  FROM rag.ingestion_jobs
  WHERE id = $1::uuid
    AND tenant_id = $2::uuid
    AND job_type = '${INGESTION_JOB_TYPE}';
`;

const INSERT_AUDIT_SQL = `
  INSERT INTO audit.events (
    id,
    tenant_id,
    actor_external_id,
    event_type,
    entity_schema,
    entity_table,
    entity_id,
    outcome,
    details
  ) VALUES (
    $1::uuid,
    $2::uuid,
    $3,
    $4,
    'rag',
    'ingestion_jobs',
    $5::uuid,
    $6,
    $7::jsonb
  );
`;

const SAFE_WORKER_PATTERN = /^[\x20-\x7e]{1,128}$/;
const SAFE_ERROR_CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;
const SAFE_LEASE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
const JOB_STATUSES = new Set<DurableIngestionJobStatus>([
  "queued",
  "processing",
  "processed",
  "failed",
  "superseded",
]);
const DEFAULT_LEASE_SECONDS = 300;
const MIN_LEASE_SECONDS = 30;
const MAX_LEASE_SECONDS = 900;
const MAX_RETRY_DELAY_SECONDS = 900;

const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

const rowsFrom = (value: unknown): Array<Record<string, unknown>> => {
  if (!value || typeof value !== "object" || !Array.isArray((value as { rows?: unknown }).rows)) {
    throw new IngestionJobError("ingestion_persistence_invalid", "Ingestion query returned an invalid result.");
  }
  return (value as { rows: Array<Record<string, unknown>> }).rows;
};

const iso = (value: unknown, nullable = false): string | null => {
  if (nullable && value === null) return null;
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) {
    throw new IngestionJobError("ingestion_persistence_invalid", "Ingestion timestamp is invalid.");
  }
  return date.toISOString();
};

const parsePipelineConfig = (value: unknown): IngestionPipelineConfigV1 => {
  let parsed: unknown;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  } catch (cause) {
    throw new IngestionJobError(
      "ingestion_persistence_invalid",
      "Stored pipeline config is invalid.",
      false,
      { cause }
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new IngestionJobError("ingestion_persistence_invalid", "Stored pipeline config is invalid.");
  }
  const record = parsed as Record<string, unknown>;
  const extractor = record.extractor as Record<string, unknown> | undefined;
  const planner = record.chunk_planner as Record<string, unknown> | undefined;
  const embedding = record.embedding as Record<string, unknown> | undefined;
  const config: IngestionPipelineConfigV1 = {
    contractVersion: record.contract_version as "v1",
    extractor: {
      name: extractor?.name as string,
      version: extractor?.version as string,
    },
    chunkPlanner: {
      name: planner?.name as "section_text_v1",
      maxChars: planner?.max_chars as number,
      overlapChars: planner?.overlap_chars as number,
    },
    embedding: {
      provider: embedding?.provider as string,
      model: embedding?.model as string,
      dimension: embedding?.dimension as number,
    },
  };
  try {
    canonicalPipelineConfig(config);
  } catch (cause) {
    throw new IngestionJobError(
      "ingestion_persistence_invalid",
      "Stored pipeline config is invalid.",
      false,
      { cause }
    );
  }
  return config;
};

const rowToJob = (row: Record<string, unknown> | undefined): DurableIngestionJob => {
  if (
    !row ||
    !isCanonicalUuid(row.id) ||
    !isCanonicalUuid(row.tenant_id) ||
    !isCanonicalUuid(row.requested_by_principal_id) ||
    !isCanonicalUuid(row.document_version_id) ||
    typeof row.artifact_sha256 !== "string" ||
    !SHA256_HEX_PATTERN.test(row.artifact_sha256) ||
    typeof row.status !== "string" ||
    !JOB_STATUSES.has(row.status as DurableIngestionJobStatus) ||
    !Number.isSafeInteger(row.attempt_count) ||
    !Number.isSafeInteger(row.max_attempts) ||
    (row.last_error_code !== null && typeof row.last_error_code !== "string") ||
    (row.last_error_retryable !== null && typeof row.last_error_retryable !== "boolean")
  ) {
    throw new IngestionJobError("ingestion_persistence_invalid", "Stored ingestion job is invalid.");
  }
  return {
    jobId: row.id,
    tenantId: row.tenant_id,
    principalId: row.requested_by_principal_id,
    documentVersionId: row.document_version_id,
    artifactSha256: row.artifact_sha256,
    status: row.status as DurableIngestionJobStatus,
    attemptCount: row.attempt_count as number,
    maxAttempts: row.max_attempts as number,
    availableAt: iso(row.available_at)!,
    startedAt: iso(row.started_at, true),
    finishedAt: iso(row.finished_at, true),
    leaseExpiresAt: iso(row.lease_expires_at, true),
    heartbeatAt: iso(row.heartbeat_at, true),
    lastErrorCode: row.last_error_code as string | null,
    lastErrorRetryable: row.last_error_retryable as boolean | null,
    pipelineConfig: parsePipelineConfig(row.pipeline_config),
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
};

const boundedLeaseSeconds = (value = DEFAULT_LEASE_SECONDS): number => {
  if (!Number.isSafeInteger(value) || value < MIN_LEASE_SECONDS || value > MAX_LEASE_SECONDS) {
    throw new IngestionJobError(
      "ingestion_lease_policy_invalid",
      `Lease duration must be between ${MIN_LEASE_SECONDS} and ${MAX_LEASE_SECONDS} seconds.`
    );
  }
  return value;
};

export interface IngestionJobServiceOptions {
  uuid?: () => string;
  leaseToken?: () => string;
}

export class PostgresIngestionJobService {
  private readonly uuid: () => string;
  private readonly leaseToken: () => string;

  constructor(
    private readonly pool: TenantTransactionPool,
    options: IngestionJobServiceOptions = {}
  ) {
    this.uuid = options.uuid ?? randomUUID;
    this.leaseToken = options.leaseToken ?? (() => randomBytes(32).toString("base64url"));
  }

  private async audit(
    client: TenantTransactionClient,
    job: DurableIngestionJob,
    eventType: string,
    outcome: "success" | "error" | "blocked",
    reasonCode: string,
    extra: Record<string, number | string | boolean> = {},
    actorPrincipalId = job.principalId
  ): Promise<void> {
    if (!SAFE_ERROR_CODE_PATTERN.test(reasonCode) || !isCanonicalUuid(actorPrincipalId)) {
      throw new IngestionJobError("ingestion_audit_invalid", "Unsafe ingestion audit reason.");
    }
    const details = {
      contract_version: "v1",
      job_type: INGESTION_JOB_TYPE,
      reason_code: reasonCode,
      status: job.status,
      attempt_count: job.attemptCount,
      max_attempts: job.maxAttempts,
      ...extra,
    };
    const serialized = JSON.stringify(details);
    if (Buffer.byteLength(serialized, "utf8") > 16_384) {
      throw new IngestionJobError("ingestion_audit_invalid", "Ingestion audit details exceed the bounded limit.");
    }
    await client.query(INSERT_AUDIT_SQL, [
      this.uuid(),
      job.tenantId,
      actorPrincipalId,
      eventType,
      job.jobId,
      outcome,
      serialized,
    ]);
  }

  async enqueue(input: EnqueueIngestionJobInput): Promise<EnqueueIngestionJobResult> {
    const identity = buildIngestionJobIdentity(input);
    return withTenantTransaction(this.pool, input.tenantId, async (client) => {
      const versions = rowsFrom(await client.query(SELECT_DOCUMENT_IDENTITY_SQL, [
        input.documentVersionId.toLowerCase(),
        input.tenantId.toLowerCase(),
      ]));
      if (
        versions.length !== 1 ||
        versions[0]?.content_sha256 !== identity.artifactSha256
      ) {
        throw new IngestionJobError(
          "ingestion_artifact_identity_mismatch",
          "Document version is unavailable or does not match the accepted artifact digest."
        );
      }
      const inserted = rowsFrom(await client.query(INSERT_JOB_SQL, [
        this.uuid(),
        input.tenantId.toLowerCase(),
        input.documentVersionId.toLowerCase(),
        input.principalId.toLowerCase(),
        identity.idempotencyKeySha256,
        identity.requestSha256,
        identity.artifactSha256,
        identity.pipelineConfigSha256,
        identity.workSha256,
        identity.canonicalPipelineConfig,
        identity.maxAttempts,
      ]));
      if (inserted.length === 1) {
        const job = rowToJob(inserted[0]);
        await this.audit(client, job, "rag.ingestion_job.enqueued", "success", "job_enqueued");
        return { kind: "new", job };
      }
      if (inserted.length !== 0) {
        throw new IngestionJobError("ingestion_persistence_invalid", "Ingestion insert returned multiple rows.");
      }

      const keyRows = rowsFrom(await client.query(SELECT_BY_IDEMPOTENCY_SQL, [
        input.tenantId.toLowerCase(),
        input.principalId.toLowerCase(),
        identity.idempotencyKeySha256,
      ]));
      if (keyRows.length === 1) {
        const job = rowToJob(keyRows[0]);
        if (keyRows[0]?.request_sha256 !== identity.requestSha256) {
          await this.audit(client, job, "rag.ingestion_job.conflict", "blocked", "idempotency_conflict");
          return { kind: "conflict" };
        }
        await this.audit(client, job, "rag.ingestion_job.replayed", "success", "idempotent_replay");
        return { kind: "replay", job };
      }
      if (keyRows.length !== 0) {
        throw new IngestionJobError("ingestion_persistence_invalid", "Idempotency lookup returned multiple rows.");
      }

      const workRows = rowsFrom(await client.query(SELECT_BY_WORK_SQL, [
        input.tenantId.toLowerCase(),
        identity.workSha256,
      ]));
      if (workRows.length !== 1) {
        throw new IngestionJobError("ingestion_claim_disappeared", "Conflicting ingestion job could not be resolved.", true);
      }
      const job = rowToJob(workRows[0]);
      await this.audit(
        client,
        job,
        "rag.ingestion_job.deduplicated",
        "success",
        "duplicate_work",
        {},
        input.principalId.toLowerCase()
      );
      return { kind: "duplicate_work", job };
    });
  }

  async leaseNext(
    tenantId: string,
    workerId: string,
    leaseDurationSeconds = DEFAULT_LEASE_SECONDS
  ): Promise<LeasedIngestionJob | null> {
    if (!isCanonicalUuid(tenantId)) throw new IngestionJobError("ingestion_scope_invalid", "Invalid tenant scope.");
    if (!SAFE_WORKER_PATTERN.test(workerId)) {
      throw new IngestionJobError("ingestion_worker_invalid", "Worker identity is invalid.");
    }
    const duration = boundedLeaseSeconds(leaseDurationSeconds);
    const token = this.leaseToken();
    if (!SAFE_LEASE_TOKEN_PATTERN.test(token)) {
      throw new IngestionJobError("ingestion_lease_token_invalid", "Generated lease token is invalid.");
    }
    const workerSha256 = sha256(workerId);
    const tokenSha256 = sha256(token);

    return withTenantTransaction(this.pool, tenantId, async (client) => {
      const exhausted = rowsFrom(await client.query(EXHAUST_EXPIRED_SQL, [tenantId.toLowerCase()]));
      for (const row of exhausted) {
        const job = rowToJob(row);
        const version = rowsFrom(await client.query(UPDATE_DOCUMENT_VERSION_SQL, [
          job.documentVersionId,
          job.tenantId,
          "failed",
        ]));
        if (version.length !== 1) {
          throw new IngestionJobError("ingestion_document_version_missing", "Exhausted job lost its document version.");
        }
        await this.audit(client, job, "rag.ingestion_job.failed", "error", "lease_expired");
      }

      const rows = rowsFrom(await client.query(LEASE_NEXT_SQL, [
        tenantId.toLowerCase(),
        workerSha256,
        tokenSha256,
        duration,
      ]));
      if (rows.length === 0) return null;
      if (rows.length !== 1) {
        throw new IngestionJobError("ingestion_persistence_invalid", "Lease claim returned multiple jobs.");
      }
      const job = rowToJob(rows[0]);
      await this.audit(client, job, "rag.ingestion_job.leased", "success", "job_leased");
      return { job, leaseToken: token };
    });
  }

  async heartbeat(input: HeartbeatIngestionJobInput): Promise<DurableIngestionJob> {
    if (!isCanonicalUuid(input.tenantId) || !isCanonicalUuid(input.jobId)) {
      throw new IngestionJobError("ingestion_scope_invalid", "Invalid ingestion job scope.");
    }
    if (typeof input.leaseToken !== "string" || !SAFE_LEASE_TOKEN_PATTERN.test(input.leaseToken)) {
      throw new IngestionJobError("ingestion_lease_rejected", "Lease is invalid or expired.");
    }
    const duration = boundedLeaseSeconds(input.leaseDurationSeconds);
    const tokenSha256 = sha256(input.leaseToken);
    return withTenantTransaction(this.pool, input.tenantId, async (client) => {
      const rows = rowsFrom(await client.query(HEARTBEAT_SQL, [
        input.jobId,
        input.tenantId.toLowerCase(),
        tokenSha256,
        duration,
      ]));
      if (rows.length !== 1) throw new IngestionJobError("ingestion_lease_rejected", "Lease is invalid or expired.");
      return rowToJob(rows[0]);
    });
  }

  private async lockLease(
    client: TenantTransactionClient,
    tenantId: string,
    jobId: string,
    leaseToken: string
  ): Promise<{ job: DurableIngestionJob; tokenSha256: string }> {
    if (!isCanonicalUuid(tenantId) || !isCanonicalUuid(jobId)) {
      throw new IngestionJobError("ingestion_scope_invalid", "Invalid ingestion job scope.");
    }
    if (!SAFE_LEASE_TOKEN_PATTERN.test(leaseToken)) {
      throw new IngestionJobError("ingestion_lease_rejected", "Lease is invalid or expired.");
    }
    const tokenSha256 = sha256(leaseToken);
    const rows = rowsFrom(await client.query(LOCK_LEASE_SQL, [jobId, tenantId.toLowerCase(), tokenSha256]));
    if (rows.length !== 1) throw new IngestionJobError("ingestion_lease_rejected", "Lease is invalid or expired.");
    return { job: rowToJob(rows[0]), tokenSha256 };
  }

  async complete(input: CompleteIngestionJobInput): Promise<CompleteIngestionJobResult> {
    if (!SHA256_HEX_PATTERN.test(input.artifactSha256)) {
      throw new IngestionJobError(
        "ingestion_artifact_digest_invalid",
        "Completion requires the accepted lowercase SHA-256 artifact identity."
      );
    }
    return withTenantTransaction(this.pool, input.tenantId, async (client) => {
      const { job, tokenSha256 } = await this.lockLease(
        client,
        input.tenantId,
        input.jobId,
        input.leaseToken
      );
      const version = rowsFrom(await client.query(LOCK_DOCUMENT_VERSION_SQL, [
        job.documentVersionId,
        job.tenantId,
      ]));
      const documentIdentity = version[0];
      if (input.artifactSha256 !== job.artifactSha256) {
        throw new IngestionJobError(
          "ingestion_artifact_identity_mismatch",
          "Completion artifact identity does not match the leased job."
        );
      }
      if (
        version.length !== 1 ||
        typeof documentIdentity?.document_key !== "string" ||
        typeof documentIdentity?.document_title !== "string" ||
        typeof documentIdentity?.version_label !== "string"
      ) {
        throw new IngestionJobError("ingestion_document_version_missing", "Leased job document version is unavailable.");
      }
      if (documentIdentity.content_sha256 !== job.artifactSha256) {
        throw new IngestionJobError(
          "ingestion_artifact_identity_mismatch",
          "Locked document version no longer matches the leased artifact identity."
        );
      }

      const vectors = await new TenantPgVectorRepository(client, {
        tenantId: job.tenantId,
        embeddingProvider: job.pipelineConfig.embedding.provider,
        embeddingModel: job.pipelineConfig.embedding.model,
        embeddingDimension: job.pipelineConfig.embedding.dimension,
      }).replaceDocumentVersion(input.records, {
        documentKey: documentIdentity.document_key,
        documentTitle: documentIdentity.document_title,
        documentVersion: documentIdentity.version_label,
      }, {
        documentVersionId: job.documentVersionId,
        ingestionJobId: job.jobId,
      });
      const metrics = JSON.stringify({
        contract_version: "v1",
        chunk_count: input.records.length,
        inserted_count: vectors.insertedCount,
        updated_count: vectors.updatedCount,
        unchanged_count: vectors.unchangedCount,
        deleted_count: vectors.deletedCount,
      });
      const completed = rowsFrom(await client.query(COMPLETE_JOB_SQL, [
        job.jobId,
        job.tenantId,
        tokenSha256,
        metrics,
      ]));
      if (completed.length !== 1) {
        throw new IngestionJobError("ingestion_lease_rejected", "Lease changed before completion.");
      }
      const versionUpdated = rowsFrom(await client.query(UPDATE_DOCUMENT_VERSION_SQL, [
        job.documentVersionId,
        job.tenantId,
        "processed",
      ]));
      if (versionUpdated.length !== 1) {
        throw new IngestionJobError("ingestion_document_version_missing", "Completed job lost its document version.");
      }
      const completedJob = rowToJob(completed[0]);
      await this.audit(client, completedJob, "rag.ingestion_job.processed", "success", "job_processed", {
        chunk_count: input.records.length,
        inserted_count: vectors.insertedCount,
        updated_count: vectors.updatedCount,
        unchanged_count: vectors.unchangedCount,
        deleted_count: vectors.deletedCount,
      });
      return { job: completedJob, vectors };
    });
  }

  async fail(input: FailIngestionJobInput): Promise<DurableIngestionJob> {
    if (!SAFE_ERROR_CODE_PATTERN.test(input.errorCode)) {
      throw new IngestionJobError("ingestion_error_code_invalid", "Ingestion failure requires a safe stable code.");
    }
    return withTenantTransaction(this.pool, input.tenantId, async (client) => {
      const { job, tokenSha256 } = await this.lockLease(
        client,
        input.tenantId,
        input.jobId,
        input.leaseToken
      );
      const retry = input.retryable && job.attemptCount < job.maxAttempts;
      const defaultDelay = Math.min(MAX_RETRY_DELAY_SECONDS, 30 * (2 ** Math.max(0, job.attemptCount - 1)));
      const delay = input.retryDelaySeconds ?? defaultDelay;
      if (!Number.isSafeInteger(delay) || delay < 0 || delay > MAX_RETRY_DELAY_SECONDS) {
        throw new IngestionJobError(
          "ingestion_retry_policy_invalid",
          `Retry delay must be between 0 and ${MAX_RETRY_DELAY_SECONDS} seconds.`
        );
      }
      const rows = rowsFrom(await client.query(retry ? RETRY_JOB_SQL : FAIL_JOB_SQL, retry
        ? [job.jobId, job.tenantId, tokenSha256, delay, input.errorCode]
        : [job.jobId, job.tenantId, tokenSha256, input.errorCode, input.retryable]));
      if (rows.length !== 1) {
        throw new IngestionJobError("ingestion_lease_rejected", "Lease changed before failure handling.");
      }
      const updated = rowToJob(rows[0]);
      const version = rowsFrom(await client.query(UPDATE_DOCUMENT_VERSION_SQL, [
        job.documentVersionId,
        job.tenantId,
        retry ? "queued" : "failed",
      ]));
      if (version.length !== 1) {
        throw new IngestionJobError("ingestion_document_version_missing", "Failed job lost its document version.");
      }
      await this.audit(
        client,
        updated,
        retry ? "rag.ingestion_job.retry_scheduled" : "rag.ingestion_job.failed",
        "error",
        retry ? "retry_scheduled" : input.errorCode,
        { retryable: retry, retry_delay_seconds: retry ? delay : 0 }
      );
      return updated;
    });
  }

  async get(tenantId: string, jobId: string): Promise<DurableIngestionJob | null> {
    if (!isCanonicalUuid(tenantId) || !isCanonicalUuid(jobId)) {
      throw new IngestionJobError("ingestion_scope_invalid", "Invalid ingestion job scope.");
    }
    return withTenantTransaction(this.pool, tenantId, async (client) => {
      const rows = rowsFrom(await client.query(SELECT_JOB_SQL, [jobId, tenantId.toLowerCase()]));
      if (rows.length === 0) return null;
      if (rows.length !== 1) {
        throw new IngestionJobError("ingestion_persistence_invalid", "Job lookup returned multiple rows.");
      }
      return rowToJob(rows[0]);
    });
  }
}

export const INGESTION_LEASE_LIMITS = Object.freeze({
  defaultSeconds: DEFAULT_LEASE_SECONDS,
  minimumSeconds: MIN_LEASE_SECONDS,
  maximumSeconds: MAX_LEASE_SECONDS,
  maximumRetryDelaySeconds: MAX_RETRY_DELAY_SECONDS,
});
