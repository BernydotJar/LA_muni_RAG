import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import {
  InMemoryEvidenceGapPersistence,
  loadEvidenceGapContractValidators,
  type EvidenceGapRequestV1,
} from "../../api/v1/evidenceGapIndex.js";
import type {
  CredentialPrincipalRecord,
  IdentityRepository,
  SecurityRole,
  TenantTransactionClient,
  TenantTransactionPool,
} from "../../security/index.js";
import { createApiServer } from "../../server.js";

export const GAP_TEST_TENANT_A = "11111111-1111-4111-8111-111111111111";
export const GAP_TEST_TENANT_B = "22222222-2222-4222-8222-222222222222";
export const GAP_TEST_PRINCIPAL_ID = "33333333-3333-4333-8333-333333333333";
export const GAP_TEST_CREDENTIAL_ID = "44444444-4444-4444-8444-444444444444";
export const GAP_TEST_REQUEST_ID = "55555555-5555-4555-8555-555555555555";
export const GAP_TEST_ID = "66666666-6666-4666-8666-666666666666";
export const GAP_TEST_TOKEN = "os-electoral-evidence-gap-token-000000000001";
export const GAP_TEST_IDEMPOTENCY_KEY = "evidence-gap-eval-000001";
export const GAP_TEST_FIXED_TIME = new Date("2026-07-21T19:00:00.000Z");

export const evidenceGapValidators = loadEvidenceGapContractValidators();

export const evidenceGapRequest = (
  overrides: Partial<EvidenceGapRequestV1> = {}
): EvidenceGapRequestV1 => ({
  schema_version: "v1",
  direction: "inbound",
  product_boundary: "evidence_gap_request_only",
  gap_request_id: GAP_TEST_ID,
  request_id: GAP_TEST_REQUEST_ID,
  tenant_id: GAP_TEST_TENANT_A,
  subject: "Procedimiento municipal para un proyecto comunitario de agua",
  missing_document: "Manual oficial vigente de agua y saneamiento de Antigua Guatemala",
  reason: "Se requiere una fuente local para validar responsables y pasos.",
  priority: "high",
  campaign_reference: "campaign-antigua-2027",
  jurisdiction: "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala",
  provenance: {
    source_product: "os_electoral",
    generated_by: "integration_client",
    created_at: GAP_TEST_FIXED_TIME.toISOString(),
    source_refs: ["campaign-antigua-2027"],
    credential_id: GAP_TEST_CREDENTIAL_ID,
    audit_id: "77777777-7777-4777-8777-777777777777",
  },
  ...overrides,
});

class EvidenceGapIdentityRepository implements IdentityRepository {
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

class EvidenceGapTransactionPool implements TenantTransactionPool {
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
  credentialId: GAP_TEST_CREDENTIAL_ID,
  tenantId: GAP_TEST_TENANT_A,
  principalId: GAP_TEST_PRINCIPAL_ID,
  roles,
});

export interface EvidenceGapHarness {
  server: Server;
  baseUrl: string;
  persistence: InMemoryEvidenceGapPersistence;
  identity: EvidenceGapIdentityRepository;
  transactionPool: EvidenceGapTransactionPool;
}

export interface EvidenceGapHarnessOptions {
  roles?: readonly SecurityRole[];
  unauthenticated?: boolean;
  authenticationThrows?: boolean;
  rateLimit?: number;
  allowedOrigins?: readonly string[];
  persistence?: InMemoryEvidenceGapPersistence;
  now?: () => Date;
}

export const startEvidenceGapHarness = async (
  options: EvidenceGapHarnessOptions = {}
): Promise<EvidenceGapHarness> => {
  const now = options.now ?? (() => GAP_TEST_FIXED_TIME);
  const persistence = options.persistence ?? new InMemoryEvidenceGapPersistence(now);
  const identity = new EvidenceGapIdentityRepository(
    options.unauthenticated ? null : identityRecord(options.roles),
    options.authenticationThrows
  );
  const transactionPool = new EvidenceGapTransactionPool();
  const server = createApiServer({
    evidenceDependencies: {
      keywordSearch: async () => [],
      phraseSearch: async () => [],
    },
    evidenceGapV1: {
      identityRepository: identity,
      transactionPool,
      persistence,
      authenticationFailureRecorder: persistence,
      validators: evidenceGapValidators,
      now,
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
  };
};

export const stopEvidenceGapHarness = async (
  harness: EvidenceGapHarness
): Promise<void> => {
  await new Promise<void>((resolve, reject) =>
    harness.server.close((error) => (error ? reject(error) : resolve()))
  );
};

export interface EvidenceGapPostOptions {
  idempotencyKey?: string | null;
  requestId?: string | null;
  authorization?: string | null;
  contentType?: string | null;
  origin?: string;
  raw?: boolean;
}

export interface EvidenceGapHttpResult {
  response: Response;
  text: string;
  json: Record<string, unknown>;
}

export const postEvidenceGap = async (
  harness: EvidenceGapHarness,
  body: unknown,
  options: EvidenceGapPostOptions = {}
): Promise<EvidenceGapHttpResult> => {
  const headers = new Headers({
    authorization: `Bearer ${GAP_TEST_TOKEN}`,
    "content-type": "application/json",
    "idempotency-key": GAP_TEST_IDEMPOTENCY_KEY,
    "x-request-id": GAP_TEST_REQUEST_ID,
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
  const response = await fetch(`${harness.baseUrl}/api/v1/evidence-gap-requests`, {
    method: "POST",
    headers,
    body: options.raw ? String(body) : JSON.stringify(body),
  });
  const text = await response.text();
  return { response, text, json: JSON.parse(text) as Record<string, unknown> };
};

export const assertEvidenceGapApiError = async (
  result: EvidenceGapHttpResult,
  status: number,
  code: string
): Promise<void> => {
  const validators = await evidenceGapValidators;
  assert.equal(result.response.status, status);
  assert.equal(validators.apiError(result.json), true, JSON.stringify(validators.apiError.errors));
  const error = result.json.error as Record<string, unknown>;
  assert.equal(error.code, code);
};
