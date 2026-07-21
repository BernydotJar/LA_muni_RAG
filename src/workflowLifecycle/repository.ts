import { randomUUID } from "node:crypto";
import type {
  TenantTransactionClient,
  TenantTransactionPool,
} from "../security/index.js";
import {
  approveReplacementAndSupersede,
  approveWorkflowVersion,
  archiveWorkflowVersion,
  initializeWorkflowVersion,
  recordWorkflowReview,
  submitWorkflowForReview,
  WorkflowLifecycleError,
} from "./stateMachine.js";
import type {
  WorkflowLifecycleActor,
  WorkflowVersionRecord,
} from "./types.js";
import type {
  LifecycleAuditInput,
  LifecycleIdempotencyClaim,
  LifecycleIdempotencyScope,
  StoredWorkflowVersion,
  WorkflowDraftRequestV1,
  WorkflowLifecycleRepository,
  WorkflowLifecycleRateOperation,
  WorkflowLifecyclePrincipal,
} from "../api/v1/workflowLifecycleTypes.js";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const SAFE_CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const rowsFrom = (result: unknown): Record<string, unknown>[] => {
  if (!result || typeof result !== "object") return [];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
};
const iso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
const nullableString = (value: unknown): string | null =>
  typeof value === "string" ? value : value === null || value === undefined ? null : String(value);

const principalIdentity = (principal: WorkflowLifecyclePrincipal): {
  principalId: string;
  tenantId: string;
  roles: WorkflowLifecycleActor["roles"];
} => principal as unknown as {
  principalId: string;
  tenantId: string;
  roles: WorkflowLifecycleActor["roles"];
};

const actorFrom = (principal: WorkflowLifecyclePrincipal): WorkflowLifecycleActor => {
  const identity = principalIdentity(principal);
  return {
    principalId: identity.principalId,
    tenantId: identity.tenantId,
    roles: identity.roles,
  };
};

const auditDetails = (input: LifecycleAuditInput): string =>
  JSON.stringify({
    reason_code: input.reasonCode,
    request_id: input.requestId,
    operation: input.operation,
  });

interface InMemoryIdempotencyRecord extends LifecycleIdempotencyScope {
  state: "processing" | "completed";
  responseStatus: 200 | 201 | null;
  responseBody: string | null;
  auditId: string | null;
  completedAt: string | null;
}

export class InMemoryWorkflowLifecycleRepository implements WorkflowLifecycleRepository {
  readonly workflows = new Map<string, StoredWorkflowVersion>();
  readonly audits: LifecycleAuditInput[] = [];
  readonly authenticationFailures: Array<{ auditId: string; reasonCode: string }> = [];
  private readonly idempotency = new Map<string, InMemoryIdempotencyRecord>();
  private readonly rateLimits = new Map<string, number>();
  private readonly procedureIds = new Map<string, string>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  private workflowKey(tenantId: string, workflowVersionId: string): string {
    return `${tenantId.toLowerCase()}:${workflowVersionId.toLowerCase()}`;
  }

  private idempotencyKey(input: LifecycleIdempotencyScope): string {
    return `${input.tenantId}:${input.principalId}:${input.operation}:${input.idempotencyKeySha256}`;
  }

  async consumeRateLimit(
    _client: TenantTransactionClient,
    input: {
      tenantId: string;
      principalId: string;
      operation: WorkflowLifecycleRateOperation;
      limit: number;
      windowSeconds: number;
      now: string;
      blockedAuditId: string;
    }
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const now = Date.parse(input.now);
    const bucket = Math.floor(now / (input.windowSeconds * 1000));
    const key = `${input.tenantId}:${input.principalId}:${input.operation}:${bucket}`;
    const count = (this.rateLimits.get(key) ?? 0) + 1;
    this.rateLimits.set(key, count);
    const remaining = input.windowSeconds - Math.floor((now / 1000) % input.windowSeconds);
    return { allowed: count <= input.limit, retryAfterSeconds: Math.max(1, remaining) };
  }

