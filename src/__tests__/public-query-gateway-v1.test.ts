import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { describe, it } from "node:test";
import { createApiServer } from "../server.js";
import type { TenantTransactionClient, TenantTransactionPool } from "../security/index.js";
import {
  InMemorySearchEvidenceRepository,
  type StoredSearchCandidate,
} from "../api/v1/searchEvidenceIndex.js";
import {
  InMemoryPublicQueryRepository,
  loadPublicQueryValidators,
  type PublicQueryResponseV1,
} from "../api/public/v1/publicQueryIndex.js";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const ORIGIN = "https://consulta.example";
const FIXED_TIME = new Date("2026-07-22T20:00:00.000Z");
const TARGET_JURISDICTION = "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala";

class StubTransactionPool implements TenantTransactionPool {
  readonly calls: Array<{ sql: string; values?: unknown[] }> = [];
  releases = 0;
  async connect(): Promise<TenantTransactionClient> {
    return {
      query: async (sql, values) => {
        this.calls.push({ sql, ...(values ? { values } : {}) });
        return { rows: [], rowCount: 0 };
      },
      release: () => { this.releases += 1; },
    };
  }
}

const candidate = (overrides: Partial<StoredSearchCandidate> = {}): StoredSearchCandidate => ({
  tenantId: TENANT_A,
  sourceId: "77777777-7777-4777-8777-777777777777",
  sourceKey: "antigua-water-procedure",
  sourceTitle: "Manual municipal de agua potable",
  sourceRelation: "target",
  targetJurisdiction: TARGET_JURISDICTION,
  sourceJurisdiction: TARGET_JURISDICTION,
  validationState: "validated",
  officialSource: true,
  officialForTargetJurisdiction: true,
  acquisitionState: "acquired",
  sourceIngestionState: "ingested",
  sourceRetrievalState: "indexed",
  publicationDate: "2025-01-10",
  effectiveDate: "2025-02-01",
  repealDate: null,
  documentId: "88888888-8888-4888-8888-888888888888",
  documentVersionId: "99999999-9999-4999-8999-999999999999",
  sectionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  chunkId: "chunk-antigua-1",
  documentTitle: "Manual municipal de agua potable",
  documentType: "procedure",
  documentScope: "municipal",
  confidentiality: "public",
  documentStatus: "active",
  extractionStatus: "processed",
  sourceUrl: "https://muniantigua.gob.gt/documentos/manual-agua.pdf",
  contentSha256: "a".repeat(64),
  citationLabel: "Manual municipal de agua potable, página 12",
  excerpt: "La unidad municipal recibe la solicitud y verifica los requisitos publicados.",
  pageStart: 12,
  pageEnd: 12,
  articleNumber: null,
  keywordScore: 0.87,
  phraseMatched: true,
  semanticScore: null,
  ...overrides,
});

const comparativeCandidate = (): StoredSearchCandidate => candidate({
  sourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  sourceKey: "mixco-water-manual",
  sourceTitle: "Manual de aguas de Mixco",
  sourceRelation: "comparative",
  sourceJurisdiction: "Municipio de Mixco, Guatemala",
  officialForTargetJurisdiction: false,
  documentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  documentVersionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  sectionId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  chunkId: "chunk-mixco-1",
  documentTitle: "Manual de aguas de Mixco",
  sourceUrl: "https://munimixco.gob.gt/manuales/aguas.pdf",
  contentSha256: "b".repeat(64),
  citationLabel: "Manual de aguas de Mixco, página 8",
  excerpt: "La dependencia de Mixco registra la solicitud y revisa el expediente.",
  pageStart: 8,
  pageEnd: 8,
  keywordScore: 0.62,
});

interface Harness {
  server: Server;
  baseUrl: string;
  publicRepository: InMemoryPublicQueryRepository;
  searchRepository: InMemorySearchEvidenceRepository;
  transactionPool: StubTransactionPool;
}

