import { createHash, randomUUID } from "node:crypto";
import type {
  AuthenticatedPrincipal,
  TenantTransactionClient,
  TenantTransactionPool,
} from "../security/index.js";
import type {
  ProcedureCaseActionV1,
  ProcedureCaseAuditInput,
  ProcedureCaseBlockerRecord,
  ProcedureCaseCreateResult,
  ProcedureCaseDocumentRecord,
  ProcedureCaseIdempotencyClaim,
  ProcedureCaseIdempotencyScope,
  ProcedureCaseRepository,
  ProcedureCaseStatus,
  ProcedureCaseStepRecord,
  ProcedureCaseUpdateRequestV1,
  StoredProcedureCase,
} from "../api/v1/procedureCaseTypes.js";
import { ProcedureCaseError } from "../api/v1/procedureCaseTypes.js";

const sha256 = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");
const rowsFrom = (result: unknown): Record<string, unknown>[] => {
  if (!result || typeof result !== "object") return [];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? rows as Record<string, unknown>[] : [];
};
const iso = (value: unknown): string =>
  value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
const nullable = (value: unknown): string | null =>
  value === null || value === undefined ? null : String(value);

interface WorkflowSeed {
  tenantId: string;
  workflowVersionId: string;
  versionNumber: number;
  jurisdiction: string;
  lifecycleStatus: "approved" | "draft" | "superseded" | "archived";
  steps: Array<{ stepId: string; title: string }>;
}

interface InMemoryIdempotencyRecord extends ProcedureCaseIdempotencyScope {
  state: "processing" | "completed";
  responseStatus: 200 | 201 | null;
  responseBody: string | null;
  auditId: string | null;
}

const clone = <T>(value: T): T => structuredClone(value);
const eventDetails = (action: ProcedureCaseActionV1): Record<string, unknown> => {
  if (action.type === "append_note" || action.type === "close_case") {
    return { action: action.type, note_length: action.note.length };
  }
  if (action.type === "add_blocker") {
    return { action: action.type, blocker_code: action.blocker_code };
  }
  if (action.type === "record_document") {
    return {
      action: action.type,
      requirement_id: action.requirement_id,
      state: action.state,
      document_version_id: action.document_version_id ?? null,
    };
  }
  return clone(action) as unknown as Record<string, unknown>;
};

export class InMemoryProcedureCaseRepository implements ProcedureCaseRepository {
  readonly cases = new Map<string, StoredProcedureCase>();
  readonly workflows = new Map<string, WorkflowSeed>();
  readonly documentVersions = new Set<string>();
  readonly audits: ProcedureCaseAuditInput[] = [];
  readonly authenticationFailures: Array<{ auditId: string; reasonCode: string }> = [];
  private readonly idempotency = new Map<string, InMemoryIdempotencyRecord>();
  private readonly creationAcks = new Map<string, { caseId: string; responseBody: string; auditId: string }>();
  private readonly creationIndex = new Map<string, string>();
  private readonly rateLimits = new Map<string, number>();

  constructor(private readonly clock: () => Date = () => new Date()) {}

  seedWorkflow(seed: WorkflowSeed): void {
    this.workflows.set(`${seed.tenantId}:${seed.workflowVersionId}`, clone(seed));
  }

  seedDocumentVersion(tenantId: string, documentVersionId: string): void {
    this.documentVersions.add(`${tenantId}:${documentVersionId}`);
  }

  private key(tenantId: string, caseId: string): string {
    return `${tenantId.toLowerCase()}:${caseId.toLowerCase()}`;
  }

  private idempotencyKey(input: ProcedureCaseIdempotencyScope): string {
    return `${input.tenantId}:${input.principalId}:${input.operation}:${input.idempotencyKeySha256}`;
  }

  async consumeRateLimit(
    _client: TenantTransactionClient,
    input: {
      tenantId: string;
      principalId: string;
      operation: ProcedureCaseAuditInput["operation"];
      limit: number;
      windowSeconds: number;
      now: string;
      blockedAuditId: string;
    }
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const milliseconds = Date.parse(input.now);
    const bucket = Math.floor(milliseconds / (input.windowSeconds * 1000));
    const key = `${input.tenantId}:${input.principalId}:${input.operation}:${bucket}`;
    const count = (this.rateLimits.get(key) ?? 0) + 1;
    this.rateLimits.set(key, count);
    const retryAfterSeconds = Math.max(
      1,
      input.windowSeconds - Math.floor((milliseconds / 1000) % input.windowSeconds)
    );
    return { allowed: count <= input.limit, retryAfterSeconds };
  }