  async claimIdempotency(
    _client: TenantTransactionClient,
    input: LifecycleIdempotencyScope
  ): Promise<LifecycleIdempotencyClaim> {
    const key = this.idempotencyKey(input);
    const existing = this.idempotency.get(key);
    if (!existing || Date.parse(existing.expiresAt) <= Date.parse(input.now)) {
      this.idempotency.set(key, {
        ...input,
        state: "processing",
        responseStatus: null,
        responseBody: null,
        auditId: null,
        completedAt: null,
      });
      return { kind: "new" };
    }
    if (existing.requestSha256 !== input.requestSha256) return { kind: "conflict" };
    if (existing.state === "processing") return { kind: "processing" };
    return {
      kind: "replay",
      responseStatus: existing.responseStatus!,
      responseBody: existing.responseBody!,
      auditId: existing.auditId!,
      expiresAt: existing.expiresAt,
    };
  }

  async completeIdempotency(
    _client: TenantTransactionClient,
    input: LifecycleIdempotencyScope & {
      responseStatus: 200 | 201;
      responseBody: string;
      auditId: string;
      completedAt: string;
    }
  ): Promise<void> {
    const key = this.idempotencyKey(input);
    const existing = this.idempotency.get(key);
    if (!existing || existing.state !== "processing" || existing.requestSha256 !== input.requestSha256) {
      throw new Error("workflow lifecycle idempotency completion mismatch");
    }
    this.idempotency.set(key, {
      ...existing,
      state: "completed",
      responseStatus: input.responseStatus,
      responseBody: input.responseBody,
      auditId: input.auditId,
      completedAt: input.completedAt,
    });
  }

  async releaseIdempotency(
    _client: TenantTransactionClient,
    input: LifecycleIdempotencyScope
  ): Promise<void> {
    const key = this.idempotencyKey(input);
    const existing = this.idempotency.get(key);
    if (existing?.state === "processing" && existing.requestSha256 === input.requestSha256) {
      this.idempotency.delete(key);
    }
  }

  async invalidateCompletedIdempotency(
    _client: TenantTransactionClient,
    input: LifecycleIdempotencyScope
  ): Promise<void> {
    this.idempotency.delete(this.idempotencyKey(input));
  }

  async recordAuthenticationFailure(auditId: string, reasonCode: string): Promise<string> {
    this.authenticationFailures.push({ auditId, reasonCode });
    return auditId;
  }

  async recordAudit(_client: TenantTransactionClient, input: LifecycleAuditInput): Promise<void> {
    this.audits.push(structuredClone(input));
  }

  async createDraft(
    _client: TenantTransactionClient,
    input: {
      procedureId: string;
      workflowVersionId: string;
      request: WorkflowDraftRequestV1;
      principal: WorkflowLifecyclePrincipal;
      now: string;
    }
  ): Promise<StoredWorkflowVersion> {
    const procedureKey = `${input.request.tenant_id}:${input.request.procedure_key}`;
    const procedureId = this.procedureIds.get(procedureKey) ?? input.procedureId;
    this.procedureIds.set(procedureKey, procedureId);
    const versionNumber = [...this.workflows.values()].filter(
      (record) => record.tenantId === input.request.tenant_id && record.procedureId === procedureId
    ).length + 1;
    const workflow = input.request.workflow_definition as {
      title?: unknown;
      jurisdiction?: unknown;
    };
    const record: StoredWorkflowVersion = {
      ...initializeWorkflowVersion({
        workflowVersionId: input.workflowVersionId,
        tenantId: input.request.tenant_id,
        procedureId,
        versionNumber,
        generationSource: input.request.generation_source,
        createdByPrincipalId: principalIdentity(input.principal).principalId,
        title: String(workflow.title ?? ""),
        jurisdiction: String(workflow.jurisdiction ?? ""),
        workflowDefinition: input.request.workflow_definition,
        evidenceBundleId: input.request.evidence_bundle_id ?? null,
        now: input.now,
      }),
      procedureKey: input.request.procedure_key,
    };
    this.workflows.set(this.workflowKey(record.tenantId, record.workflowVersionId), record);
    return structuredClone(record);
  }

  async get(
    _client: TenantTransactionClient,
    tenantId: string,
    workflowVersionId: string
  ): Promise<StoredWorkflowVersion | null> {
    const record = this.workflows.get(this.workflowKey(tenantId, workflowVersionId));
    return record ? structuredClone(record) : null;
  }

  private save(record: StoredWorkflowVersion): StoredWorkflowVersion {
    this.workflows.set(this.workflowKey(record.tenantId, record.workflowVersionId), record);
    return structuredClone(record);
  }

