import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { describe, it } from "node:test";
import {
  InMemoryProcedureQueryPersistence,
  loadProcedureQueryContractValidators,
  type ProcedureQueryRequestV1,
  type ProcedureWorkflowCompiler,
} from "../api/v1/index.js";
import type { ProcedureWorkflow } from "../procedure/index.js";
import type {
  CredentialPrincipalRecord,
  IdentityRepository,
  SecurityRole,
  TenantTransactionClient,
  TenantTransactionPool,
} from "../security/index.js";
import { createApiServer } from "../server.js";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const PRINCIPAL_ID = "33333333-3333-4333-8333-333333333333";
const CREDENTIAL_ID = "44444444-4444-4444-8444-444444444444";
const REQUEST_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_REQUEST_ID = "66666666-6666-4666-8666-666666666666";
const TOKEN = "tenant-a-integration-token-000000000001";
const IDEMPOTENCY_KEY = "procedure-query-000001";
const FIXED_TIME = new Date("2026-07-18T18:00:00.000Z");
const validatorsPromise = loadProcedureQueryContractValidators();

const requestBody = (
  overrides: Partial<ProcedureQueryRequestV1> = {}
): ProcedureQueryRequestV1 => ({
  schema_version: "v1",
  direction: "inbound",
  product_boundary: "evidence_and_procedure_request_only",
  request_id: REQUEST_ID,
  tenant_id: TENANT_A,
  campaign_id: "campaign-antigua-2027",
  community_id: "community-san-mateo",
  question: "¿Qué procedimiento documental aplica a una solicitud comunitaria de agua?",
  jurisdiction: "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala",
  case_context: {
    subject_reference: "water-case-san-mateo",
    community_id: "community-san-mateo",
    facts: ["La comunidad documentó una necesidad de agua potable."],
    provided_documents: [],
    constraints: ["No inventar formularios, plazos ni sistemas."],
  },
  requested_depth: "overview",
  requested_output: "procedure_workflow",
  provenance: {
    source_product: "os_electoral",
    generated_by: "integration_client",
    created_at: FIXED_TIME.toISOString(),
    source_refs: ["campaign-antigua-2027", "community-san-mateo"],
    credential_id: CREDENTIAL_ID,
    audit_id: "77777777-7777-4777-8777-777777777777",
  },
  ...overrides,
});

const internalWorkflow = (): ProcedureWorkflow => ({
  id: "internal-workflow",
  title: "Borrador documental para una solicitud comunitaria de agua",
  jurisdiction: "Antigua Guatemala",
  procedureType: "community_request",
  confidence: "low",
  summary: "Borrador documental sujeto a revisión.",
  classification: {
    isProcedural: true,
    procedureType: "community_request",
    asksForExactDeadline: false,
    asksForCurrentStatus: false,
    mentionsExternalMunicipality: false,
    retrievalQueries: ["solicitud comunitaria agua"],
  },
  steps: [
    {
      stepNumber: 1,
      title: "Localizar base documental",
      action: "Localizar y revisar la fuente oficial aplicable antes de ejecutar una actuación.",
      requiredDocuments: ["Solicitud comunitaria respaldada documentalmente"],
      outputDocuments: ["Inventario documental inicial"],
      legalBasis: [],
      sourceEvidence: [],
      evidenceStatus: "insufficient",
      confidence: "low",
    },
  ],
  dependencies: [],
  gaps: [
    {
      missingItem: "Regla municipal aplicable pendiente de localizar.",
      whyItMatters: "Sin ella no se puede afirmar el procedimiento.",
      requiredToConfirm: "Localizar y validar la fuente municipal oficial.",
      severity: "blocking",
    },
  ],
  citations: [],
  validationWarning: "Validar el borrador contra fuentes oficiales vigentes.",
  metadata: {
    domainPackId: "municipal-antigua",
    domainPackName: "Municipalidad de La Antigua Guatemala",
    query: "consulta",
    retrievalMode: "keyword",
    depth: "overview",
    evidenceCount: 0,
    hasLocalEvidence: false,
    hasExternalReference: false,
    hasAntiguaEvidence: false,
    generatedBy: "procedure_workflow_advisor_mvp",
  },
});