  async claimIdempotency(
    _client: TenantTransactionClient,
    input: ProcedureCaseIdempotencyScope
  ): Promise<ProcedureCaseIdempotencyClaim> {
    if (input.operation === "procedure_case_create_v1") {
      const creationKey = `${input.tenantId}:${input.principalId}:${input.requestSha256}`;
      const aggregate = this.creationAcks.get(creationKey);
      if (aggregate) {
        return {
          kind: "replay",
          responseStatus: 201,
          responseBody: aggregate.responseBody,
          auditId: aggregate.auditId,
        };
      }
    }
    const key = this.idempotencyKey(input);
    const existing = this.idempotency.get(key);
    if (!existing || Date.parse(existing.expiresAt) <= Date.parse(input.now)) {
      this.idempotency.set(key, {
        ...input,
        state: "processing",
        responseStatus: null,
        responseBody: null,
        auditId: null,
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
    };
  }

  async completeIdempotency(
    _client: TenantTransactionClient,
    input: ProcedureCaseIdempotencyScope & {
      responseStatus: 200 | 201;
      responseBody: string;
      auditId: string;
      completedAt: string;
    }
  ): Promise<void> {
    const key = this.idempotencyKey(input);
    const existing = this.idempotency.get(key);
    if (!existing || existing.state !== "processing" || existing.requestSha256 !== input.requestSha256) {
      throw new Error("procedure case idempotency completion mismatch");
    }
    this.idempotency.set(key, {
      ...existing,
      state: "completed",
      responseStatus: input.responseStatus,
      responseBody: input.responseBody,
      auditId: input.auditId,
    });
  }

  async releaseIdempotency(
    _client: TenantTransactionClient,
    input: ProcedureCaseIdempotencyScope
  ): Promise<void> {
    const key = this.idempotencyKey(input);
    const existing = this.idempotency.get(key);
    if (existing?.state === "processing" && existing.requestSha256 === input.requestSha256) {
      this.idempotency.delete(key);
    }
  }

  async invalidateCompletedIdempotency(
    _client: TenantTransactionClient,
    input: ProcedureCaseIdempotencyScope
  ): Promise<void> {
    this.idempotency.delete(this.idempotencyKey(input));
  }

  async recordAuthenticationFailure(auditId: string, reasonCode: string): Promise<string> {
    this.authenticationFailures.push({ auditId, reasonCode });
    return auditId;
  }

  async recordAudit(_client: TenantTransactionClient, input: ProcedureCaseAuditInput): Promise<void> {
    this.audits.push(clone(input));
  }

  async create(
    _client: TenantTransactionClient,
    input: {
      caseId: string;
      eventId: string;
      request: import("../api/v1/procedureCaseTypes.js").ProcedureCaseCreateRequestV1;
      principal: AuthenticatedPrincipal;
      now: string;
      requestSha256: string;
    }
  ): Promise<ProcedureCaseCreateResult> {
    const creationKey = `${input.request.tenant_id}:${input.principal.principalId}:${input.requestSha256}`;
    const aggregate = this.creationAcks.get(creationKey);
    if (aggregate) {
      return {
        kind: "replay",
        responseStatus: 201,
        responseBody: aggregate.responseBody,
        auditId: aggregate.auditId,
      };
    }
    if (this.creationIndex.has(creationKey)) {
      throw new ProcedureCaseError("case_conflict", "Procedure case creation is in progress");
    }
    const workflow = this.workflows.get(
      `${input.request.tenant_id}:${input.request.workflow_version_id}`
    );
    if (!workflow || workflow.lifecycleStatus !== "approved") {
      throw new ProcedureCaseError("workflow_not_approved", "Approved workflow version required");
    }
    if (workflow.steps.length < 1 || workflow.steps.length > 100) {
      throw new ProcedureCaseError("workflow_not_approved", "Approved workflow has invalid steps");
    }
    if (workflow.jurisdiction !== input.request.jurisdiction) {
      throw new ProcedureCaseError("workflow_not_approved", "Workflow jurisdiction mismatch");
    }
    if ([...this.cases.values()].some(
      (item) => item.tenantId === input.request.tenant_id && item.caseKey === input.request.case_key
    )) {
      throw new ProcedureCaseError("case_conflict", "Case key already exists");
    }
    const steps: ProcedureCaseStepRecord[] = workflow.steps.map((step, index) => ({
      stepId: step.stepId,
      title: step.title,
      ordinal: index + 1,
      state: "not_started",
      updatedByPrincipalId: input.principal.principalId,
      updatedAt: input.now,
    }));
    const record: StoredProcedureCase = {
      caseId: input.caseId,
      tenantId: input.request.tenant_id,
      caseKey: input.request.case_key,
      workflowVersionId: input.request.workflow_version_id,
      workflowVersionNumber: workflow.versionNumber,
      jurisdiction: workflow.jurisdiction,
      subjectReference: input.request.subject_reference ?? null,
      communityReference: input.request.community_reference ?? null,
      status: "active",
      validationState: "unreviewed",
      currentStepId: steps[0]?.stepId ?? null,
      followUpAt: input.request.follow_up_at ?? null,
      operationalNote: null,
      revision: 1,
      createdByPrincipalId: input.principal.principalId,
      updatedByPrincipalId: input.principal.principalId,
      createdAt: input.now,
      updatedAt: input.now,
      steps,
      documents: [],
      blockers: [],
      events: [{
        eventId: input.eventId,
        actorPrincipalId: input.principal.principalId,
        eventType: "procedure_case.created",
        revision: 1,
        details: {
          workflow_version_id: input.request.workflow_version_id,
          workflow_version_number: workflow.versionNumber,
        },
        createdAt: input.now,
      }],
    };
    this.cases.set(this.key(record.tenantId, record.caseId), clone(record));
    this.creationIndex.set(creationKey, record.caseId);
    return { kind: "created", record: clone(record) };
  }

  async sealCreation(
    _client: TenantTransactionClient,
    input: {
      tenantId: string;
      caseId: string;
      principalId: string;
      requestSha256: string;
      responseBody: string;
      auditId: string;
    }
  ): Promise<void> {
    const creationKey = `${input.tenantId}:${input.principalId}:${input.requestSha256}`;
    if (this.creationIndex.get(creationKey) !== input.caseId) {
      throw new Error("procedure case creation seal mismatch");
    }
    this.creationAcks.set(creationKey, {
      caseId: input.caseId,
      responseBody: input.responseBody,
      auditId: input.auditId,
    });
  }

  async get(
    _client: TenantTransactionClient,
    tenantId: string,
    caseId: string
  ): Promise<StoredProcedureCase | null> {
    const record = this.cases.get(this.key(tenantId, caseId));
    return record ? clone(record) : null;
  }

  async applyAction(
    _client: TenantTransactionClient,
    record: StoredProcedureCase,
    input: {
      request: ProcedureCaseUpdateRequestV1;
      principal: AuthenticatedPrincipal;
      eventId: string;
      entityId: string;
      now: string;
    }
  ): Promise<StoredProcedureCase> {
    if (record.revision !== input.request.expected_revision) {
      throw new ProcedureCaseError("revision_conflict", "Procedure case revision conflict");
    }
    if (record.status === "closed") {
      throw new ProcedureCaseError("invalid_transition", "Closed procedure case cannot change");
    }
    const next = clone(record);
    const action = input.request.action;
    if (action.type === "set_step_state") {
      const step = next.steps.find((item) => item.stepId === action.step_id);
      if (!step) throw new ProcedureCaseError("step_not_found", "Procedure case step not found");
      step.state = action.state;
      step.updatedByPrincipalId = input.principal.principalId;
      step.updatedAt = input.now;
      next.currentStepId = action.step_id;
      if (action.state === "blocked") next.status = "blocked";
      if (action.state === "ready_for_review") next.status = "ready_for_review";
      if (action.state === "in_progress" && next.status !== "blocked") next.status = "active";
    } else if (action.type === "record_document") {
      if (
        (action.state === "received" || action.state === "reviewed") &&
        (!action.document_version_id || !this.documentVersions.has(
          `${record.tenantId}:${action.document_version_id}`
        ))
      ) {
        throw new ProcedureCaseError("document_not_found", "Document version not found");
      }
      const existing = next.documents.find((item) => item.requirementId === action.requirement_id);
      const item: ProcedureCaseDocumentRecord = {
        documentReferenceId: existing?.documentReferenceId ?? input.entityId,
        requirementId: action.requirement_id,
        documentVersionId: action.document_version_id ?? null,
        state: action.state,
        note: action.note ?? null,
        updatedByPrincipalId: input.principal.principalId,
        createdAt: existing?.createdAt ?? input.now,
        updatedAt: input.now,
      };
      if (existing) next.documents.splice(next.documents.indexOf(existing), 1, item);
      else next.documents.push(item);
    } else if (action.type === "add_blocker") {
      next.blockers.push({
        blockerId: input.entityId,
        blockerCode: action.blocker_code,
        description: action.description,
        resolvedAt: null,
        resolvedByPrincipalId: null,
        createdByPrincipalId: input.principal.principalId,
        createdAt: input.now,
      });
      next.status = "blocked";
    } else if (action.type === "resolve_blocker") {
      const blocker = next.blockers.find((item) => item.blockerId === action.blocker_id);
      if (!blocker || blocker.resolvedAt) {
        throw new ProcedureCaseError("blocker_not_found", "Open blocker not found");
      }
      blocker.resolvedAt = input.now;
      blocker.resolvedByPrincipalId = input.principal.principalId;
      if (!next.blockers.some((item) => !item.resolvedAt)) next.status = "active";
    } else if (action.type === "set_follow_up") {
      next.followUpAt = action.follow_up_at;
    } else if (action.type === "set_validation_state") {
      next.validationState = action.validation_state;
      if (action.validation_state === "in_review") next.status = "ready_for_review";
    } else if (action.type === "append_note") {
      next.operationalNote = action.note;
    } else if (action.type === "close_case") {
      next.operationalNote = action.note;
      next.status = "closed";
    }
    next.revision += 1;
    next.updatedByPrincipalId = input.principal.principalId;
    next.updatedAt = input.now;
    next.events.push({
      eventId: input.eventId,
      actorPrincipalId: input.principal.principalId,
      eventType: `procedure_case.${action.type}`,
      revision: next.revision,
      details: eventDetails(action),
      createdAt: input.now,
    });
    this.cases.set(this.key(next.tenantId, next.caseId), clone(next));
    return clone(next);
  }
}

const SELECT_CASE = `
  SELECT * FROM rag.procedure_cases
  WHERE tenant_id = $1::uuid AND id = $2::uuid
`;

export class PostgresProcedureCaseRepository implements ProcedureCaseRepository {
  constructor(
    private readonly pool: TenantTransactionPool,
    private readonly uuid: () => string = randomUUID
  ) {}

  async consumeRateLimit(
    client: TenantTransactionClient,
    input: {
      tenantId: string;
      principalId: string;
      operation: ProcedureCaseAuditInput["operation"];
      limit: number;
      windowSeconds: number;
      now: string;
      blockedAuditId: string;
    }
  ): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const nowMs = Date.parse(input.now);
    const windowMs = input.windowSeconds * 1000;
    const windowStart = new Date(Math.floor(nowMs / windowMs) * windowMs).toISOString();
    const rows = rowsFrom(await client.query(
      `INSERT INTO integration.procedure_case_rate_limits (
         tenant_id, principal_id, operation, window_started_at, request_count, blocked_audit_id
       ) VALUES ($1::uuid, $2::uuid, $3, $4::timestamptz, 1, NULL)
       ON CONFLICT (tenant_id, principal_id, operation, window_started_at)
       DO UPDATE SET request_count = integration.procedure_case_rate_limits.request_count + 1
       RETURNING request_count`,
      [input.tenantId, input.principalId, input.operation, windowStart]
    ));
    const count = Number(rows[0]?.request_count ?? 1);
    const allowed = count <= input.limit;
    if (!allowed) {
      await client.query(
        `UPDATE integration.procedure_case_rate_limits
         SET blocked_audit_id = COALESCE(blocked_audit_id, $5::uuid)
         WHERE tenant_id = $1::uuid AND principal_id = $2::uuid
           AND operation = $3 AND window_started_at = $4::timestamptz`,
        [input.tenantId, input.principalId, input.operation, windowStart, input.blockedAuditId]
      );
    }
    return {
      allowed,
      retryAfterSeconds: Math.max(1, Math.ceil((Date.parse(windowStart) + windowMs - nowMs) / 1000)),
    };
  }

  async claimIdempotency(
    client: TenantTransactionClient,
    input: ProcedureCaseIdempotencyScope
  ): Promise<ProcedureCaseIdempotencyClaim> {
    if (input.operation === "procedure_case_create_v1") {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [`${input.tenantId}:${input.principalId}:${input.requestSha256}`]
      );
      const aggregateRows = rowsFrom(await client.query(
        `SELECT initial_response_status, initial_response_body, initial_response_sha256, initial_audit_id
         FROM rag.procedure_cases
         WHERE tenant_id = $1::uuid AND created_by_principal_id = $2::uuid
           AND create_request_sha256 = decode($3, 'hex')`,
        [input.tenantId, input.principalId, input.requestSha256]
      ));
      const aggregate = aggregateRows[0];
      if (aggregate?.initial_response_body) {
        const body = String(aggregate.initial_response_body);
        const storedHash = Buffer.from(aggregate.initial_response_sha256 as Uint8Array).toString("hex");
        if (storedHash !== sha256(body)) throw new Error("procedure case aggregate replay hash mismatch");
        return {
          kind: "replay",
          responseStatus: 201,
          responseBody: body,
          auditId: String(aggregate.initial_audit_id),
        };
      }
    }
    const rows = rowsFrom(await client.query(
      `SELECT request_sha256, state, response_status, response_body, response_sha256, audit_id, expires_at
       FROM integration.procedure_case_idempotency
       WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
         AND idempotency_key_sha256 = decode($4, 'hex')
       FOR UPDATE`,
      [input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256]
    ));
    const row = rows[0];
    if (row && Date.parse(iso(row.expires_at)) > Date.parse(input.now)) {
      const storedRequest = Buffer.from(row.request_sha256 as Uint8Array).toString("hex");
      if (storedRequest !== input.requestSha256) return { kind: "conflict" };
      if (row.state === "processing") return { kind: "processing" };
      const body = String(row.response_body);
      const storedResponse = Buffer.from(row.response_sha256 as Uint8Array).toString("hex");
      if (storedResponse !== sha256(body)) {
        await client.query(
          `DELETE FROM integration.procedure_case_idempotency
           WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
             AND idempotency_key_sha256 = decode($4, 'hex')`,
          [input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256]
        );
        throw new Error("procedure case replay hash mismatch");
      }
      return {
        kind: "replay",
        responseStatus: Number(row.response_status) as 200 | 201,
        responseBody: body,
        auditId: String(row.audit_id),
      };
    }
    await client.query(
      `DELETE FROM integration.procedure_case_idempotency
       WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
         AND idempotency_key_sha256 = decode($4, 'hex')`,
      [input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256]
    );
    await client.query(
      `INSERT INTO integration.procedure_case_idempotency (
         tenant_id, principal_id, operation, idempotency_key_sha256, request_sha256,
         state, created_at, expires_at
       ) VALUES ($1::uuid, $2::uuid, $3, decode($4, 'hex'), decode($5, 'hex'),
         'processing', $6::timestamptz, $7::timestamptz)`,
      [
        input.tenantId,
        input.principalId,
        input.operation,
        input.idempotencyKeySha256,
        input.requestSha256,
        input.now,
        input.expiresAt,
      ]
    );
    return { kind: "new" };
  }