  async submitForReview(
    _client: TenantTransactionClient,
    record: StoredWorkflowVersion,
    principal: WorkflowLifecyclePrincipal,
    now: string
  ): Promise<StoredWorkflowVersion> {
    return this.save({
      ...submitWorkflowForReview(record, actorFrom(principal), now),
      procedureKey: record.procedureKey,
    });
  }

  async recordReview(
    _client: TenantTransactionClient,
    record: StoredWorkflowVersion,
    principal: WorkflowLifecyclePrincipal,
    input: { reviewId: string; decision: "changes_requested" | "recommended_for_approval"; notes: string; now: string }
  ): Promise<StoredWorkflowVersion> {
    return this.save({
      ...recordWorkflowReview(record, actorFrom(principal), input),
      procedureKey: record.procedureKey,
    });
  }

  async approve(
    _client: TenantTransactionClient,
    record: StoredWorkflowVersion,
    principal: WorkflowLifecyclePrincipal,
    input: { approvalId: string; notes: string; now: string }
  ): Promise<StoredWorkflowVersion> {
    return this.save({
      ...approveWorkflowVersion(record, actorFrom(principal), input),
      procedureKey: record.procedureKey,
    });
  }

  async supersede(
    _client: TenantTransactionClient,
    record: StoredWorkflowVersion,
    principal: WorkflowLifecyclePrincipal,
    input: {
      replacementWorkflowVersionId: string;
      approvalId: string;
      notes: string;
      now: string;
    }
  ): Promise<StoredWorkflowVersion> {
    const replacement = this.workflows.get(
      this.workflowKey(record.tenantId, input.replacementWorkflowVersionId)
    );
    if (!replacement) {
      throw new WorkflowLifecycleError(
        "workflow_supersession_invalid",
        "Replacement workflow version is unavailable"
      );
    }
    const result = approveReplacementAndSupersede(
      record,
      replacement,
      actorFrom(principal),
      input
    );
    this.save({ ...result.replacement, procedureKey: replacement.procedureKey });
    return this.save({ ...result.superseded, procedureKey: record.procedureKey });
  }

  async archive(
    _client: TenantTransactionClient,
    record: StoredWorkflowVersion,
    principal: WorkflowLifecyclePrincipal,
    now: string
  ): Promise<StoredWorkflowVersion> {
    return this.save({
      ...archiveWorkflowVersion(record, actorFrom(principal), now),
      procedureKey: record.procedureKey,
    });
  }
}

const SELECT_VERSION = `
  SELECT
    version.*,
    procedure.procedure_key
  FROM rag.procedure_versions AS version
  JOIN rag.procedures AS procedure
    ON procedure.id = version.procedure_id
   AND procedure.tenant_id = version.tenant_id
  WHERE version.tenant_id = $1::uuid
    AND version.id = $2::uuid
`;

export class PostgresWorkflowLifecycleRepository implements WorkflowLifecycleRepository {
  constructor(
    private readonly pool: TenantTransactionPool,
    private readonly uuid: () => string = randomUUID
  ) {}

  private async latestReview(
    client: TenantTransactionClient,
    tenantId: string,
    workflowVersionId: string
  ): Promise<WorkflowVersionRecord["latestReview"]> {
    const rows = rowsFrom(await client.query(
      `SELECT id, reviewer_principal_id, decision, notes, created_at
       FROM rag.workflow_reviews
       WHERE tenant_id = $1::uuid AND workflow_version_id = $2::uuid
       ORDER BY created_at DESC, id DESC LIMIT 1`,
      [tenantId, workflowVersionId]
    ));
    const row = rows[0];
    return row
      ? {
          reviewId: String(row.id),
          reviewerPrincipalId: String(row.reviewer_principal_id),
          decision: row.decision as "changes_requested" | "recommended_for_approval",
          notes: String(row.notes),
          createdAt: iso(row.created_at),
        }
      : null;
  }

