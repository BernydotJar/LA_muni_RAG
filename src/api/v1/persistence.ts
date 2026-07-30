import type { Pool } from "pg";
import { pool as defaultPool } from "../../db.js";
import type { TenantTransactionClient } from "../../security/index.js";
import {
  PROCEDURE_QUERY_ROUTE,
  type AuthenticationFailureRecord,
  type AuthenticationFailureRecorder,
  type IdempotencyClaim,
  type IdempotencyScope,
  type ProcedureQueryAuditRecord,
  type ProcedureQueryPersistence,
  type RateLimitScope,
} from "./types.js";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const SAFE_EVENT_PATTERN = /^integration\.procedure_query\.[a-z_]{1,64}$/;
const SAFE_REASON_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

const queryRows = (value: unknown): Array<Record<string, unknown>> => {
  if (!value || typeof value !== "object" || !Array.isArray((value as { rows?: unknown }).rows)) {
    throw new Error("Persistence query returned an invalid result");
  }
  return (value as { rows: Array<Record<string, unknown>> }).rows;
};

const assertDigest = (value: string): void => {
  if (!SHA256_PATTERN.test(value)) throw new Error("Invalid SHA-256 digest");
};

const DELETE_EXPIRED_IDEMPOTENCY_SQL = `
  DELETE FROM integration.procedure_query_idempotency
  WHERE tenant_id = $1::uuid
    AND principal_id = $2::uuid
    AND operation = $3
    AND expires_at <= statement_timestamp();
`;

const INSERT_IDEMPOTENCY_SQL = `
  INSERT INTO integration.procedure_query_idempotency (
    tenant_id,
    principal_id,
    operation,
    idempotency_key_sha256,
    request_sha256,
    state,
    expires_at
  )
  VALUES ($1::uuid, $2::uuid, $3, decode($4, 'hex'), decode($5, 'hex'), 'processing',
          statement_timestamp() + interval '24 hours')
  ON CONFLICT (tenant_id, principal_id, operation, idempotency_key_sha256)
  DO NOTHING
  RETURNING state;
`;

const SELECT_IDEMPOTENCY_SQL = `
  SELECT
    encode(request_sha256, 'hex') AS request_sha256,
    state,
    response_status,
    response_body,
    audit_id
  FROM integration.procedure_query_idempotency
  WHERE tenant_id = $1::uuid
    AND principal_id = $2::uuid
    AND operation = $3
    AND idempotency_key_sha256 = decode($4, 'hex');
`;

const COMPLETE_IDEMPOTENCY_SQL = `
  UPDATE integration.procedure_query_idempotency
  SET
    state = 'completed',
    response_status = $6,
    response_body = $7,
    audit_id = $8::uuid,
    completed_at = statement_timestamp()
  WHERE tenant_id = $1::uuid
    AND principal_id = $2::uuid
    AND operation = $3
    AND idempotency_key_sha256 = decode($4, 'hex')
    AND request_sha256 = decode($5, 'hex')
    AND state = 'processing'
  RETURNING audit_id;
`;

const RELEASE_IDEMPOTENCY_SQL = `
  DELETE FROM integration.procedure_query_idempotency
  WHERE tenant_id = $1::uuid
    AND principal_id = $2::uuid
    AND operation = $3
    AND idempotency_key_sha256 = decode($4, 'hex')
    AND request_sha256 = decode($5, 'hex')
    AND state = 'processing';
`;

const INVALIDATE_COMPLETED_IDEMPOTENCY_SQL = `
  DELETE FROM integration.procedure_query_idempotency
  WHERE tenant_id = $1::uuid
    AND principal_id = $2::uuid
    AND operation = $3
    AND idempotency_key_sha256 = decode($4, 'hex')
    AND request_sha256 = decode($5, 'hex')
    AND state = 'completed'
  RETURNING audit_id;
`;

const CONSUME_RATE_LIMIT_SQL = `
  INSERT INTO integration.procedure_query_rate_limits (
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
    request_count = integration.procedure_query_rate_limits.request_count + 1,
    blocked_audit_id = CASE
      WHEN integration.procedure_query_rate_limits.request_count + 1 > $5::integer
       AND integration.procedure_query_rate_limits.blocked_audit_id IS NULL
      THEN $6::uuid
      ELSE integration.procedure_query_rate_limits.blocked_audit_id
    END
  RETURNING
    request_count,
    GREATEST(
      1,
      ceil(extract(epoch FROM (window_started_at + make_interval(secs => $4::integer) - statement_timestamp())))
    )::integer AS retry_after_seconds,
    blocked_audit_id,
    blocked_audit_id = $6::uuid AS should_audit;
`;

