import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import {
  InMemoryClaimPackPersistence,
  loadClaimPackContractValidators,
  type ClaimPackRequestV1,
} from "../../api/v1/claimPackIndex.js";
import type { ProcedureWorkflowCompiler } from "../../api/v1/types.js";
import type {
  CredentialPrincipalRecord,
  IdentityRepository,
  SecurityRole,
  TenantTransactionClient,
  TenantTransactionPool,
} from "../../security/index.js";
import { createApiServer } from "../../server.js";
import { testInternalWorkflow } from "./procedure-query-v1-harness.js";

export const CLAIM_TEST_TENANT_A = "11111111-1111-4111-8111-111111111111";
export const CLAIM_TEST_TENANT_B = "22222222-2222-4222-8222-222222222222";
export const CLAIM_TEST_PRINCIPAL_ID = "33333333-3333-4333-8333-333333333333";
export const CLAIM_TEST_CREDENTIAL_ID = "44444444-4444-4444-8444-444444444444";
export const CLAIM_TEST_REQUEST_ID = "55555555-5555-4555-8555-555555555555";
export const CLAIM_TEST_TOKEN = "content-agency-integration-token-000000000001";
export const CLAIM_TEST_IDEMPOTENCY_KEY = "claim-pack-eval-000001";
export const CLAIM_TEST_FIXED_TIME = new Date("2026-07-21T12:00:00.000Z");
export const CLAIM_TEST_VALID_UNTIL = new Date(
  CLAIM_TEST_FIXED_TIME.getTime() + 86_400_000
).toISOString();

export const claimPackValidators = loadClaimPackContractValidators();

export const claimPackRequest = (
  overrides: Partial<ClaimPackRequestV1> = {}
): ClaimPackRequestV1 => ({
  schema_version: "v1",
  direction: "inbound",
  product_boundary: "claims_and_evidence_request_only",
  request_id: CLAIM_TEST_REQUEST_ID,
  tenant_id: CLAIM_TEST_TENANT_A,
  question:
    "¿Qué afirmaciones documentales están respaldadas sobre la recepción de una solicitud comunitaria?",
  jurisdiction: "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala",
  case_context: {
    subject_reference: "claim-pack-documentary-review",
    facts: [],
    provided_documents: [],
    constraints: ["Conservar citas y limitaciones documentales."],
  },
  requested_depth: "overview",
  provenance: {
    source_product: "content_agency",
    generated_by: "integration_client",
    created_at: CLAIM_TEST_FIXED_TIME.toISOString(),
    source_refs: ["approved-brief-reference-only"],
    credential_id: CLAIM_TEST_CREDENTIAL_ID,
    audit_id: "77777777-7777-4777-8777-777777777777",
  },
  ...overrides,
});

class ClaimPackIdentityRepository implements IdentityRepository {
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

class ClaimPackTransactionPool implements TenantTransactionPool {
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
  credentialId: CLAIM_TEST_CREDENTIAL_ID,
  tenantId: CLAIM_TEST_TENANT_A,
  principalId: CLAIM_TEST_PRINCIPAL_ID,
  roles,
});

export interface ClaimPackHarness {
  server: Server;
  baseUrl: string;
  persistence: InMemoryClaimPackPersistence;
  identity: ClaimPackIdentityRepository;
  transactionPool: ClaimPackTransactionPool;
  compilerCalls: { count: number };
}

export interface ClaimPackHarnessOptions {
  roles?: readonly SecurityRole[];
  unauthenticated?: boolean;
  authenticationThrows?: boolean;
  rateLimit?: number;
  compiler?: ProcedureWorkflowCompiler;
  allowedOrigins?: readonly string[];
  persistence?: InMemoryClaimPackPersistence;
  validitySeconds?: number;
  now?: () => Date;
}

export const startClaimPackHarness = async (
  options: ClaimPackHarnessOptions = {}
): Promise<ClaimPackHarness> => {
  const now = options.now ?? (() => CLAIM_TEST_FIXED_TIME);
  const persistence =
    options.persistence ?? new InMemoryClaimPackPersistence(now);
  const identity = new ClaimPackIdentityRepository(
    options.unauthenticated ? null : identityRecord(options.roles),
    options.authenticationThrows
  );
  const transactionPool = new ClaimPackTransactionPool();
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
    claimPackV1: {
      identityRepository: identity,
      transactionPool,
      persistence,
      authenticationFailureRecorder: persistence,
      compiler,
      validators: claimPackValidators,
      now,
      createUuid: randomUUID,
      rateLimit: options.rateLimit ?? 30,
      rateWindowSeconds: 60,
      validitySeconds: options.validitySeconds ?? 86_400,
    },
    v1CorsAllowedOrigins: options.allowedOrigins ?? ["https://content-agency.example"],
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

export const stopClaimPackHarness = async (harness: ClaimPackHarness): Promise<void> => {
  await new Promise<void>((resolve, reject) =>
    harness.server.close((error) => (error ? reject(error) : resolve()))
  );
};

export interface ClaimPackPostOptions {
  idempotencyKey?: string | null;
  requestId?: string | null;
  authorization?: string | null;
  contentType?: string | null;
  origin?: string;
  raw?: boolean;
}

export interface ClaimPackHttpResult {
  response: Response;
  text: string;
  json: Record<string, unknown>;
}

export const postClaimPack = async (
  harness: ClaimPackHarness,
  body: unknown,
  options: ClaimPackPostOptions = {}
): Promise<ClaimPackHttpResult> => {
  const headers = new Headers({
    authorization: `Bearer ${CLAIM_TEST_TOKEN}`,
    "content-type": "application/json",
    "idempotency-key": CLAIM_TEST_IDEMPOTENCY_KEY,
    "x-request-id": CLAIM_TEST_REQUEST_ID,
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
  const response = await fetch(`${harness.baseUrl}/api/v1/claim-packs`, {
    method: "POST",
    headers,
    body: options.raw ? String(body) : JSON.stringify(body),
  });
  const text = await response.text();
  return { response, text, json: JSON.parse(text) as Record<string, unknown> };
};

export const assertClaimPackApiError = async (
  result: ClaimPackHttpResult,
  status: number,
  code: string
): Promise<void> => {
  const validators = await claimPackValidators;
  assert.equal(result.response.status, status);
  assert.equal(validators.apiError(result.json), true, JSON.stringify(validators.apiError.errors));
  const error = result.json.error as Record<string, unknown>;
  assert.equal(error.code, code);
};