  private async approval(
    client: TenantTransactionClient,
    tenantId: string,
    workflowVersionId: string
  ): Promise<WorkflowVersionRecord["approval"]> {
    const rows = rowsFrom(await client.query(
      `SELECT id, approver_principal_id, decision, notes, created_at
       FROM rag.workflow_approvals
       WHERE tenant_id = $1::uuid AND workflow_version_id = $2::uuid
       LIMIT 1`,
      [tenantId, workflowVersionId]
    ));
    const row = rows[0];
    return row
      ? {
          approvalId: String(row.id),
          approverPrincipalId: String(row.approver_principal_id),
          decision: "approved",
          notes: String(row.notes),
          createdAt: iso(row.created_at),
        }
      : null;
  }

  private async mapRow(
    client: TenantTransactionClient,
    row: Record<string, unknown>
  ): Promise<StoredWorkflowVersion> {
    const tenantId = String(row.tenant_id);
    const workflowVersionId = String(row.id);
    const definition = typeof row.workflow_definition === "string"
      ? JSON.parse(row.workflow_definition)
      : structuredClone(row.workflow_definition as Record<string, unknown>);
    return {
      workflowVersionId,
      tenantId,
      procedureId: String(row.procedure_id),
      procedureKey: String(row.procedure_key),
      versionNumber: Number(row.version_number),
      lifecycleStatus: row.lifecycle_status as WorkflowVersionRecord["lifecycleStatus"],
      generationSource: row.generation_source as WorkflowVersionRecord["generationSource"],
      createdByPrincipalId: String(row.created_by_principal_id),
      title: String(row.title),
      jurisdiction: String(row.jurisdiction),
      workflowDefinition: definition,
      evidenceBundleId: nullableString(row.evidence_bundle_id),
      revision: Number(row.revision),
      submittedByPrincipalId: nullableString(row.submitted_by_principal_id),
      submittedAt: row.submitted_at ? iso(row.submitted_at) : null,
      latestReview: await this.latestReview(client, tenantId, workflowVersionId),
      approval: await this.approval(client, tenantId, workflowVersionId),
      supersededByWorkflowVersionId: nullableString(row.superseded_by_workflow_version_id),
      archivedByPrincipalId: nullableString(row.archived_by_principal_id),
      archivedAt: row.archived_at ? iso(row.archived_at) : null,
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    };
  }