const startHarness = async (options: {
  enabled?: boolean;
  rateLimit?: number;
  globalRateLimit?: number;
  allowedOrigins?: readonly string[];
  candidates?: StoredSearchCandidate[];
} = {}): Promise<Harness> => {
  const publicRepository = new InMemoryPublicQueryRepository(() => FIXED_TIME);
  const searchRepository = new InMemorySearchEvidenceRepository(() => FIXED_TIME);
  for (const item of options.candidates ?? [
    candidate(),
    comparativeCandidate(),
    candidate({
      tenantId: TENANT_B,
      sourceId: "12121212-1212-4121-8121-121212121212",
      documentId: "13131313-1313-4131-8131-131313131313",
      documentVersionId: "14141414-1414-4141-8141-141414141414",
      sectionId: "15151515-1515-4151-8151-151515151515",
      chunkId: "other-tenant",
    }),
  ]) searchRepository.seedCandidate(item);
  const transactionPool = new StubTransactionPool();
  const server = createApiServer({
    evidenceDependencies: { keywordSearch: async () => [], phraseSearch: async () => [] },
    publicQueryV1: {
      enabled: options.enabled ?? true,
      tenantId: TENANT_A,
      jurisdiction: TARGET_JURISDICTION,
      allowedOrigins: options.allowedOrigins ?? [ORIGIN],
      clientKeySecret: "public-query-test-secret-at-least-thirty-two-bytes",
      rateLimit: options.rateLimit ?? 20,
      globalRateLimit: options.globalRateLimit ?? 100,
      rateWindowSeconds: 60,
      publicRepository,
      searchRepository,
      transactionPool,
      validators: loadPublicQueryValidators(),
      now: () => FIXED_TIME,
      createUuid: randomUUID,
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    publicRepository,
    searchRepository,
    transactionPool,
  };
};

const stopHarness = async (harness: Harness): Promise<void> => {
  await new Promise<void>((resolve, reject) =>
    harness.server.close((error) => error ? reject(error) : resolve())
  );
};

const postQuery = async (
  harness: Harness,
  body: unknown = { message: "requisitos para una solicitud de agua", mode: "keyword", limit: 5 },
  options: { origin?: string; requestId?: string; userAgent?: string } = {}
): Promise<Response> => fetch(`${harness.baseUrl}/api/public/v1/query`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: options.origin ?? ORIGIN,
    "x-request-id": options.requestId ?? "55555555-5555-4555-8555-555555555555",
    "user-agent": options.userAgent ?? "public-query-test-agent",
  },
  body: JSON.stringify(body),
});