const DELETE_OLD_RATE_LIMITS_SQL = `
  DELETE FROM integration.procedure_query_rate_limits
  WHERE tenant_id = $1::uuid
    AND principal_id = $2::uuid
    AND operation = $3
    AND window_started_at <
      statement_timestamp() - make_interval(secs => ($4::integer * 2));
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
    'procedure_query_idempotency',
    $5::uuid,
    $6,
    $7::jsonb
  );
`;

export class PostgresProcedureQueryPersistence
implements ProcedureQueryPersistence, AuthenticationFailureRecorder {
  constructor(private readonly authenticationDb: Pick<Pool, "query"> = defaultPool) {}

  async claimIdempotency(
    client: TenantTransactionClient,
    scope: IdempotencyScope
  ): Promise<IdempotencyClaim> {
    assertDigest(scope.idempotencyKeySha256);
    assertDigest(scope.requestSha256);
    const keyValues = [
      scope.tenantId,
      scope.principalId,
      scope.operation,
      scope.idempotencyKeySha256,
    ];
    await client.query(DELETE_EXPIRED_IDEMPOTENCY_SQL, keyValues.slice(0, 3));
    const inserted = queryRows(
      await client.query(INSERT_IDEMPOTENCY_SQL, [...keyValues, scope.requestSha256])
    );
    if (inserted.length === 1) return { kind: "new" };

    const rows = queryRows(await client.query(SELECT_IDEMPOTENCY_SQL, keyValues));
    const row = rows[0];
    if (!row || typeof row.request_sha256 !== "string") {
      throw new Error("Idempotency claim disappeared during transaction");
    }
    if (row.request_sha256 !== scope.requestSha256) return { kind: "conflict" };
    if (row.state !== "completed") return { kind: "in_progress" };
    if (
      typeof row.response_status !== "number" ||
      typeof row.response_body !== "string" ||
      typeof row.audit_id !== "string"
    ) {
      throw new Error("Completed idempotency record is incomplete");
    }
    return {
      kind: "replay",
      statusCode: row.response_status,
      responseBody: row.response_body,
      originalAuditId: row.audit_id,
    };
  }

  async completeIdempotency(
    client: TenantTransactionClient,
    scope: IdempotencyScope,
    result: { statusCode: number; responseBody: string; auditId: string }
  ): Promise<void> {
    if (result.statusCode !== 200) {
      throw new Error("Only contract-valid success responses may be persisted for replay");
    }
    const rows = queryRows(
      await client.query(COMPLETE_IDEMPOTENCY_SQL, [
        scope.tenantId,
        scope.principalId,
        scope.operation,
        scope.idempotencyKeySha256,
        scope.requestSha256,
        result.statusCode,
        result.responseBody,
        result.auditId,
      ])
    );
    if (rows.length !== 1 || rows[0]?.audit_id !== result.auditId) {
      throw new Error("Idempotency completion did not update the reserved claim");
    }
  }

  async releaseIdempotency(
    client: TenantTransactionClient,
    scope: IdempotencyScope
  ): Promise<void> {
    await client.query(RELEASE_IDEMPOTENCY_SQL, [
      scope.tenantId,
      scope.principalId,
      scope.operation,
      scope.idempotencyKeySha256,
      scope.requestSha256,
    ]);
  }

  async invalidateCompletedIdempotency(
    client: TenantTransactionClient,
    scope: IdempotencyScope
  ): Promise<void> {
    const rows = queryRows(
      await client.query(INVALIDATE_COMPLETED_IDEMPOTENCY_SQL, [
        scope.tenantId,
        scope.principalId,
        scope.operation,
        scope.idempotencyKeySha256,
        scope.requestSha256,
      ])
    );
    if (rows.length !== 1 || typeof rows[0]?.audit_id !== "string") {
      throw new Error("Corrupt idempotency replay could not be invalidated");
    }
  }

  async consumeRateLimit(
    client: TenantTransactionClient,
    scope: RateLimitScope
  ): Promise<{
    allowed: boolean;
    retryAfterSeconds: number;
    auditId: string | null;
    shouldAudit: boolean;
  }> {
    await client.query(DELETE_OLD_RATE_LIMITS_SQL, [
      scope.tenantId,
      scope.principalId,
      scope.operation,
      scope.windowSeconds,
    ]);
    const rows = queryRows(
      await client.query(CONSUME_RATE_LIMIT_SQL, [
        scope.tenantId,
        scope.principalId,
        scope.operation,
        scope.windowSeconds,
        scope.limit,
        scope.blockedAuditId,
      ])
    );
    const row = rows[0];
    const count = Number(row?.request_count);
    const retryAfterSeconds = Number(row?.retry_after_seconds);
    const auditId = typeof row?.blocked_audit_id === "string" ? row.blocked_audit_id : null;
    const shouldAudit = row?.should_audit === true;
    if (!Number.isInteger(count) || !Number.isInteger(retryAfterSeconds)) {
      throw new Error("Rate limit query returned invalid counters");
    }
    return { allowed: count <= scope.limit, retryAfterSeconds, auditId, shouldAudit };
  }

  async recordAudit(
    client: TenantTransactionClient,
    record: ProcedureQueryAuditRecord
  ): Promise<void> {
    if (!SAFE_EVENT_PATTERN.test(record.eventType) || !SAFE_REASON_PATTERN.test(record.reasonCode)) {
      throw new Error("Unsafe audit classification");
    }
    if (record.idempotencyKeySha256) assertDigest(record.idempotencyKeySha256);
    const details = {
      reason_code: record.reasonCode,
      request_id: record.requestId,
      route: PROCEDURE_QUERY_ROUTE,
      operation: "procedure_query_v1",
      ...(record.requestedOutput ? { requested_output: record.requestedOutput } : {}),
      ...(record.idempotencyKeySha256
        ? { idempotency_key_sha256: record.idempotencyKeySha256 }
        : {}),
      credential_id: record.credentialId,
    };
    await client.query(RECORD_AUDIT_SQL, [
      record.auditId,
      record.tenantId,
      record.principalId,
      record.eventType,
      record.requestId,
      record.outcome,
      JSON.stringify(details),
    ]);
  }

  async recordAuthenticationFailure(
    record: AuthenticationFailureRecord
  ): Promise<{ auditId: string }> {
    const result = await this.authenticationDb.query(
      `SELECT audit.record_authentication_failure($1::uuid, $2::uuid, $3);`,
      [record.auditId, record.requestId, record.reasonCode]
    );
    const row = result.rows[0] as Record<string, unknown> | undefined;
    const auditId = row?.record_authentication_failure;
    if (typeof auditId !== "string") {
      throw new Error("Authentication audit function returned no aggregate identity");
    }
    return { auditId };
  }
}