  async consumeRateLimit(
    client: TenantTransactionClient,
    input: {
      tenantId: string;
      principalId: string;
      operation: WorkflowLifecycleRateOperation;
      limit: number;
      windowSeconds: number;
      now: string;
      blockedAuditId: string;
    }
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const now = new Date(input.now);
    const windowMilliseconds = input.windowSeconds * 1000;
    const start = new Date(Math.floor(now.getTime() / windowMilliseconds) * windowMilliseconds);
    const rows = rowsFrom(await client.query(
      `INSERT INTO integration.workflow_lifecycle_rate_limits (
         tenant_id, principal_id, operation, window_started_at, request_count, blocked_audit_id
       ) VALUES ($1::uuid, $2::uuid, $3, $4::timestamptz, 1, NULL)
       ON CONFLICT (tenant_id, principal_id, operation, window_started_at)
       DO UPDATE SET
         request_count = integration.workflow_lifecycle_rate_limits.request_count + 1,
         blocked_audit_id = CASE
           WHEN integration.workflow_lifecycle_rate_limits.request_count + 1 > $5
             THEN COALESCE(integration.workflow_lifecycle_rate_limits.blocked_audit_id, $6::uuid)
           ELSE integration.workflow_lifecycle_rate_limits.blocked_audit_id
         END,
         updated_at = statement_timestamp()
       RETURNING request_count`,
      [input.tenantId, input.principalId, input.operation, start.toISOString(), input.limit, input.blockedAuditId]
    ));
    const count = Number(rows[0]?.request_count ?? input.limit + 1);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((start.getTime() + windowMilliseconds - now.getTime()) / 1000)
    );
    return { allowed: count <= input.limit, retryAfterSeconds };
  }

  async claimIdempotency(
    client: TenantTransactionClient,
    input: LifecycleIdempotencyScope
  ): Promise<LifecycleIdempotencyClaim> {
    if (!SHA256_PATTERN.test(input.idempotencyKeySha256) || !SHA256_PATTERN.test(input.requestSha256)) {
      throw new Error("invalid lifecycle idempotency digest");
    }
    const inserted = rowsFrom(await client.query(
      `INSERT INTO integration.workflow_lifecycle_idempotency (
         tenant_id, principal_id, operation, idempotency_key_sha256,
         request_sha256, state, expires_at
       ) VALUES ($1::uuid, $2::uuid, $3, decode($4, 'hex'), decode($5, 'hex'), 'processing', $6::timestamptz)
       ON CONFLICT DO NOTHING
       RETURNING state`,
      [input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256, input.requestSha256, input.expiresAt]
    ));
    if (inserted.length === 1) return { kind: "new" };
    const rows = rowsFrom(await client.query(
      `SELECT encode(request_sha256, 'hex') AS request_sha256, state,
              response_status, response_body, audit_id, expires_at
       FROM integration.workflow_lifecycle_idempotency
       WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
         AND idempotency_key_sha256 = decode($4, 'hex')
       FOR UPDATE`,
      [input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256]
    ));
    const row = rows[0];
    if (!row) throw new Error("lifecycle idempotency row disappeared");
    if (Date.parse(iso(row.expires_at)) <= Date.parse(input.now)) {
      await client.query(
        `DELETE FROM integration.workflow_lifecycle_idempotency
         WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
           AND idempotency_key_sha256 = decode($4, 'hex')`,
        [input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256]
      );
      return this.claimIdempotency(client, input);
    }
    if (row.request_sha256 !== input.requestSha256) return { kind: "conflict" };
    if (row.state === "processing") return { kind: "processing" };
    return {
      kind: "replay",
      responseStatus: Number(row.response_status) as 200 | 201,
      responseBody: String(row.response_body),
      auditId: String(row.audit_id),
      expiresAt: iso(row.expires_at),
    };
  }

  async completeIdempotency(
    client: TenantTransactionClient,
    input: LifecycleIdempotencyScope & {
      responseStatus: 200 | 201;
      responseBody: string;
      auditId: string;
      completedAt: string;
    }
  ): Promise<void> {
    const rows = rowsFrom(await client.query(
      `UPDATE integration.workflow_lifecycle_idempotency
       SET state = 'completed', response_status = $6, response_body = $7,
           audit_id = $8::uuid, completed_at = $9::timestamptz, updated_at = statement_timestamp()
       WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
         AND idempotency_key_sha256 = decode($4, 'hex')
         AND request_sha256 = decode($5, 'hex') AND state = 'processing'
       RETURNING state`,
      [input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256,
       input.requestSha256, input.responseStatus, input.responseBody, input.auditId, input.completedAt]
    ));
    if (rows.length !== 1) throw new Error("lifecycle idempotency completion failed");
  }

  async releaseIdempotency(
    client: TenantTransactionClient,
    input: LifecycleIdempotencyScope
  ): Promise<void> {
    await client.query(
      `DELETE FROM integration.workflow_lifecycle_idempotency
       WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
         AND idempotency_key_sha256 = decode($4, 'hex')
         AND request_sha256 = decode($5, 'hex') AND state = 'processing'`,
      [input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256, input.requestSha256]
    );
  }

  async invalidateCompletedIdempotency(
    client: TenantTransactionClient,
    input: LifecycleIdempotencyScope
  ): Promise<void> {
    await client.query(
      `DELETE FROM integration.workflow_lifecycle_idempotency
       WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
         AND idempotency_key_sha256 = decode($4, 'hex')
         AND request_sha256 = decode($5, 'hex') AND state = 'completed'`,
      [input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256, input.requestSha256]
    );
  }

  async recordAuthenticationFailure(auditId: string, reasonCode: string): Promise<string> {
    if (!SAFE_CODE_PATTERN.test(reasonCode)) throw new Error("invalid lifecycle auth reason");
    const client = await this.pool.connect();
    try {
      const rows = rowsFrom(await client.query(
        `SELECT audit.record_workflow_lifecycle_authentication_failure($1::uuid, $2::uuid, $3) AS audit_id`,
        [auditId, this.uuid(), reasonCode]
      ));
      return String(rows[0]?.audit_id ?? auditId);
    } finally {
      client.release();
    }
  }

  async recordAudit(client: TenantTransactionClient, input: LifecycleAuditInput): Promise<void> {
    const details = auditDetails(input);
    if (Buffer.byteLength(details, "utf8") > 8192) throw new Error("workflow audit details exceed policy");
    await client.query(
      `INSERT INTO audit.events (
         id, tenant_id, actor_external_id, event_type, entity_schema,
         entity_table, entity_id, outcome, details
       ) VALUES ($1::uuid, $2::uuid, $3, $4, 'rag', 'procedure_versions',
                 $5::uuid, $6, $7::jsonb)`,
      [input.auditId, input.tenantId, input.principalId, input.eventType,
       input.entityId, input.outcome, details]
    );
  }

  async createDraft(
    client: TenantTransactionClient,
    input: {
      procedureId: string;
      workflowVersionId: string;
      request: WorkflowDraftRequestV1;
      principal: WorkflowLifecyclePrincipal;
      now: string;
    }
  ): Promise<StoredWorkflowVersion> {
    const workflow = input.request.workflow_definition as { title?: unknown; jurisdiction?: unknown };
    await client.query(
      `INSERT INTO rag.procedures (
         id, tenant_id, procedure_key, title, jurisdiction, created_by_principal_id
       ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid)
       ON CONFLICT (tenant_id, procedure_key) DO NOTHING`,
      [input.procedureId, input.request.tenant_id, input.request.procedure_key,
       String(workflow.title ?? ""), String(workflow.jurisdiction ?? ""), principalIdentity(input.principal).principalId]
    );
    const procedures = rowsFrom(await client.query(
      `SELECT id FROM rag.procedures
       WHERE tenant_id = $1::uuid AND procedure_key = $2
       FOR UPDATE`,
      [input.request.tenant_id, input.request.procedure_key]
    ));
    if (procedures.length !== 1) throw new Error("procedure identity unavailable");
    const procedureId = String(procedures[0]!.id);
    const versions = rowsFrom(await client.query(
      `SELECT COALESCE(max(version_number), 0) + 1 AS next_version
       FROM rag.procedure_versions
       WHERE tenant_id = $1::uuid AND procedure_id = $2::uuid`,
      [input.request.tenant_id, procedureId]
    ));
    const record = initializeWorkflowVersion({
      workflowVersionId: input.workflowVersionId,
      tenantId: input.request.tenant_id,
      procedureId,
      versionNumber: Number(versions[0]?.next_version ?? 1),
      generationSource: input.request.generation_source,
      createdByPrincipalId: principalIdentity(input.principal).principalId,
      title: String(workflow.title ?? ""),
      jurisdiction: String(workflow.jurisdiction ?? ""),
      workflowDefinition: input.request.workflow_definition,
      evidenceBundleId: input.request.evidence_bundle_id ?? null,
      now: input.now,
    });
    await client.query(
      `INSERT INTO rag.procedure_versions (
         id, tenant_id, procedure_id, version_number, lifecycle_status,
         generation_source, created_by_principal_id, title, jurisdiction,
         workflow_definition, evidence_bundle_id, revision, created_at, updated_at
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'draft', $5, $6::uuid,
                 $7, $8, $9::jsonb, $10::uuid, $11, $12::timestamptz, $12::timestamptz)`,
      [record.workflowVersionId, record.tenantId, record.procedureId, record.versionNumber,
       record.generationSource, record.createdByPrincipalId, record.title, record.jurisdiction,
       JSON.stringify(record.workflowDefinition), record.evidenceBundleId, record.revision, record.createdAt]
    );
    const stored = await this.get(client, record.tenantId, record.workflowVersionId, true);
    if (!stored) throw new Error("created workflow version unavailable");
    return stored;
  }

  async get(
    client: TenantTransactionClient,
    tenantId: string,
    workflowVersionId: string,
    forUpdate = false
  ): Promise<StoredWorkflowVersion | null> {
    const rows = rowsFrom(await client.query(
      `${SELECT_VERSION}${forUpdate ? " FOR UPDATE OF version" : ""}`,
      [tenantId, workflowVersionId]
    ));
    return rows[0] ? this.mapRow(client, rows[0]) : null;
  }

  private async updateRecord(
    client: TenantTransactionClient,
    record: WorkflowVersionRecord
  ): Promise<StoredWorkflowVersion> {
    await client.query(
      `UPDATE rag.procedure_versions SET
         lifecycle_status = $3, title = $4, jurisdiction = $5,
         workflow_definition = $6::jsonb, evidence_bundle_id = $7::uuid,
         revision = $8, submitted_by_principal_id = $9::uuid,
         submitted_at = $10::timestamptz, approved_by_principal_id = $11::uuid,
         approved_at = $12::timestamptz, superseded_by_workflow_version_id = $13::uuid,
         archived_by_principal_id = $14::uuid, archived_at = $15::timestamptz
       WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [record.tenantId, record.workflowVersionId, record.lifecycleStatus, record.title,
       record.jurisdiction, JSON.stringify(record.workflowDefinition), record.evidenceBundleId,
       record.revision, record.submittedByPrincipalId, record.submittedAt,
       record.approval?.approverPrincipalId ?? null, record.approval?.createdAt ?? null,
       record.supersededByWorkflowVersionId, record.archivedByPrincipalId, record.archivedAt]
    );
    const stored = await this.get(client, record.tenantId, record.workflowVersionId, true);
    if (!stored) throw new Error("workflow version disappeared after update");
    return stored;
  }

  async submitForReview(
    client: TenantTransactionClient,
    record: StoredWorkflowVersion,
    principal: WorkflowLifecyclePrincipal,
    now: string
  ): Promise<StoredWorkflowVersion> {
    return this.updateRecord(client, submitWorkflowForReview(record, actorFrom(principal), now));
  }

  async recordReview(
    client: TenantTransactionClient,
    record: StoredWorkflowVersion,
    principal: WorkflowLifecyclePrincipal,
    input: { reviewId: string; decision: "changes_requested" | "recommended_for_approval"; notes: string; now: string }
  ): Promise<StoredWorkflowVersion> {
    const updated = recordWorkflowReview(record, actorFrom(principal), input);
    await client.query(
      `INSERT INTO rag.workflow_reviews (
         id, tenant_id, workflow_version_id, reviewer_principal_id, decision, notes, created_at
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7::timestamptz)`,
      [input.reviewId, record.tenantId, record.workflowVersionId, principalIdentity(principal).principalId,
       input.decision, input.notes, input.now]
    );
    return this.updateRecord(client, updated);
  }

  async approve(
    client: TenantTransactionClient,
    record: StoredWorkflowVersion,
    principal: WorkflowLifecyclePrincipal,
    input: { approvalId: string; notes: string; now: string }
  ): Promise<StoredWorkflowVersion> {
    const updated = approveWorkflowVersion(record, actorFrom(principal), input);
    await client.query(
      `INSERT INTO rag.workflow_approvals (
         id, tenant_id, workflow_version_id, approver_principal_id, decision, notes, created_at
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'approved', $5, $6::timestamptz)`,
      [input.approvalId, record.tenantId, record.workflowVersionId,
       principalIdentity(principal).principalId, input.notes, input.now]
    );
    return this.updateRecord(client, updated);
  }

  async supersede(
    client: TenantTransactionClient,
    record: StoredWorkflowVersion,
    principal: WorkflowLifecyclePrincipal,
    input: {
      replacementWorkflowVersionId: string;
      approvalId: string;
      notes: string;
      now: string;
    }
  ): Promise<StoredWorkflowVersion> {
    const replacement = await this.get(
      client,
      record.tenantId,
      input.replacementWorkflowVersionId,
      true
    );
    if (!replacement) {
      throw new WorkflowLifecycleError(
        "workflow_supersession_invalid",
        "Replacement workflow version is unavailable"
      );
    }
    const result = approveReplacementAndSupersede(
      record,
      replacement,
      actorFrom(principal),
      input
    );
    const superseded = await this.updateRecord(client, result.superseded);
    await client.query(
      `INSERT INTO rag.workflow_approvals (
         id, tenant_id, workflow_version_id, approver_principal_id, decision, notes, created_at
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'approved', $5, $6::timestamptz)`,
      [input.approvalId, replacement.tenantId, replacement.workflowVersionId,
       principalIdentity(principal).principalId, input.notes, input.now]
    );
    await this.updateRecord(client, result.replacement);
    return superseded;
  }

  async archive(
    client: TenantTransactionClient,
    record: StoredWorkflowVersion,
    principal: WorkflowLifecyclePrincipal,
    now: string
  ): Promise<StoredWorkflowVersion> {
    return this.updateRecord(client, archiveWorkflowVersion(record, actorFrom(principal), now));
  }
}