describe("public query gateway v1", () => {
  it("returns a bounded 503 when the gateway is disabled", async () => {
    const harness = await startHarness({ enabled: false });
    try {
      const response = await postQuery(harness);
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(harness.searchRepository.searchCalls.length, 0);
      const body = await response.json() as { error: { code: string } };
      assert.equal(body.error.code, "service_unavailable");
    } finally { await stopHarness(harness); }
  });

  it("accepts a credential-free exact-origin keyword query under server tenant context", async () => {
    const harness = await startHarness();
    try {
      const response = await postQuery(harness);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("access-control-allow-origin"), ORIGIN);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      const body = await response.json() as PublicQueryResponseV1 & Record<string, unknown>;
      assert.equal(body.schema_version, "v1");
      assert.equal(body.response_type, "public_query");
      assert.equal(body.role, "assistant");
      assert.equal(body.meta.responseLabel, "evidence_found");
      assert.ok(body.citations.length >= 1);
      assert.ok(body.citations.every((citation) => citation.sourceUrl.startsWith("https://")));
      assert.equal("tenant_id" in body, false);
      assert.equal("credential_id" in body, false);
      assert.equal("audit_id" in body, false);
      assert.equal(harness.searchRepository.searchCalls[0]?.input.tenantId, TENANT_A);
      assert.ok(harness.transactionPool.calls.some((call) => call.sql.includes("set_config('app.tenant_id'")));
    } finally { await stopHarness(harness); }
  });

  it("rejects missing or foreign origins before reading/searching", async () => {
    const harness = await startHarness();
    try {
      const foreign = await postQuery(harness, { message: "agua", mode: "keyword", limit: 5 }, { origin: "https://evil.example" });
      assert.equal(foreign.status, 403);
      const missing = await fetch(`${harness.baseUrl}/api/public/v1/query`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "agua", mode: "keyword", limit: 5 }),
      });
      assert.equal(missing.status, 403);
      assert.equal(harness.searchRepository.searchCalls.length, 0);
    } finally { await stopHarness(harness); }
  });


  it("rejects Authorization and Cookie headers instead of treating them as public identity", async () => {
    const harness = await startHarness();
    try {
      const credentialHeaderSets: Array<Record<string, string>> = [
        { authorization: "Bearer must-not-be-used" },
        { cookie: "session=must-not-be-used" },
      ];
      for (const credentialHeaders of credentialHeaderSets) {
        const headers = new Headers({
          origin: ORIGIN,
          "content-type": "application/json",
          "x-request-id": randomUUID(),
        });
        for (const [name, value] of Object.entries(credentialHeaders)) headers.set(name, value);
        const response = await fetch(`${harness.baseUrl}/api/public/v1/query`, {
          method: "POST",
          headers,
          body: JSON.stringify({ message: "agua", mode: "keyword", limit: 5 }),
        });
        assert.equal(response.status, 400);
      }
      assert.equal(harness.searchRepository.searchCalls.length, 0);
      assert.equal(harness.publicRepository.rateDecisions.length, 4);
    } finally { await stopHarness(harness); }
  });

  it("returns a minimal exact CORS preflight", async () => {
    const harness = await startHarness();
    try {
      const response = await fetch(`${harness.baseUrl}/api/public/v1/query`, {
        method: "OPTIONS",
        headers: {
          origin: ORIGIN,
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type,x-request-id",
        },
      });
      assert.equal(response.status, 204);
      assert.equal(response.headers.get("access-control-allow-origin"), ORIGIN);
      assert.equal(response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
      assert.equal(response.headers.get("access-control-allow-headers"), "content-type, x-request-id");
      assert.equal(response.headers.get("access-control-expose-headers"), "x-request-id, retry-after");
    } finally { await stopHarness(harness); }
  });

  it("rejects tenant, credential, semantic and unknown body fields through the closed contract", async () => {
    const harness = await startHarness();
    try {
      for (const body of [
        { message: "agua", mode: "keyword", limit: 5, tenant_id: TENANT_B },
        { message: "agua", mode: "keyword", limit: 5, credential: "secret" },
        { message: "agua", mode: "semantic", limit: 5 },
        { message: "agua", mode: "keyword", limit: 5, extra: true },
      ]) {
        const response = await postQuery(harness, body);
        assert.equal(response.status, 400);
      }
      assert.equal(harness.searchRepository.searchCalls.length, 0);
    } finally { await stopHarness(harness); }
  });

  it("returns comparative evidence without promoting it to a supported answer", async () => {
    const harness = await startHarness({ candidates: [comparativeCandidate()] });
    try {
      const response = await postQuery(harness);
      assert.equal(response.status, 200);
      const body = await response.json() as PublicQueryResponseV1;
      assert.equal(body.meta.responseLabel, "insufficient_evidence");
      assert.equal(body.meta.confidence, "low");
      assert.equal(body.citations[0]?.evidenceStatus, "comparative_reference");
      assert.match(body.content, /no sostienen una respuesta oficial/i);
    } finally { await stopHarness(harness); }
  });

  it("returns an explicit not-found state with no citations", async () => {
    const harness = await startHarness({ candidates: [] });
    try {
      const response = await postQuery(harness);
      assert.equal(response.status, 200);
      const body = await response.json() as PublicQueryResponseV1;
      assert.equal(body.meta.responseLabel, "not_found");
      assert.equal(body.citations.length, 0);
      assert.match(body.content, /No encontré evidencia documental pública suficiente/);
    } finally { await stopHarness(harness); }
  });

  it("excludes cross-tenant and unsafe signed source URLs", async () => {
    const harness = await startHarness({ candidates: [
      candidate({ sourceUrl: "https://storage.example/object.pdf?X-Goog-Signature=secret" }),
      candidate({
        sourceId: "16161616-1616-4161-8161-161616161616",
        documentId: "17171717-1717-4171-8171-171717171717",
        documentVersionId: "18181818-1818-4181-8181-181818181818",
        sectionId: "19191919-1919-4191-8191-191919191919",
        chunkId: "unsafe-http-source",
        sourceUrl: "http://public.example/document.pdf",
      }),
      candidate({
        tenantId: TENANT_B,
        sourceId: "12121212-1212-4121-8121-121212121212",
        documentId: "13131313-1313-4131-8131-131313131313",
        documentVersionId: "14141414-1414-4141-8141-141414141414",
        sectionId: "15151515-1515-4151-8151-151515151515",
      }),
    ] });
    try {
      const response = await postQuery(harness);
      assert.equal(response.status, 200);
      const body = await response.json() as PublicQueryResponseV1;
      assert.equal(body.citations.length, 0);
      assert.equal(body.meta.responseLabel, "not_found");
    } finally { await stopHarness(harness); }
  });

  it("enforces per-client and global rate limits before retrieval", async () => {
    const harness = await startHarness({ rateLimit: 1, globalRateLimit: 2 });
    try {
      assert.equal((await postQuery(harness, undefined, { userAgent: "client-a" })).status, 200);
      const clientBlocked = await postQuery(harness, undefined, { userAgent: "client-a" });
      assert.equal(clientBlocked.status, 429);
      assert.ok(Number(clientBlocked.headers.get("retry-after")) >= 1);
      const globalBlocked = await postQuery(harness, undefined, { userAgent: "client-b" });
      assert.equal(globalBlocked.status, 429);
      assert.equal(harness.searchRepository.searchCalls.length, 1);
    } finally { await stopHarness(harness); }
  });

  it("stores only client HMACs and minimized audits", async () => {
    const harness = await startHarness();
    try {
      const response = await postQuery(harness, undefined, { userAgent: "private-user-agent-value" });
      assert.equal(response.status, 200);
      assert.ok(harness.publicRepository.rateDecisions.length >= 2);
      assert.ok(harness.publicRepository.rateDecisions.every((decision) => /^[a-f0-9]{64}$/.test(decision.clientKeySha256)));
      const serialized = JSON.stringify(harness.publicRepository);
      assert.doesNotMatch(serialized, /private-user-agent-value|127\.0\.0\.1|requisitos para una solicitud/);
      assert.equal(harness.publicRepository.audits[0]?.eventType, "public.query.succeeded");
    } finally { await stopHarness(harness); }
  });

  it("rejects malformed request identity and non-JSON methods safely", async () => {
    const harness = await startHarness();
    try {
      const malformed = await postQuery(harness, undefined, { requestId: "not-a-uuid" });
      assert.equal(malformed.status, 400);
      const get = await fetch(`${harness.baseUrl}/api/public/v1/query`, { method: "GET", headers: { origin: ORIGIN } });
      assert.equal(get.status, 405);
      const text = await fetch(`${harness.baseUrl}/api/public/v1/query`, {
        method: "POST",
        headers: { origin: ORIGIN, "content-type": "text/plain", "x-request-id": randomUUID() },
        body: "hello",
      });
      assert.equal(text.status, 400);
    } finally { await stopHarness(harness); }
  });
});