class StubIdentityRepository implements IdentityRepository {
  readonly hashes: string[] = [];

  constructor(
    private readonly result: CredentialPrincipalRecord | null,
    private readonly shouldThrow = false
  ) {}

  async authenticateByCredentialHash(hash: string): Promise<CredentialPrincipalRecord | null> {
    this.hashes.push(hash);
    if (this.shouldThrow) throw new Error("database unavailable with sensitive internals");
    return this.result;
  }
}

class StubTransactionPool implements TenantTransactionPool {
  readonly calls: Array<{ sql: string; values?: unknown[] }> = [];
  releases = 0;

  async connect(): Promise<TenantTransactionClient> {
    return {
      query: async (sql, values) => {
        this.calls.push({ sql, ...(values ? { values } : {}) });
        return { rows: [] };
      },
      release: () => {
        this.releases += 1;
      },
    };
  }
}

const identityRecord = (
  roles: readonly SecurityRole[] = ["integration_client"]
): CredentialPrincipalRecord => ({
  credentialId: CREDENTIAL_ID,
  tenantId: TENANT_A,
  principalId: PRINCIPAL_ID,
  roles,
});

interface Harness {
  server: Server;
  baseUrl: string;
  persistence: InMemoryProcedureQueryPersistence;
  identity: StubIdentityRepository;
  transactionPool: StubTransactionPool;
  compilerCalls: { count: number };
}