interface InMemoryIdempotencyRecord {
  requestSha256: string;
  state: "processing" | "completed";
  responseStatus?: number;
  responseBody?: string;
  auditId?: string;
}

/** Test adapter with the same tenant/principal/operation scoping as Postgres. */
export class InMemoryProcedureQueryPersistence
implements ProcedureQueryPersistence, AuthenticationFailureRecorder {
  readonly audits: ProcedureQueryAuditRecord[] = [];
  readonly authenticationFailures: Array<
    AuthenticationFailureRecord & { failureCount: number; bucketStartedAt: string }
  > = [];
  private readonly idempotency = new Map<string, InMemoryIdempotencyRecord>();
  private readonly rateLimits = new Map<
    string,
    { bucket: number; count: number; blockedAuditId: string | null }
  >();

  constructor(private readonly now: () => Date = () => new Date()) {}

  private idempotencyKey(scope: IdempotencyScope): string {
    return [scope.tenantId, scope.principalId, scope.operation, scope.idempotencyKeySha256].join(":");
  }

  async claimIdempotency(
    _client: TenantTransactionClient,
    scope: IdempotencyScope
  ): Promise<IdempotencyClaim> {
    const key = this.idempotencyKey(scope);
    const existing = this.idempotency.get(key);
    if (!existing) {
      this.idempotency.set(key, { requestSha256: scope.requestSha256, state: "processing" });
      return { kind: "new" };
    }
    if (existing.requestSha256 !== scope.requestSha256) return { kind: "conflict" };
    if (existing.state === "processing") return { kind: "in_progress" };
    return {
      kind: "replay",
      statusCode: existing.responseStatus ?? 200,
      responseBody: existing.responseBody ?? "",
      originalAuditId: existing.auditId ?? "",
    };
  }

  async completeIdempotency(
    _client: TenantTransactionClient,
    scope: IdempotencyScope,
    result: { statusCode: number; responseBody: string; auditId: string }
  ): Promise<void> {
    if (result.statusCode !== 200) {
      throw new Error("Only contract-valid success responses may be persisted for replay");
    }
    const key = this.idempotencyKey(scope);
    const existing = this.idempotency.get(key);
    if (
      !existing ||
      existing.state !== "processing" ||
      existing.requestSha256 !== scope.requestSha256
    ) {
      throw new Error("Missing in-memory idempotency reservation");
    }
    this.idempotency.set(key, {
      ...existing,
      state: "completed",
      responseStatus: result.statusCode,
      responseBody: result.responseBody,
      auditId: result.auditId,
    });
  }

  async releaseIdempotency(
    _client: TenantTransactionClient,
    scope: IdempotencyScope
  ): Promise<void> {
    const key = this.idempotencyKey(scope);
    const existing = this.idempotency.get(key);
    if (existing?.state === "processing" && existing.requestSha256 === scope.requestSha256) {
      this.idempotency.delete(key);
    }
  }

  async invalidateCompletedIdempotency(
    _client: TenantTransactionClient,
    scope: IdempotencyScope
  ): Promise<void> {
    const key = this.idempotencyKey(scope);
    const existing = this.idempotency.get(key);
    if (existing?.state === "completed" && existing.requestSha256 === scope.requestSha256) {
      this.idempotency.delete(key);
      return;
    }
    throw new Error("Corrupt in-memory idempotency replay could not be invalidated");
  }

  async consumeRateLimit(
    _client: TenantTransactionClient,
    scope: RateLimitScope
  ): Promise<{
    allowed: boolean;
    retryAfterSeconds: number;
    auditId: string | null;
    shouldAudit: boolean;
  }> {
    const nowSeconds = Math.floor(this.now().getTime() / 1000);
    const bucket = Math.floor(nowSeconds / scope.windowSeconds);
    const key = [scope.tenantId, scope.principalId, scope.operation].join(":");
    const current = this.rateLimits.get(key);
    const count = current?.bucket === bucket ? current.count + 1 : 1;
    const existingAuditId = current?.bucket === bucket ? current.blockedAuditId : null;
    const shouldAudit = count > scope.limit && existingAuditId === null;
    const auditId = shouldAudit ? scope.blockedAuditId : existingAuditId;
    this.rateLimits.set(key, { bucket, count, blockedAuditId: auditId });
    const retryAfterSeconds = Math.max(1, (bucket + 1) * scope.windowSeconds - nowSeconds);
    return {
      allowed: count <= scope.limit,
      retryAfterSeconds,
      auditId,
      shouldAudit,
    };
  }

  async recordAudit(
    _client: TenantTransactionClient,
    record: ProcedureQueryAuditRecord
  ): Promise<void> {
    this.audits.push(structuredClone(record));
  }

  async recordAuthenticationFailure(
    record: AuthenticationFailureRecord
  ): Promise<{ auditId: string }> {
    const bucketMs = Math.floor(this.now().getTime() / 60_000) * 60_000;
    const cutoff = bucketMs - 30 * 24 * 60 * 60 * 1_000;
    for (let index = this.authenticationFailures.length - 1; index >= 0; index -= 1) {
      const existing = this.authenticationFailures[index];
      if (existing && Date.parse(existing.bucketStartedAt) < cutoff) {
        this.authenticationFailures.splice(index, 1);
      }
    }
    const bucketStartedAt = new Date(bucketMs).toISOString();
    const existing = this.authenticationFailures.find(
      (failure) =>
        failure.bucketStartedAt === bucketStartedAt && failure.reasonCode === record.reasonCode
    );
    if (existing) {
      existing.failureCount += 1;
      return { auditId: existing.auditId };
    }
    this.authenticationFailures.push({
      ...structuredClone(record),
      failureCount: 1,
      bucketStartedAt,
    });
    return { auditId: record.auditId };
  }
}
