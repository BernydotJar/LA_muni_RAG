import type { Pool } from "pg";
import { pool as defaultPool } from "../../db.js";
import { isCanonicalUuid, type TenantTransactionClient } from "../../security/index.js";
import {
  INGESTION_JOBS_ROUTE,
  type IngestionApiAuditRecord,
  type IngestionApiPersistence,
  type IngestionApiRateLimitDecision,
  type IngestionApiRateLimitScope,
  type IngestionAuthenticationFailureRecord,
  type IngestionAuthenticationFailureRecorder,
} from "./ingestionTypes.js";

const SAFE_EVENT_PATTERN = /^integration\.ingestion_job\.[a-z_]{1,64}$/;
const SAFE_REASON_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

const queryRows = (value: unknown): Array<Record<string, unknown>> => {
  if (!value || typeof value !== "object" || !Array.isArray((value as { rows?: unknown }).rows)) {
    throw new Error("Ingestion API persistence returned an invalid result");
  }
  return (value as { rows: Array<Record<string, unknown>> }).rows;
};

const DELETE_OLD_RATE_LIMITS_SQL = `
  DELETE FROM integration.ingestion_api_rate_limits
  WHERE tenant_id = $1::uuid
    AND principal_id = $2::uuid
    AND operation = $3
    AND window_started_at <
      statement_timestamp() - make_interval(secs => ($4::integer * 2));
`;

const CONSUME_RATE_LIMIT_SQL = `
  INSERT INTO integration.ingestion_api_rate_limits (
    tenant_id,
    principal_id,
    operation,
    window_started_at,
    request_count,
    blocked_audit_id
  )
  VALUES (
    $1::uuid,
    $2::uuid,
    $3,
    to_timestamp(floor(extract(epoch FROM statement_timestamp()) / $4::integer) * $4::integer),
    1,
    NULL
  )
  ON CONFLICT (tenant_id, principal_id, operation, window_started_at)
  DO UPDATE SET
    request_count = integration.ingestion_api_rate_limits.request_count + 1,
    blocked_audit_id = CASE
      WHEN integration.ingestion_api_rate_limits.request_count + 1 > $5::integer
       AND integration.ingestion_api_rate_limits.blocked_audit_id IS NULL
      THEN $6::uuid
      ELSE integration.ingestion_api_rate_limits.blocked_audit_id
    END
  RETURNING
    request_count,
    GREATEST(
      1,
      ceil(extract(epoch FROM (
        window_started_at + make_interval(secs => $4::integer) - statement_timestamp()
      )))
    )::integer AS retry_after_seconds,
    blocked_audit_id,
    blocked_audit_id = $6::uuid AS should_audit;
`;

const RECORD_AUDIT_SQL = `
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
  )
  VALUES (
    $1::uuid,
    $2::uuid,
    $3,
    $4,
    'integration',
    'ingestion_jobs',
    $5::uuid,
    $6,
    $7::jsonb
  );
`;

