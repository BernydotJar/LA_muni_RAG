import type { TenantTransactionClient } from "../../../security/index.js";
import {
  PublicQueryRepositoryError,
  type PublicQueryAuditInput,
  type PublicQueryRateInput,
  type PublicQueryRepository,
} from "./publicQueryTypes.js";

const rowsFrom = (result: unknown): Record<string, unknown>[] => {
  if (!result || typeof result !== "object" || !Array.isArray((result as { rows?: unknown }).rows)) {
    throw new PublicQueryRepositoryError("invalid_query_result", "Public query persistence returned an invalid result.");
  }
  return (result as { rows: Record<string, unknown>[] }).rows;
};
const bool = (value: unknown): boolean => value === true || value === "true";

export class InMemoryPublicQueryRepository implements PublicQueryRepository {
  readonly rateLimits = new Map<string, { count: number; auditId: string | null }>();
  readonly rateDecisions: PublicQueryRateInput[] = [];
  readonly audits: PublicQueryAuditInput[] = [];

  constructor(private readonly now: () => Date = () => new Date()) {}

  async consumeRateLimit(
    _client: TenantTransactionClient,
    input: PublicQueryRateInput
  ) {
    this.rateDecisions.push(structuredClone(input));
    const epoch = Date.parse(input.now);
    const bucket = Math.floor(epoch / (input.windowSeconds * 1000));
    const key = `${input.tenantId}:${input.clientKeySha256}:${input.operation}:${bucket}`;
    const existing = this.rateLimits.get(key) ?? { count: 0, auditId: null };
    const count = existing.count + 1;
    const auditId = count === input.limit + 1 ? input.blockedAuditId : existing.auditId;
    this.rateLimits.set(key, { count, auditId });
    const retryAfterSeconds = Math.max(
      1,
      input.windowSeconds - Math.floor((this.now().getTime() / 1000) % input.windowSeconds)
    );
    return count <= input.limit
      ? { allowed: true, retryAfterSeconds }
      : {
          allowed: false,
          retryAfterSeconds,
          auditId: auditId ?? input.blockedAuditId,
          shouldAudit: count === input.limit + 1,
        };
  }

  async recordAudit(_client: TenantTransactionClient, input: PublicQueryAuditInput): Promise<void> {
    this.audits.push(structuredClone(input));
  }
}

export class PostgresPublicQueryRepository implements PublicQueryRepository {
  async consumeRateLimit(client: TenantTransactionClient, input: PublicQueryRateInput) {
    await client.query(`DELETE FROM rag.public_query_rate_limits
      WHERE tenant_id = $1::uuid
        AND window_started_at < $2::timestamptz - make_interval(secs => $3::integer)`,
    [input.tenantId, input.now, Math.max(86400, input.windowSeconds * 4)]);
    const rows = rowsFrom(await client.query(`
      INSERT INTO rag.public_query_rate_limits (
        tenant_id, client_key_sha256, operation, window_started_at,
        request_count, blocked_audit_id, updated_at
      ) VALUES (
        $1::uuid, decode($2, 'hex'), $3,
        to_timestamp(floor(extract(epoch FROM $6::timestamptz) / $5::integer) * $5::integer),
        1, NULL, statement_timestamp()
      )
      ON CONFLICT (tenant_id, client_key_sha256, operation, window_started_at) DO UPDATE
      SET request_count = LEAST(rag.public_query_rate_limits.request_count + 1, 1000000),
          blocked_audit_id = CASE
            WHEN rag.public_query_rate_limits.request_count + 1 = $4::integer + 1 THEN $7::uuid
            ELSE rag.public_query_rate_limits.blocked_audit_id
          END,
          updated_at = statement_timestamp()
      RETURNING request_count,
        GREATEST(1, ceil(extract(epoch FROM (
          window_started_at + make_interval(secs => $5::integer) - $6::timestamptz
        ))))::integer AS retry_after_seconds,
        blocked_audit_id,
        blocked_audit_id = $7::uuid AS should_audit
    `, [
      input.tenantId,
      input.clientKeySha256,
      input.operation,
      input.limit,
      input.windowSeconds,
      input.now,
      input.blockedAuditId,
    ]));
    const row = rows[0];
    if (!row) {
      throw new PublicQueryRepositoryError("rate_decision_missing", "Public query rate decision missing.");
    }
    const count = Number(row.request_count);
    return {
      allowed: count <= input.limit,
      retryAfterSeconds: Number(row.retry_after_seconds),
      ...(row.blocked_audit_id ? { auditId: String(row.blocked_audit_id) } : {}),
      shouldAudit: bool(row.should_audit),
    };
  }

  async recordAudit(client: TenantTransactionClient, input: PublicQueryAuditInput): Promise<void> {
    await client.query(`INSERT INTO audit.events (
      id, tenant_id, actor_external_id, event_type, entity_schema, entity_table,
      entity_id, outcome, details, created_at
    ) VALUES (
      $1::uuid, $2::uuid, 'public_gateway', $3, 'rag', 'public_query',
      NULL, $4, $5::jsonb, statement_timestamp()
    )`, [
      input.auditId,
      input.tenantId,
      input.eventType,
      input.outcome,
      JSON.stringify({
        reason_code: input.reasonCode,
        request_id: input.requestId,
        operation: "public_query_v1",
        ...(input.requestedMode === undefined ? {} : { requested_mode: input.requestedMode }),
        ...(input.resultCount === undefined ? {} : { result_count: input.resultCount }),
      }),
    ]);
  }
}