  async completeIdempotency(
    client: TenantTransactionClient,
    input: ProcedureCaseIdempotencyScope & {
      responseStatus: 200 | 201;
      responseBody: string;
      auditId: string;
      completedAt: string;
    }
  ): Promise<void> {
    const result = await client.query(
      `UPDATE integration.procedure_case_idempotency
       SET state = 'completed', response_status = $6, response_body = $7,
           response_sha256 = decode($8, 'hex'), audit_id = $9::uuid,
           completed_at = $10::timestamptz
       WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
         AND idempotency_key_sha256 = decode($4, 'hex')
         AND request_sha256 = decode($5, 'hex') AND state = 'processing'
       RETURNING 1`,
      [
        input.tenantId,
        input.principalId,
        input.operation,
        input.idempotencyKeySha256,
        input.requestSha256,
        input.responseStatus,
        input.responseBody,
        sha256(input.responseBody),
        input.auditId,
        input.completedAt,
      ]
    );
    if (rowsFrom(result).length !== 1) throw new Error("procedure case idempotency completion mismatch");
  }

  async releaseIdempotency(
    client: TenantTransactionClient,
    input: ProcedureCaseIdempotencyScope
  ): Promise<void> {
    await client.query(
      `DELETE FROM integration.procedure_case_idempotency
       WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
         AND idempotency_key_sha256 = decode($4, 'hex')
         AND request_sha256 = decode($5, 'hex') AND state = 'processing'`,
      [input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256, input.requestSha256]
    );
  }