export class PostgresIngestionApiPersistence
implements IngestionApiPersistence, IngestionAuthenticationFailureRecorder {
  constructor(private readonly authenticationDb: Pick<Pool, "query"> = defaultPool) {}

  async consumeRateLimit(
    client: TenantTransactionClient,
    scope: IngestionApiRateLimitScope
  ): Promise<IngestionApiRateLimitDecision> {
    await client.query(DELETE_OLD_RATE_LIMITS_SQL, [
      scope.tenantId,
      scope.principalId,
      scope.operation,
      scope.windowSeconds,
    ]);
    const rows = queryRows(await client.query(CONSUME_RATE_LIMIT_SQL, [
      scope.tenantId,
      scope.principalId,
      scope.operation,
      scope.windowSeconds,
      scope.limit,
      scope.blockedAuditId,
    ]));
    const row = rows[0];
    const count = Number(row?.request_count);
    const retryAfterSeconds = Number(row?.retry_after_seconds);
    const auditId = typeof row?.blocked_audit_id === "string" ? row.blocked_audit_id : null;
    const shouldAudit = row?.should_audit === true;
    if (!Number.isInteger(count) || !Number.isInteger(retryAfterSeconds)) {
      throw new Error("Ingestion API rate limit returned invalid counters");
    }
    return { allowed: count <= scope.limit, retryAfterSeconds, auditId, shouldAudit };
  }

  async recordAudit(
    client: TenantTransactionClient,
    record: IngestionApiAuditRecord
  ): Promise<void> {
    if (
      !isCanonicalUuid(record.auditId) ||
      !isCanonicalUuid(record.tenantId) ||
      !isCanonicalUuid(record.principalId) ||
      !isCanonicalUuid(record.credentialId) ||
      !isCanonicalUuid(record.requestId) ||
      (record.jobId !== undefined && !isCanonicalUuid(record.jobId)) ||
      !SAFE_EVENT_PATTERN.test(record.eventType) ||
      !SAFE_REASON_PATTERN.test(record.reasonCode)
    ) {
      throw new Error("Unsafe ingestion API audit record");
    }
    const details = JSON.stringify({
      contract_version: "v1",
      route: INGESTION_JOBS_ROUTE,
      operation: record.operation,
      request_id: record.requestId,
      credential_id: record.credentialId,
      reason_code: record.reasonCode,
    });
    if (Buffer.byteLength(details, "utf8") > 16_384) {
      throw new Error("Ingestion API audit details exceed the bounded limit");
    }
    await client.query(RECORD_AUDIT_SQL, [
      record.auditId,
      record.tenantId,
      record.principalId,
      record.eventType,
      record.jobId ?? record.requestId,
      record.outcome,
      details,
    ]);
  }

  async recordAuthenticationFailure(
    record: IngestionAuthenticationFailureRecord
  ): Promise<{ auditId: string }> {
    const result = await this.authenticationDb.query(
      `SELECT audit.record_ingestion_authentication_failure($1::uuid, $2::uuid, $3);`,
      [record.auditId, record.requestId, record.reasonCode]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    const auditId = row?.record_ingestion_authentication_failure;
    if (typeof auditId !== "string") {
      throw new Error("Ingestion authentication audit returned no aggregate identity");
    }
    return { auditId };
  }
}

export class InMemoryIngestionApiPersistence
implements IngestionApiPersistence, IngestionAuthenticationFailureRecorder {
  readonly audits: IngestionApiAuditRecord[] = [];
  readonly authenticationFailures: Array<
    IngestionAuthenticationFailureRecord & { failureCount: number; bucketStartedAt: string }
  > = [];
  private readonly rateLimits = new Map<
    string,
    { bucket: number; count: number; blockedAuditId: string | null }
  >();

  constructor(private readonly now: () => Date = () => new Date()) {}

  async consumeRateLimit(
    _client: TenantTransactionClient,
    scope: IngestionApiRateLimitScope
  ): Promise<IngestionApiRateLimitDecision> {
    const nowMs = this.now().getTime();
    const windowMs = scope.windowSeconds * 1_000;
    const bucket = Math.floor(nowMs / windowMs) * windowMs;
    const key = [scope.tenantId, scope.principalId, scope.operation].join(":");
    const existing = this.rateLimits.get(key);
    const next = !existing || existing.bucket !== bucket
      ? { bucket, count: 1, blockedAuditId: null as string | null }
      : { ...existing, count: existing.count + 1 };
    let shouldAudit = false;
    if (next.count > scope.limit && next.blockedAuditId === null) {
      next.blockedAuditId = scope.blockedAuditId;
      shouldAudit = true;
    }
    this.rateLimits.set(key, next);
    return {
      allowed: next.count <= scope.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket + windowMs - nowMs) / 1_000)),
      auditId: next.blockedAuditId,
      shouldAudit,
    };
  }

  async recordAudit(
    _client: TenantTransactionClient,
    record: IngestionApiAuditRecord
  ): Promise<void> {
    this.audits.push(structuredClone(record));
  }

  async recordAuthenticationFailure(
    record: IngestionAuthenticationFailureRecord
  ): Promise<{ auditId: string }> {
    const bucketStartedAt = new Date(
      Math.floor(this.now().getTime() / 60_000) * 60_000
    ).toISOString();
    const existing = this.authenticationFailures.find(
      (item) => item.bucketStartedAt === bucketStartedAt && item.reasonCode === record.reasonCode
    );
    if (existing) {
      existing.failureCount += 1;
      return { auditId: existing.auditId };
    }
    this.authenticationFailures.push({ ...record, bucketStartedAt, failureCount: 1 });
    return { auditId: record.auditId };
  }
}
