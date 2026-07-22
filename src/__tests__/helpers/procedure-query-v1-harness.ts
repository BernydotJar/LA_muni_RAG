import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import {
  InMemoryProcedureQueryPersistence,
  loadProcedureQueryContractValidators,
  type ProcedureQueryRequestV1,
  type ProcedureWorkflowCompiler,
} from "../../api/v1/index.js";
import type { ProcedureWorkflow } from "../../procedure/index.js";
import type {
  CredentialPrincipalRecord,
  IdentityRepository,
  SecurityRole,
  TenantTransactionClient,
  TenantTransactionPool,
} from "../../security/index.js";
import { createApiServer } from "../../server.js";

export const TEST_TENANT_A = "11111111-1111-4111-8111-111111111111";
export const TEST_TENANT_B = "22222222-2222-4222-8222-222222222222";
export const TEST_PRINCIPAL_ID = "33333333-3333-4333-8333-333333333333";
export const TEST_CREDENTIAL_ID = "44444444-4444-4444-8444-444444444444";
export const TEST_REQUEST_ID = "55555555-5555-4555-8555-555555555555";
export const TEST_TOKEN = "tenant-a-integration-token-000000000001";
export const TEST_IDEMPOTENCY_KEY = "procedure-query-eval-000001";
export const TEST_FIXED_TIME = new Date("2026-07-21T12:00:00.000Z");

const validatorsPromise = loadProcedureQueryContractValidators();

export const procedureQueryRequest = (
  overrides: Partial<ProcedureQueryRequestV1> = {}
): ProcedureQueryRequestV1 => ({
  schema_version: "v1",
  direction: "inbound",
  product_boundary: "evidence_and_procedure_request_only",
  request_id: TEST_REQUEST_ID,
  tenant_id: TEST_TENANT_A,
  campaign_id: "campaign-reference-only",
  community_id: "community-reference-only",
  question: "¿Qué procedimiento documental aplica a una solicitud comunitaria de agua?",
  jurisdiction: "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala",
  case_context: {
    subject_reference: "procedure-eval-case",
    community_id: "community-reference-only",
    facts: ["La consulta requiere evidencia y procedimiento municipal."],
    provided_documents: [],
    constraints: ["No inventar formularios, plazos ni sistemas."],
  },
  requested_depth: "overview",
  requested_output: "procedure_workflow",
  provenance: {
    source_product: "os_electoral",
    generated_by: "integration_client",
    created_at: TEST_FIXED_TIME.toISOString(),
    source_refs: ["campaign-reference-only", "community-reference-only"],
    credential_id: TEST_CREDENTIAL_ID,
    audit_id: "77777777-7777-4777-8777-777777777777",
  },
  ...overrides,
});

export const testInternalWorkflow = (): ProcedureWorkflow => ({
  id: "test-internal-workflow",
  title: "Borrador documental para una solicitud comunitaria",
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
    retrievalQueries: ["solicitud comunitaria procedimiento"],
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

class TestIdentityRepository implements IdentityRepository {
  readonly hashes: string[] = [];

  constructor(
    private readonly result: CredentialPrincipalRecord | null,
    private readonly shouldThrow = false
  ) {}

  async authenticateByCredentialHash(hash: string): Promise<CredentialPrincipalRecord | null> {
    this.hashes.push(hash);
    if (this.shouldThrow) throw new Error("test authentication dependency failure");
    return this.result;
  }
}

class TestTransactionPool implements TenantTransactionPool {
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
  credentialId: TEST_CREDENTIAL_ID,
  tenantId: TEST_TENANT_A,
  principalId: TEST_PRINCIPAL_ID,
  roles,
});

export interface ProcedureQueryHarness {
  server: Server;
  baseUrl: string;
  persistence: InMemoryProcedureQueryPersistence;
  identity: TestIdentityRepository;
  transactionPool: TestTransactionPool;
  compilerCalls: { count: number };
}

export interface ProcedureQueryHarnessOptions {
  roles?: readonly SecurityRole[];
  unauthenticated?: boolean;
  authenticationThrows?: boolean;
  rateLimit?: number;
  compiler?: ProcedureWorkflowCompiler;
  allowedOrigins?: readonly string[];
  persistence?: InMemoryProcedureQueryPersistence;
}

export const startProcedureQueryHarness = async (
  options: ProcedureQueryHarnessOptions = {}
): Promise<ProcedureQueryHarness> => {
  const persistence =
    options.persistence ?? new InMemoryProcedureQueryPersistence(() => TEST_FIXED_TIME);
  const identity = new TestIdentityRepository(
    options.unauthenticated ? null : identityRecord(options.roles),
    options.authenticationThrows
  );
  const transactionPool = new TestTransactionPool();
  const compilerCalls = { count: 0 };
  const compiler: ProcedureWorkflowCompiler =
    options.compiler ??
    (async () => {
      compilerCalls.count += 1;
      return { workflow: testInternalWorkflow(), evidenceRecords: [] };
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
      now: () => TEST_FIXED_TIME,
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

export const stopProcedureQueryHarness = async (
  harness: ProcedureQueryHarness
): Promise<void> => {
  await new Promise<void>((resolve, reject) =>
    harness.server.close((error) => (error ? reject(error) : resolve()))
  );
};

export interface ProcedureQueryPostOptions {
  idempotencyKey?: string | null;
  requestId?: string | null;
  authorization?: string | null;
  contentType?: string | null;
  origin?: string;
  raw?: boolean;
}

export interface ProcedureQueryHttpResult {
  response: Response;
  text: string;
  json: Record<string, unknown>;
}

export const postProcedureQuery = async (
  harness: ProcedureQueryHarness,
  body: unknown,
  options: ProcedureQueryPostOptions = {}
): Promise<ProcedureQueryHttpResult> => {
  const headers = new Headers({
    authorization: `Bearer ${TEST_TOKEN}`,
    "content-type": "application/json",
    "idempotency-key": TEST_IDEMPOTENCY_KEY,
    "x-request-id": TEST_REQUEST_ID,
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
  return {
    response,
    text,
    json: JSON.parse(text) as Record<string, unknown>,
  };
};

export const assertContractApiError = async (
  result: ProcedureQueryHttpResult,
  status: number,
  code: string
): Promise<void> => {
  assert.equal(result.response.status, status);
  const validators = await validatorsPromise;
  assert.equal(validators.apiError(result.json), true, JSON.stringify(validators.apiError.errors));
  assert.equal((result.json.error as { code: string }).code, code);
  assert.equal(result.response.headers.get("x-request-id"), result.json.request_id);
};

export const procedureQueryValidators = validatorsPromise;