  async invalidateCompletedIdempotency(
    client: TenantTransactionClient,
    input: ProcedureCaseIdempotencyScope
  ): Promise<void> {
    await client.query(
      `DELETE FROM integration.procedure_case_idempotency
       WHERE tenant_id = $1::uuid AND principal_id = $2::uuid AND operation = $3
         AND idempotency_key_sha256 = decode($4, 'hex')`,
      [input.tenantId, input.principalId, input.operation, input.idempotencyKeySha256]
    );
  }

  async recordAuthenticationFailure(auditId: string, reasonCode: string): Promise<string> {
    const client = await this.pool.connect();
    let releaseError: Error | undefined;
    try {
      const rows = rowsFrom(await client.query(
        "SELECT audit.record_procedure_case_authentication_failure($1::uuid, $2) AS audit_id",
        [auditId, reasonCode]
      ));
      return String(rows[0]?.audit_id ?? auditId);
    } catch (error) {
      releaseError = error instanceof Error ? error : new Error("authentication audit failure");
      throw error;
    } finally {
      client.release(releaseError);
    }
  }

  async recordAudit(client: TenantTransactionClient, input: ProcedureCaseAuditInput): Promise<void> {
    await client.query(
      `INSERT INTO audit.events (
         id, tenant_id, actor_external_id, event_type, entity_schema, entity_table,
         entity_id, outcome, details, created_at
       ) VALUES (
         $1::uuid, $2::uuid, $3, $4, 'rag', 'procedure_cases', $5::uuid,
         $6, $7::jsonb, statement_timestamp()
       )`,
      [
        input.auditId,
        input.tenantId,
        input.principalId,
        input.eventType,
        input.entityId,
        input.outcome,
        JSON.stringify({
          reason_code: input.reasonCode,
          request_id: input.requestId,
          operation: input.operation,
          credential_id: input.credentialId,
        }),
      ]
    );
  }