const startHarness = async (options: {
  roles?: readonly SecurityRole[];
  unauthenticated?: boolean;
  authenticationThrows?: boolean;
  rateLimit?: number;
  compiler?: ProcedureWorkflowCompiler;
  allowedOrigins?: readonly string[];
  persistence?: InMemoryProcedureQueryPersistence;
} = {}): Promise<Harness> => {
  const persistence =
    options.persistence ?? new InMemoryProcedureQueryPersistence(() => FIXED_TIME);
  const identity = new StubIdentityRepository(
    options.unauthenticated ? null : identityRecord(options.roles),
    options.authenticationThrows
  );
  const transactionPool = new StubTransactionPool();
  const compilerCalls = { count: 0 };
  const compiler: ProcedureWorkflowCompiler =
    options.compiler ??
    (async () => {
      compilerCalls.count += 1;
      return { workflow: internalWorkflow(), evidenceRecords: [] };
    });
  const server = createApiServer({
    evidenceDependencies: {
      keywordSearch: async () => [],
      phraseSearch: async () => [],
    },
    procedureQueryV1: {
      identityRepository: identity,
      transactionPool,
      persistence,
      authenticationFailureRecorder: persistence,
      compiler,
      validators: validatorsPromise,
      now: () => FIXED_TIME,
      createUuid: randomUUID,
      rateLimit: options.rateLimit ?? 30,
      rateWindowSeconds: 60,
    },
    v1CorsAllowedOrigins: options.allowedOrigins ?? ["https://os-electoral.example"],
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    persistence,
    identity,
    transactionPool,
    compilerCalls,
  };
};

const stopHarness = async (harness: Harness): Promise<void> => {
  await new Promise<void>((resolve, reject) =>
    harness.server.close((error) => (error ? reject(error) : resolve()))
  );
};

const post = async (
  harness: Harness,
  body: unknown,
  options: {
    idempotencyKey?: string | null;
    requestId?: string | null;
    authorization?: string | null;
    contentType?: string | null;
    origin?: string;
    raw?: boolean;
  } = {}
): Promise<{ response: Response; text: string; json: Record<string, unknown> }> => {
  const headers = new Headers({
    authorization: `Bearer ${TOKEN}`,
    "content-type": "application/json",
    "idempotency-key": IDEMPOTENCY_KEY,
    "x-request-id": REQUEST_ID,
  });
  const assignments: Array<[string, string | null | undefined]> = [
    ["authorization", options.authorization],
    ["content-type", options.contentType],
    ["idempotency-key", options.idempotencyKey],
    ["x-request-id", options.requestId],
  ];
  for (const [name, value] of assignments) {
    if (value === null) headers.delete(name);
    else if (value !== undefined) headers.set(name, value);
  }
  if (options.origin) headers.set("origin", options.origin);
  const response = await fetch(`${harness.baseUrl}/api/v1/procedure-queries`, {
    method: "POST",
    headers,
    body: options.raw ? String(body) : JSON.stringify(body),
  });
  const text = await response.text();
  return { response, text, json: JSON.parse(text) as Record<string, unknown> };
};

const assertApiError = async (
  result: { response: Response; json: Record<string, unknown> },
  status: number,
  code: string
): Promise<void> => {
  assert.equal(result.response.status, status);
  const validators = await validatorsPromise;
  assert.equal(validators.apiError(result.json), true, JSON.stringify(validators.apiError.errors));
  assert.equal((result.json.error as { code: string }).code, code);
  assert.equal(result.response.headers.get("x-request-id"), result.json.request_id);
};

describe("POST /api/v1/procedure-queries", () => {
  it("authenticates before parsing and returns a uniform contract-valid 401", async () => {
    const harness = await startHarness({ unauthenticated: true });
    try {
      const result = await post(harness, "{not json", { raw: true, authorization: null });
      await assertApiError(result, 401, "unauthorized");
      assert.equal(result.response.headers.get("www-authenticate"), 'Bearer realm="la-muni-rag"');
      assert.equal(result.json.tenant_id, null);
      assert.equal((result.json.provenance as { credential_id: unknown }).credential_id, null);
      assert.equal(harness.compilerCalls.count, 0);
      assert.equal(harness.persistence.authenticationFailures.length, 1);
      assert.equal(harness.persistence.authenticationFailures[0]?.reasonCode, "credential_rejected");
      const repeated = await post(harness, requestBody(), { authorization: null });
      await assertApiError(repeated, 401, "unauthorized");
      assert.equal(repeated.json.audit_id, result.json.audit_id);
      assert.equal(harness.persistence.authenticationFailures.length, 1);
      assert.equal(harness.persistence.authenticationFailures[0]?.failureCount, 2);
    } finally {
      await stopHarness(harness);
    }
  });

  it("sanitizes authentication dependency failures without inventing a tenant", async () => {
    const harness = await startHarness({ authenticationThrows: true });
    try {
      const result = await post(harness, requestBody());
      await assertApiError(result, 401, "unauthorized");
      assert.equal(result.json.tenant_id, null);
      assert.equal(
        harness.persistence.authenticationFailures[0]?.reasonCode,
        "authentication_dependency_failure"
      );
      assert.doesNotMatch(JSON.stringify(result.json), /database unavailable|sensitive internals/i);
    } finally {
      await stopHarness(harness);
    }
  });

  it("uses the same non-leaking 403 for role and tenant denial and audits both", async () => {
    const roleHarness = await startHarness({ roles: ["viewer"] });
    const tenantHarness = await startHarness();
    try {
      const roleResult = await post(roleHarness, requestBody());
      const tenantResult = await post(
        tenantHarness,
        requestBody({ tenant_id: TENANT_B })
      );
      await assertApiError(roleResult, 403, "forbidden");
      await assertApiError(tenantResult, 403, "forbidden");
      assert.deepEqual(roleResult.json.error, tenantResult.json.error);
      assert.equal(roleHarness.compilerCalls.count, 0);
      assert.equal(tenantHarness.compilerCalls.count, 0);
      assert.equal(roleHarness.persistence.audits[0]?.eventType, "integration.procedure_query.authorization_denied");
      assert.equal(tenantHarness.persistence.audits[0]?.eventType, "integration.procedure_query.tenant_access_denied");
      assert.equal(tenantHarness.persistence.audits[0]?.tenantId, TENANT_A);
    } finally {
      await stopHarness(roleHarness);
      await stopHarness(tenantHarness);
    }
  });

  it("rejects request-id mismatch and strict-schema extra properties before compilation", async () => {
    const mismatchHarness = await startHarness();
    const schemaHarness = await startHarness();
    try {
      const mismatch = await post(mismatchHarness, requestBody(), { requestId: OTHER_REQUEST_ID });
      await assertApiError(mismatch, 400, "request_id_mismatch");
      assert.equal(mismatch.json.request_id, OTHER_REQUEST_ID);
      assert.equal(mismatchHarness.compilerCalls.count, 0);

      const invalid = { ...requestBody(), unexpected_secret: "must-not-echo" };
      const schema = await post(schemaHarness, invalid);
      await assertApiError(schema, 400, "invalid_request");
      assert.equal(schemaHarness.compilerCalls.count, 0);
      assert.doesNotMatch(JSON.stringify(schema.json), /must-not-echo/);
    } finally {
      await stopHarness(mismatchHarness);
      await stopHarness(schemaHarness);
    }
  });

  it("requires an allowlisted Idempotency-Key", async () => {
    const harness = await startHarness();
    try {
      const missing = await post(harness, requestBody(), { idempotencyKey: null });
      await assertApiError(missing, 400, "invalid_idempotency_key");
      const invalid = await post(harness, requestBody(), { idempotencyKey: "short/key" });
      await assertApiError(invalid, 400, "invalid_idempotency_key");
      assert.equal(harness.compilerCalls.count, 0);
    } finally {
      await stopHarness(harness);
    }
  });

  it("returns a contract error for an oversized body without destroying subsequent service", async () => {
    const harness = await startHarness();
    try {
      const oversized = await post(
        harness,
        { ...requestBody(), question: "x".repeat(20_000) },
        { idempotencyKey: "oversized-request-01" }
      );
      await assertApiError(oversized, 400, "invalid_request");
      assert.equal(harness.compilerCalls.count, 0);

      const subsequent = await post(harness, requestBody(), {
        idempotencyKey: "oversized-followup-02",
      });
      assert.equal(subsequent.response.status, 200);
      assert.equal(harness.compilerCalls.count, 1);
    } finally {
      await stopHarness(harness);
    }
  });

  it("returns a schema-valid draft AI workflow and exact idempotent replay", async () => {
    const harness = await startHarness();
    try {
      const first = await post(harness, requestBody());
      assert.equal(first.response.status, 200);
      const validators = await validatorsPromise;
      assert.equal(validators.workflow(first.json), true, JSON.stringify(validators.workflow.errors));
      assert.equal(first.json.approval_status, "draft");
      assert.equal((first.json.provenance as { generated_by: string }).generated_by, "ai");
      const firstStep = (first.json.steps as Array<Record<string, unknown>>)[0];
      assert.equal(firstStep?.responsible_actor, null);
      assert.equal(firstStep?.responsible_unit, null);
      assert.equal(firstStep?.deadline, null);
      assert.equal(firstStep?.external_system, null);
      assert.equal(firstStep?.evidence_status, "missing_evidence");

      const replay = await post(harness, requestBody());
      assert.equal(replay.response.status, 200);
      assert.equal(replay.text, first.text);
      assert.equal(harness.compilerCalls.count, 1);
      assert.ok(
        harness.persistence.audits.some(
          (audit) => audit.eventType === "integration.procedure_query.idempotency_replayed"
        )
      );

      const conflict = await post(
        harness,
        requestBody({ question: "Una consulta documental diferente con la misma llave." })
      );
      await assertApiError(conflict, 409, "idempotency_conflict");
      assert.equal(harness.compilerCalls.count, 1);
    } finally {
      await stopHarness(harness);
    }
  });

  it("rejects and invalidates a corrupt stored replay instead of emitting trusted DB bytes", async () => {
    class CorruptReplayPersistence extends InMemoryProcedureQueryPersistence {
      invalidations = 0;

      override async claimIdempotency() {
        return {
          kind: "replay" as const,
          statusCode: 200,
          responseBody: JSON.stringify({ tenant_id: TENANT_B, secret: "must-not-leak" }),
          originalAuditId: "88888888-8888-4888-8888-888888888888",
        };
      }

      override async invalidateCompletedIdempotency(): Promise<void> {
        this.invalidations += 1;
      }
    }

    const persistence = new CorruptReplayPersistence(() => FIXED_TIME);
    const harness = await startHarness({ persistence });
    try {
      const result = await post(harness, requestBody());
      const parsed = JSON.parse(result.text) as Record<string, unknown>;

      assert.equal(result.response.status, 500);
      assert.equal(result.text.includes("must-not-leak"), false);
      assert.equal(persistence.invalidations, 1);
      assert.equal(
        persistence.audits.some(
          (audit) => audit.eventType === "integration.procedure_query.idempotency_corrupt"
        ),
        true
      );
      const validators = await validatorsPromise;
      assert.equal(validators.apiError(parsed), true, JSON.stringify(validators.apiError.errors));
    } finally {
      await stopHarness(harness);
    }
  });

  it("rolls back a failed compilation and permits a safe retry with the same key", async () => {
    let compilerCalls = 0;
    const harness = await startHarness({
      compiler: async () => {
        compilerCalls += 1;
        if (compilerCalls === 1) throw new Error("sensitive compiler failure");
        return { workflow: internalWorkflow(), evidenceRecords: [] };
      },
    });
    try {
      const failed = await post(harness, requestBody());
      await assertApiError(failed, 500, "internal_error");
      assert.doesNotMatch(failed.text, /sensitive compiler failure/);
      assert.equal(
        harness.persistence.audits.some(
          (audit) =>
            audit.eventType === "integration.procedure_query.failed" &&
            audit.reasonCode === "execution_failed"
        ),
        true
      );

      const retried = await post(harness, requestBody());
      assert.equal(retried.response.status, 200);
      assert.equal(compilerCalls, 2);
    } finally {
      await stopHarness(harness);
    }
  });

  it("rate-limits authenticated idempotent replays before idempotency processing", async () => {
    const harness = await startHarness({ rateLimit: 1 });
    try {
      const first = await post(harness, requestBody());
      assert.equal(first.response.status, 200);
      const second = await post(harness, requestBody());
      await assertApiError(second, 429, "rate_limit_exceeded");
      assert.ok(Number(second.response.headers.get("retry-after")) >= 1);
      assert.equal(harness.compilerCalls.count, 1);
      assert.ok(
        harness.persistence.audits.some(
          (audit) => audit.eventType === "integration.procedure_query.rate_limited"
        )
      );
    } finally {
      await stopHarness(harness);
    }
  });

  it("rate-limits rejected authenticated traffic and bounds rate-denial audit growth", async () => {
    const harness = await startHarness({ rateLimit: 1 });
    try {
      const invalid = { ...requestBody(), extra: "invalid" };
      const first = await post(harness, invalid, { idempotencyKey: "rejected-request-rate-01" });
      await assertApiError(first, 400, "invalid_request");
      const second = await post(harness, invalid, { idempotencyKey: "rejected-request-rate-02" });
      await assertApiError(second, 429, "rate_limit_exceeded");
      const third = await post(harness, invalid, { idempotencyKey: "rejected-request-rate-03" });
      await assertApiError(third, 429, "rate_limit_exceeded");
      assert.equal(harness.compilerCalls.count, 0);
      assert.equal(
        harness.persistence.audits.filter(
          (audit) => audit.eventType === "integration.procedure_query.rate_limited"
        ).length,
        1
      );
      assert.equal(harness.persistence.audits.length, 2);
      assert.equal(second.json.audit_id, third.json.audit_id);
    } finally {
      await stopHarness(harness);
    }
  });

  it("returns an evidence bundle and keeps procedure assessment honestly unavailable", async () => {
    const evidenceHarness = await startHarness();
    try {
      const result = await post(
        evidenceHarness,
        requestBody({ requested_output: "evidence_bundle" })
      );
      const validators = await validatorsPromise;
      assert.equal(result.response.status, 200);
      assert.equal(
        validators.evidenceBundle(result.json),
        true,
        JSON.stringify(validators.evidenceBundle.errors)
      );
      assert.equal(result.json.response_type, "evidence_bundle");
      assert.equal(evidenceHarness.compilerCalls.count, 1);
    } finally {
      await stopHarness(evidenceHarness);
    }

    const assessmentHarness = await startHarness();
    try {
      const result = await post(
        assessmentHarness,
        requestBody({ requested_output: "procedure_assessment" })
      );
      await assertApiError(result, 503, "capability_unavailable");
      assert.equal(assessmentHarness.compilerCalls.count, 0);
    } finally {
      await stopHarness(assessmentHarness);
    }
  });

  it("blocks electoral strategy and content generation at the product boundary", async () => {
    for (const question of [
      "Diseña una estrategia electoral con segmentación de votantes.",
      "Prioriza comunidades para movilización.",
      "Redacta un plan para convencer electores indecisos.",
      "Crea un calendario de contenido y redacta publicaciones para redes.",
    ]) {
      const harness = await startHarness();
      try {
        const result = await post(harness, requestBody({ question }));
        await assertApiError(result, 400, "product_boundary_violation");
        assert.match(
          (result.json.error as { message: string }).message,
          /OS Electoral.*Content Agency/
        );
        assert.equal(harness.compilerCalls.count, 0);
      } finally {
        await stopHarness(harness);
      }
    }
  });

  it("never audits the Bearer value, raw idempotency key, question, or body", async () => {
    const harness = await startHarness();
    try {
      const body = requestBody({
        question: "SENSITIVE_QUESTION_MARKER procedimiento documental",
      });
      const result = await post(harness, body);
      assert.equal(result.response.status, 200);
      const audits = JSON.stringify(harness.persistence.audits);
      assert.doesNotMatch(audits, new RegExp(TOKEN));
      assert.doesNotMatch(audits, new RegExp(IDEMPOTENCY_KEY));
      assert.doesNotMatch(audits, /SENSITIVE_QUESTION_MARKER/);
      assert.doesNotMatch(audits, /case_context|provided_documents/);
      assert.match(audits, /idempotencyKeySha256/);
      assert.equal(harness.identity.hashes.length, 1);
      assert.match(harness.identity.hashes[0] ?? "", /^[0-9a-f]{64}$/);
      assert.ok(!harness.identity.hashes[0]?.includes(TOKEN));
    } finally {
      await stopHarness(harness);
    }
  });

  it("uses an exact v1 CORS allowlist with Vary Origin while leaving server clients usable", async () => {
    const harness = await startHarness({ allowedOrigins: ["https://allowed.example"] });
    try {
      const allowed = await post(harness, requestBody(), {
        origin: "https://allowed.example",
      });
      assert.equal(allowed.response.headers.get("access-control-allow-origin"), "https://allowed.example");
      assert.match(allowed.response.headers.get("vary") ?? "", /Origin/);

      const denied = await post(harness, requestBody(), {
        origin: "https://untrusted.example",
        idempotencyKey: "procedure-query-cors-02",
      });
      assert.equal(denied.response.headers.get("access-control-allow-origin"), null);
      assert.match(denied.response.headers.get("vary") ?? "", /Origin/);

      const preflight = await fetch(`${harness.baseUrl}/api/v1/procedure-queries`, {
        method: "OPTIONS",
        headers: { origin: "https://allowed.example" },
      });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get("access-control-allow-origin"), "https://allowed.example");
      assert.match(preflight.headers.get("vary") ?? "", /Origin/);
    } finally {
      await stopHarness(harness);
    }
  });
});