  private async relations(
    client: TenantTransactionClient,
    tenantId: string,
    caseId: string
  ): Promise<Pick<StoredProcedureCase, "steps" | "documents" | "blockers" | "events">> {
    const stepRows = rowsFrom(await client.query(
      `SELECT step_id, title, ordinal, state, updated_by_principal_id, updated_at
       FROM rag.procedure_case_steps
       WHERE tenant_id = $1::uuid AND case_id = $2::uuid
       ORDER BY ordinal`,
      [tenantId, caseId]
    ));
    const documentRows = rowsFrom(await client.query(
      `SELECT id, requirement_id, document_version_id, state, note,
              updated_by_principal_id, created_at, updated_at
       FROM rag.procedure_case_documents
       WHERE tenant_id = $1::uuid AND case_id = $2::uuid
       ORDER BY created_at, id`,
      [tenantId, caseId]
    ));
    const blockerRows = rowsFrom(await client.query(
      `SELECT id, blocker_code, description, resolved_at, resolved_by_principal_id,
              created_by_principal_id, created_at
       FROM rag.procedure_case_blockers
       WHERE tenant_id = $1::uuid AND case_id = $2::uuid
       ORDER BY created_at, id`,
      [tenantId, caseId]
    ));
    const eventRows = rowsFrom(await client.query(
      `SELECT id, actor_principal_id, event_type, revision, details, created_at
       FROM rag.procedure_case_events
       WHERE tenant_id = $1::uuid AND case_id = $2::uuid
       ORDER BY created_at, id`,
      [tenantId, caseId]
    ));
    return {
      steps: stepRows.map((row) => ({
        stepId: String(row.step_id),
        title: String(row.title),
        ordinal: Number(row.ordinal),
        state: row.state as ProcedureCaseStepRecord["state"],
        updatedByPrincipalId: String(row.updated_by_principal_id),
        updatedAt: iso(row.updated_at),
      })),
      documents: documentRows.map((row) => ({
        documentReferenceId: String(row.id),
        requirementId: String(row.requirement_id),
        documentVersionId: nullable(row.document_version_id),
        state: row.state as ProcedureCaseDocumentRecord["state"],
        note: nullable(row.note),
        updatedByPrincipalId: String(row.updated_by_principal_id),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
      })),
      blockers: blockerRows.map((row) => ({
        blockerId: String(row.id),
        blockerCode: String(row.blocker_code),
        description: String(row.description),
        resolvedAt: row.resolved_at ? iso(row.resolved_at) : null,
        resolvedByPrincipalId: nullable(row.resolved_by_principal_id),
        createdByPrincipalId: String(row.created_by_principal_id),
        createdAt: iso(row.created_at),
      })),
      events: eventRows.map((row) => ({
        eventId: String(row.id),
        actorPrincipalId: String(row.actor_principal_id),
        eventType: String(row.event_type),
        revision: Number(row.revision),
        details: typeof row.details === "string"
          ? JSON.parse(row.details) as Record<string, unknown>
          : clone(row.details as Record<string, unknown>),
        createdAt: iso(row.created_at),
      })),
    };
  }

  private async mapCase(
    client: TenantTransactionClient,
    row: Record<string, unknown>
  ): Promise<StoredProcedureCase> {
    const tenantId = String(row.tenant_id);
    const caseId = String(row.id);
    return {
      caseId,
      tenantId,
      caseKey: String(row.case_key),
      workflowVersionId: String(row.workflow_version_id),
      workflowVersionNumber: Number(row.workflow_version_number),
      jurisdiction: String(row.jurisdiction),
      subjectReference: nullable(row.subject_reference),
      communityReference: nullable(row.community_reference),
      status: row.status as StoredProcedureCase["status"],
      validationState: row.validation_state as StoredProcedureCase["validationState"],
      currentStepId: nullable(row.current_step_id),
      followUpAt: row.follow_up_at ? iso(row.follow_up_at) : null,
      operationalNote: nullable(row.operational_note),
      revision: Number(row.revision),
      createdByPrincipalId: String(row.created_by_principal_id),
      updatedByPrincipalId: String(row.updated_by_principal_id),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
      ...await this.relations(client, tenantId, caseId),
    };
  }

  async create(
    client: TenantTransactionClient,
    input: {
      caseId: string;
      eventId: string;
      request: import("../api/v1/procedureCaseTypes.js").ProcedureCaseCreateRequestV1;
      principal: AuthenticatedPrincipal;
      now: string;
      requestSha256: string;
    }
  ): Promise<ProcedureCaseCreateResult> {
    const workflowRows = rowsFrom(await client.query(
      `SELECT version_number, lifecycle_status, jurisdiction, workflow_definition
       FROM rag.procedure_versions
       WHERE tenant_id = $1::uuid AND id = $2::uuid`,
      [input.request.tenant_id, input.request.workflow_version_id]
    ));
    const workflow = workflowRows[0];
    if (!workflow || workflow.lifecycle_status !== "approved") {
      throw new ProcedureCaseError("workflow_not_approved", "Approved workflow version required");
    }
    if (String(workflow.jurisdiction) !== input.request.jurisdiction) {
      throw new ProcedureCaseError("workflow_not_approved", "Workflow jurisdiction mismatch");
    }
    const definition = typeof workflow.workflow_definition === "string"
      ? JSON.parse(workflow.workflow_definition) as Record<string, unknown>
      : workflow.workflow_definition as Record<string, unknown>;
    const rawSteps = Array.isArray(definition.steps) ? definition.steps : [];
    const steps = rawSteps.map((value, index) => {
      const step = value && typeof value === "object" ? value as Record<string, unknown> : {};
      return {
        stepId: String(step.step_id ?? step.id ?? `step-${index + 1}`),
        title: String(step.title ?? step.action ?? `Paso ${index + 1}`),
      };
    });
    if (steps.length < 1 || steps.length > 100) {
      throw new ProcedureCaseError("workflow_not_approved", "Approved workflow has invalid steps");
    }
    try {
      const rows = rowsFrom(await client.query(
        `INSERT INTO rag.procedure_cases (
           id, tenant_id, case_key, workflow_version_id, workflow_version_number,
           jurisdiction, subject_reference, community_reference, current_step_id,
           follow_up_at, created_by_principal_id, updated_by_principal_id,
           create_request_sha256, created_at, updated_at
         ) VALUES (
           $1::uuid, $2::uuid, $3, $4::uuid, $5, $6, $7, $8, $9,
           $10::timestamptz, $11::uuid, $11::uuid, decode($12, 'hex'),
           $13::timestamptz, $13::timestamptz
         ) RETURNING *`,
        [
          input.caseId,
          input.request.tenant_id,
          input.request.case_key,
          input.request.workflow_version_id,
          Number(workflow.version_number),
          String(workflow.jurisdiction),
          input.request.subject_reference ?? null,
          input.request.community_reference ?? null,
          steps[0]?.stepId ?? null,
          input.request.follow_up_at ?? null,
          input.principal.principalId,
          input.requestSha256,
          input.now,
        ]
      ));
      for (const [index, step] of steps.entries()) {
        await client.query(
          `INSERT INTO rag.procedure_case_steps (
             case_id, tenant_id, step_id, title, ordinal, state,
             updated_by_principal_id, updated_at
           ) VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'not_started', $6::uuid, $7::timestamptz)`,
          [input.caseId, input.request.tenant_id, step.stepId, step.title, index + 1, input.principal.principalId, input.now]
        );
      }
      await client.query(
        `INSERT INTO rag.procedure_case_events (
           id, tenant_id, case_id, actor_principal_id, event_type, revision, details, created_at
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'procedure_case.created', 1, $5::jsonb, $6::timestamptz)`,
        [
          input.eventId,
          input.request.tenant_id,
          input.caseId,
          input.principal.principalId,
          JSON.stringify({
            workflow_version_id: input.request.workflow_version_id,
            workflow_version_number: Number(workflow.version_number),
          }),
          input.now,
        ]
      );
      return { kind: "created", record: await this.mapCase(client, rows[0]!) };
    } catch (error) {
      if (error instanceof ProcedureCaseError) throw error;
      if (error instanceof Error && /duplicate key|unique/i.test(error.message)) {
        throw new ProcedureCaseError("case_conflict", "Case key already exists");
      }
      throw error;
    }
  }

  async sealCreation(
    client: TenantTransactionClient,
    input: {
      tenantId: string;
      caseId: string;
      principalId: string;
      requestSha256: string;
      responseBody: string;
      auditId: string;
    }
  ): Promise<void> {
    const rows = rowsFrom(await client.query(
      `UPDATE rag.procedure_cases
       SET initial_response_status = 201, initial_response_body = $5,
           initial_response_sha256 = decode($6, 'hex'), initial_audit_id = $7::uuid
       WHERE tenant_id = $1::uuid AND id = $2::uuid
         AND created_by_principal_id = $3::uuid
         AND create_request_sha256 = decode($4, 'hex')
         AND initial_response_body IS NULL
       RETURNING 1`,
      [
        input.tenantId,
        input.caseId,
        input.principalId,
        input.requestSha256,
        input.responseBody,
        sha256(input.responseBody),
        input.auditId,
      ]
    ));
    if (rows.length !== 1) throw new Error("procedure case creation seal mismatch");
  }

  async get(
    client: TenantTransactionClient,
    tenantId: string,
    caseId: string,
    forUpdate = false
  ): Promise<StoredProcedureCase | null> {
    const rows = rowsFrom(await client.query(
      `${SELECT_CASE}${forUpdate ? " FOR UPDATE" : ""}`,
      [tenantId, caseId]
    ));
    return rows[0] ? this.mapCase(client, rows[0]) : null;
  }

  async applyAction(
    client: TenantTransactionClient,
    record: StoredProcedureCase,
    input: {
      request: ProcedureCaseUpdateRequestV1;
      principal: AuthenticatedPrincipal;
      eventId: string;
      entityId: string;
      now: string;
    }
  ): Promise<StoredProcedureCase> {
    if (record.revision !== input.request.expected_revision) {
      throw new ProcedureCaseError("revision_conflict", "Procedure case revision conflict");
    }
    if (record.status === "closed") {
      throw new ProcedureCaseError("invalid_transition", "Closed procedure case cannot change");
    }
    const action = input.request.action;
    let status: ProcedureCaseStatus = record.status;
    let validationState = record.validationState;
    let currentStepId = record.currentStepId;
    let followUpAt = record.followUpAt;
    let operationalNote = record.operationalNote;

    if (action.type === "set_step_state") {
      const rows = rowsFrom(await client.query(
        `UPDATE rag.procedure_case_steps
         SET state = $4, updated_by_principal_id = $5::uuid, updated_at = $6::timestamptz
         WHERE tenant_id = $1::uuid AND case_id = $2::uuid AND step_id = $3
         RETURNING 1`,
        [record.tenantId, record.caseId, action.step_id, action.state, input.principal.principalId, input.now]
      ));
      if (rows.length !== 1) throw new ProcedureCaseError("step_not_found", "Procedure case step not found");
      currentStepId = action.step_id;
      if (action.state === "blocked") status = "blocked";
      else if (action.state === "ready_for_review") status = "ready_for_review";
      else if (action.state === "in_progress" && status !== "blocked") status = "active";
    } else if (action.type === "record_document") {
      if (action.state === "received" || action.state === "reviewed") {
        if (!action.document_version_id) {
          throw new ProcedureCaseError("document_not_found", "Document version not found");
        }
        const documentRows = rowsFrom(await client.query(
          `SELECT 1 FROM rag.document_versions
           WHERE tenant_id = $1::uuid AND id = $2::uuid`,
          [record.tenantId, action.document_version_id]
        ));
        if (documentRows.length !== 1) {
          throw new ProcedureCaseError("document_not_found", "Document version not found");
        }
      }
      await client.query(
        `INSERT INTO rag.procedure_case_documents (
           id, tenant_id, case_id, requirement_id, document_version_id, state, note,
           updated_by_principal_id, created_at, updated_at
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6, $7, $8::uuid, $9::timestamptz, $9::timestamptz)
         ON CONFLICT (tenant_id, case_id, requirement_id)
         DO UPDATE SET document_version_id = EXCLUDED.document_version_id,
           state = EXCLUDED.state, note = EXCLUDED.note,
           updated_by_principal_id = EXCLUDED.updated_by_principal_id,
           updated_at = EXCLUDED.updated_at`,
        [
          input.entityId,
          record.tenantId,
          record.caseId,
          action.requirement_id,
          action.document_version_id ?? null,
          action.state,
          action.note ?? null,
          input.principal.principalId,
          input.now,
        ]
      );
    } else if (action.type === "add_blocker") {
      await client.query(
        `INSERT INTO rag.procedure_case_blockers (
           id, tenant_id, case_id, blocker_code, description,
           created_by_principal_id, created_at
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::uuid, $7::timestamptz)`,
        [input.entityId, record.tenantId, record.caseId, action.blocker_code, action.description, input.principal.principalId, input.now]
      );
      status = "blocked";
    } else if (action.type === "resolve_blocker") {
      const rows = rowsFrom(await client.query(
        `UPDATE rag.procedure_case_blockers
         SET resolved_at = $4::timestamptz, resolved_by_principal_id = $5::uuid
         WHERE tenant_id = $1::uuid AND case_id = $2::uuid AND id = $3::uuid
           AND resolved_at IS NULL
         RETURNING 1`,
        [record.tenantId, record.caseId, action.blocker_id, input.now, input.principal.principalId]
      ));
      if (rows.length !== 1) throw new ProcedureCaseError("blocker_not_found", "Open blocker not found");
      const open = rowsFrom(await client.query(
        `SELECT 1 FROM rag.procedure_case_blockers
         WHERE tenant_id = $1::uuid AND case_id = $2::uuid AND resolved_at IS NULL LIMIT 1`,
        [record.tenantId, record.caseId]
      ));
      if (open.length === 0) status = "active";
    } else if (action.type === "set_follow_up") {
      followUpAt = action.follow_up_at;
    } else if (action.type === "set_validation_state") {
      validationState = action.validation_state;
      if (action.validation_state === "in_review") status = "ready_for_review";
    } else if (action.type === "append_note") {
      operationalNote = action.note;
    } else if (action.type === "close_case") {
      operationalNote = action.note;
      status = "closed";
    }

    const rows = rowsFrom(await client.query(
      `UPDATE rag.procedure_cases
       SET status = $3, validation_state = $4, current_step_id = $5,
           follow_up_at = $6::timestamptz, operational_note = $7,
           revision = revision + 1, updated_by_principal_id = $8::uuid,
           updated_at = $9::timestamptz
       WHERE tenant_id = $1::uuid AND id = $2::uuid AND revision = $10
       RETURNING *`,
      [
        record.tenantId,
        record.caseId,
        status,
        validationState,
        currentStepId,
        followUpAt,
        operationalNote,
        input.principal.principalId,
        input.now,
        record.revision,
      ]
    ));
    if (rows.length !== 1) throw new ProcedureCaseError("revision_conflict", "Procedure case revision conflict");
    const revision = Number(rows[0]!.revision);
    await client.query(
      `INSERT INTO rag.procedure_case_events (
         id, tenant_id, case_id, actor_principal_id, event_type, revision, details, created_at
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7::jsonb, $8::timestamptz)`,
      [
        input.eventId,
        record.tenantId,
        record.caseId,
        input.principal.principalId,
        `procedure_case.${action.type}`,
        revision,
        JSON.stringify(eventDetails(action)),
        input.now,
      ]
    );
    return this.mapCase(client, rows[0]!);
  }
}
