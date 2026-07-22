import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { describe, it } from "node:test";
import type { QueryEmbeddingProvider } from "../embeddings/queryEmbedding.js";
import {
  hashBearerCredential,
  type CredentialPrincipalRecord,
  type IdentityRepository,
  type TenantTransactionClient,
  type TenantTransactionPool,
} from "../security/index.js";
import { createApiServer } from "../server.js";
import {
  InMemorySearchEvidenceRepository,
  loadSearchEvidenceValidators,
  type EvidenceBundleCreateRequestV1,
  type SearchRequestV1,
  type SearchResponseV1,
  type StoredSearchCandidate,
} from "../api/v1/searchEvidenceIndex.js";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const PRINCIPAL_A = "33333333-3333-4333-8333-333333333333";
const CREDENTIAL_A = "44444444-4444-4444-8444-444444444444";
const REQUEST_ID = "55555555-5555-4555-8555-555555555555";
const SECOND_REQUEST_ID = "66666666-6666-4666-8666-666666666666";
const TOKEN = "search-evidence-token-000000000000000000000001";
const IDEMPOTENCY_KEY = "evidence-bundle-request-000001";
const FIXED_TIME = new Date("2026-07-21T23:45:00.000Z");
const TARGET_JURISDICTION = "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala";
const validatorsPromise = loadSearchEvidenceValidators();

class StaticIdentityRepository implements IdentityRepository {
  async authenticateByCredentialHash(digest: string): Promise<CredentialPrincipalRecord | null> {
    if (digest !== hashBearerCredential(TOKEN)) return null;
    return {
      credentialId: CREDENTIAL_A,
      tenantId: TENANT_A,
      principalId: PRINCIPAL_A,
      roles: ["researcher"],
    };
  }
}

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

class StaticQueryEmbeddingProvider implements QueryEmbeddingProvider {
  readonly providerName = "test-provider";
  readonly model = "test-model-v1";
  readonly dimensions = 1536;
  calls = 0;
  async embedQuery(query: string): Promise<number[]> {
    this.calls += 1;
    assert.ok(query.length > 0);
    return Array.from({ length: this.dimensions }, (_, index) => index === 0 ? 1 : 0);
  }
}

class FailingQueryEmbeddingProvider implements QueryEmbeddingProvider {
  readonly providerName = "test-provider";
  readonly model = "test-model-v1";
  readonly dimensions = 1536;
  async embedQuery(): Promise<number[]> {
    throw new Error("provider unavailable");
  }
}

class InspectingQueryEmbeddingProvider implements QueryEmbeddingProvider {
  readonly providerName = "test-provider";
  readonly model = "test-model-v1";
  readonly dimensions = 1536;
  calls = 0;
  constructor(private readonly inspect: () => void) {}
  async embedQuery(): Promise<number[]> {
    this.calls += 1;
    this.inspect();
    return Array.from({ length: this.dimensions }, (_, index) => index === 0 ? 1 : 0);
  }
}

const candidate = (overrides: Partial<StoredSearchCandidate> = {}): StoredSearchCandidate => ({
  tenantId: TENANT_A,
  sourceId: "77777777-7777-4777-8777-777777777777",
  sourceKey: "antigua-water-procedure",
  sourceTitle: "Manual oficial de agua potable",
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
  documentTitle: "Manual oficial de agua potable",
  documentType: "procedure",
  documentScope: "municipal",
  confidentiality: "public",
  documentStatus: "active",
  extractionStatus: "processed",
  sourceUrl: "https://muniantigua.gob.gt/documentos/manual-agua.pdf",
  contentSha256: "a".repeat(64),
  citationLabel: "Manual oficial de agua potable, página 12",
  excerpt: "La unidad municipal recibe la solicitud documental y verifica los requisitos publicados.",
  pageStart: 12,
  pageEnd: 12,
  articleNumber: null,
  keywordScore: 0.87,
  phraseMatched: true,
  semanticScore: 0.93,
  ...overrides,
});

const comparativeCandidate = (): StoredSearchCandidate => candidate({
  sourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  sourceKey: "mixco-water-manual",
  sourceTitle: "Manual de aguas de Mixco",
  sourceRelation: "comparative",
  targetJurisdiction: TARGET_JURISDICTION,
  sourceJurisdiction: "Municipio de Mixco, Guatemala",
  validationState: "validated",
  officialSource: true,
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
  semanticScore: 0.71,
});

interface Harness {
  server: Server;
  baseUrl: string;
  repository: InMemorySearchEvidenceRepository;
  provider: StaticQueryEmbeddingProvider | null;
  transactionPool: StubTransactionPool;
}

const startHarness = async (options: {
  rateLimit?: number;
  provider?: QueryEmbeddingProvider | null;
  candidates?: StoredSearchCandidate[];
} = {}): Promise<Harness> => {
  const repository = new InMemorySearchEvidenceRepository(() => FIXED_TIME);
  for (const item of options.candidates ?? [candidate(), comparativeCandidate(), candidate({
    tenantId: TENANT_B,
    sourceId: "12121212-1212-4121-8121-121212121212",
    documentId: "13131313-1313-4131-8131-131313131313",
    documentVersionId: "14141414-1414-4141-8141-141414141414",
    sectionId: "15151515-1515-4151-8151-151515151515",
    chunkId: "other-tenant",
  })]) repository.seedCandidate(item);
  const transactionPool = new StubTransactionPool();
  const selectedProvider = options.provider === undefined ? new StaticQueryEmbeddingProvider() : options.provider;
  const server = createApiServer({
    evidenceDependencies: { keywordSearch: async () => [], phraseSearch: async () => [] },
    searchEvidenceV1: {
      identityRepository: new StaticIdentityRepository(),
      transactionPool,
      repository,
      validators: validatorsPromise,
      queryEmbeddingProvider: selectedProvider,
      now: () => FIXED_TIME,
      createUuid: randomUUID,
      rateLimit: options.rateLimit ?? 100,
      rateWindowSeconds: 60,
      idempotencyTtlSeconds: 86_400,
    },
    v1CorsAllowedOrigins: ["https://research.example"],
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
    repository,
    provider: selectedProvider instanceof StaticQueryEmbeddingProvider ? selectedProvider : null,
    transactionPool,
  };
};

const stopHarness = async (harness: Harness): Promise<void> => {
  await new Promise<void>((resolve, reject) =>
    harness.server.close((error) => error ? reject(error) : resolve())
  );
};

const filters = () => ({
  document_types: [],
  source_relations: [],
  authority_statuses: [],
  temporal_statuses: [],
  source_ids: [],
});

const searchRequest = (overrides: Partial<SearchRequestV1> = {}): SearchRequestV1 => ({
  schema_version: "v1",
  operation: "search",
  request_id: REQUEST_ID,
  tenant_id: TENANT_A,
  query: "solicitud documental agua potable",
  jurisdiction: TARGET_JURISDICTION,
  as_of_date: "2026-07-21",
  mode: "keyword",
  limit: 10,
  filters: filters(),
  provenance: { credential_id: CREDENTIAL_A },
  ...overrides,
});

const bundleRequest = (overrides: Partial<EvidenceBundleCreateRequestV1> = {}): EvidenceBundleCreateRequestV1 => ({
  ...searchRequest(),
  operation: "evidence_bundle_create",
  ...overrides,
});

const call = async (
  harness: Harness,
  route: "/api/v1/search" | "/api/v1/evidence-bundles",
  body: unknown,
  options: {
    token?: string | null;
    requestId?: string;
    idempotencyKey?: string | null;
    rawBody?: string;
    contentType?: string | null;
    origin?: string;
    method?: "POST" | "OPTIONS";
  } = {}
): Promise<{ response: Response; text: string; json: Record<string, unknown> }> => {
  const method = options.method ?? "POST";
  const headers = new Headers();
  const token = options.token === undefined ? TOKEN : options.token;
  if (token) headers.set("authorization", `Bearer ${token}`);
  headers.set("x-request-id", options.requestId ?? REQUEST_ID);
  if (options.contentType !== null) headers.set("content-type", options.contentType ?? "application/json");
  if (route === "/api/v1/evidence-bundles" && options.idempotencyKey !== null) {
    headers.set("idempotency-key", options.idempotencyKey ?? IDEMPOTENCY_KEY);
  }
  if (options.origin) headers.set("origin", options.origin);
  const response = await fetch(`${harness.baseUrl}${route}`, {
    method,
    headers,
    body: method === "POST" ? options.rawBody ?? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  return { response, text, json: text ? JSON.parse(text) as Record<string, unknown> : {} };
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
};

describe("search and EvidenceBundle API v1", () => {
  it("advertises only POST and authenticates before parsing bodies", async () => {
    const harness = await startHarness();
    try {
      for (const route of ["/api/v1/search", "/api/v1/evidence-bundles"] as const) {
        const preflight = await call(harness, route, {}, {
          method: "OPTIONS",
          origin: "https://research.example",
        });
        assert.equal(preflight.response.status, 204);
        assert.equal(preflight.response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
        const rejected = await call(harness, route, {}, {
          token: null,
          rawBody: "{malformed",
        });
        await assertApiError(rejected, 401, "unauthorized");
      }
      assert.equal(harness.repository.authenticationFailures.length, 2);
      assert.equal(harness.repository.searchCalls.length, 0);
    } finally { await stopHarness(harness); }
  });

  it("binds request, tenant and credential identity and rejects extra fields", async () => {
    const harness = await startHarness();
    try {
      const wrongTenant = searchRequest({ tenant_id: TENANT_B });
      await assertApiError(await call(harness, "/api/v1/search", wrongTenant), 403, "forbidden");
      const wrongCredential = searchRequest({ provenance: { credential_id: "ffffffff-ffff-4fff-8fff-ffffffffffff" } });
      await assertApiError(await call(harness, "/api/v1/search", wrongCredential), 403, "forbidden");
      const extra = { ...searchRequest(), official_source: true };
      await assertApiError(await call(harness, "/api/v1/search", extra), 400, "invalid_request");
      assert.equal(harness.repository.searchCalls.length, 0);
    } finally { await stopHarness(harness); }
  });

  it("returns explicit keyword results with authority, temporal and score semantics", async () => {
    const harness = await startHarness();
    try {
      const result = await call(harness, "/api/v1/search", searchRequest());
      assert.equal(result.response.status, 200);
      const validators = await validatorsPromise;
      assert.equal(validators.searchResponse(result.json), true, JSON.stringify(validators.searchResponse.errors));
      const body = result.json as unknown as SearchResponseV1;
      assert.equal(body.requested_mode, "keyword");
      assert.deepEqual(body.executed_modes, ["keyword"]);
      assert.equal(body.result_count, 2);
      assert.equal(body.results[0]?.authority_status, "official_target_jurisdiction");
      assert.equal(body.results[0]?.temporal_status, "current_by_stored_dates");
      assert.equal(body.results[0]?.evidence_status, "supported");
      assert.equal(body.results[0]?.retrieval.score_type, "ts_rank_cd");
      assert.equal(body.results[1]?.authority_status, "comparative");
      assert.equal(body.results[1]?.evidence_status, "comparative_reference");
      assert.match(body.results[1]?.limitations.join(" ") ?? "", /corrobor/i);
      assert.doesNotMatch(result.text, /object_key|object_namespace|scanner_engine|lease_token|fencing_token|api_key/i);
    } finally { await stopHarness(harness); }
  });

  it("filters signed public URLs before they can enter a response", async () => {
    const harness = await startHarness({ candidates: [
      candidate(),
      comparativeCandidate(),
      candidate({
        sourceId: "16161616-1616-4161-8161-161616161616",
        documentId: "17171717-1717-4171-8171-171717171717",
        documentVersionId: "18181818-1818-4181-8181-181818181818",
        sectionId: "19191919-1919-4191-8191-191919191919",
        chunkId: "signed-url-chunk",
        sourceUrl: "https://example.test/manual.pdf?X-Amz-Signature=do-not-return",
      }),
    ] });
    try {
      const result = await call(harness, "/api/v1/search", searchRequest());
      assert.equal(result.response.status, 200);
      assert.equal(result.json.result_count, 2);
      assert.doesNotMatch(result.text, /X-Amz-Signature|do-not-return/i);
    } finally { await stopHarness(harness); }
  });

  it("applies bounded server-derived filters after authority and temporal classification", async () => {
    const harness = await startHarness();
    try {
      const targetOnly = searchRequest({
        filters: { ...filters(), authority_statuses: ["official_target_jurisdiction"] },
      });
      const result = await call(harness, "/api/v1/search", targetOnly);
      assert.equal(result.response.status, 200);
      assert.equal((result.json.results as unknown[]).length, 1);
      const invalidLimit = searchRequest({ limit: 51 });
      await assertApiError(await call(harness, "/api/v1/search", invalidLimit), 400, "invalid_request");
    } finally { await stopHarness(harness); }
  });

  it("fails closed for semantic and hybrid requests without a usable provider", async () => {
    for (const provider of [null, new FailingQueryEmbeddingProvider()] as const) {
      const harness = await startHarness({ provider });
      try {
        for (const mode of ["semantic", "hybrid"] as const) {
          const request = searchRequest({ mode });
          const result = await call(harness, "/api/v1/search", request);
          await assertApiError(result, 503, "capability_unavailable");
          assert.equal(harness.repository.searchCalls.length, 0);
        }
      } finally { await stopHarness(harness); }
    }
  });

  it("closes the rate transaction before invoking the external embedding provider", async () => {
    let transactionPool: StubTransactionPool | undefined;
    const provider = new InspectingQueryEmbeddingProvider(() => {
      assert.ok(transactionPool);
      assert.equal(transactionPool.releases, 1);
      assert.match(transactionPool.calls.at(-1)?.sql ?? "", /^COMMIT$/i);
    });
    const harness = await startHarness({ provider });
    transactionPool = harness.transactionPool;
    try {
      const result = await call(harness, "/api/v1/search", searchRequest({ mode: "semantic" }));
      assert.equal(result.response.status, 200);
      assert.equal(provider.calls, 1);
      assert.ok(transactionPool.releases >= 2);
    } finally { await stopHarness(harness); }
  });

  it("executes semantic and hybrid retrieval without claiming lexical-only fallback", async () => {
    const harness = await startHarness();
    try {
      const semantic = await call(harness, "/api/v1/search", searchRequest({ mode: "semantic" }));
      assert.equal(semantic.response.status, 200);
      assert.deepEqual(semantic.json.executed_modes, ["semantic"]);
      const semanticResults = semantic.json.results as Array<{ retrieval: { score_type: string; matched_modes: string[] } }>;
      assert.equal(semanticResults[0]?.retrieval.score_type, "cosine_similarity");
      assert.deepEqual(semanticResults[0]?.retrieval.matched_modes, ["semantic"]);
      const hybrid = await call(harness, "/api/v1/search", searchRequest({ mode: "hybrid" }));
      assert.equal(hybrid.response.status, 200);
      assert.deepEqual(hybrid.json.executed_modes, ["keyword", "phrase", "semantic"]);
      const hybridResults = hybrid.json.results as Array<{ retrieval: { score_type: string; matched_modes: string[] } }>;
      assert.equal(hybridResults[0]?.retrieval.score_type, "reciprocal_rank_fusion");
      assert.ok(hybridResults[0]?.retrieval.matched_modes.includes("semantic"));
      assert.ok((harness.provider?.calls ?? 0) >= 2);
    } finally { await stopHarness(harness); }
  });

  it("deduplicates citation identity and clamps negative semantic similarity", async () => {
    const harness = await startHarness({ candidates: [
      candidate({ semanticScore: -0.4 }),
      candidate({ keywordScore: 0.5, semanticScore: -0.2 }),
    ] });
    try {
      const keyword = await call(harness, "/api/v1/search", searchRequest());
      assert.equal(keyword.response.status, 200);
      assert.equal(keyword.json.result_count, 1);
      const semantic = await call(harness, "/api/v1/search", searchRequest({ mode: "semantic" }));
      assert.equal(semantic.response.status, 200);
      assert.equal(semantic.json.result_count, 1);
      const results = semantic.json.results as Array<{ retrieval: { score: number } }>;
      assert.equal(results[0]?.retrieval.score, 0);
    } finally { await stopHarness(harness); }
  });

  it("creates an exact-replay EvidenceBundle without promoting comparative evidence", async () => {
    const harness = await startHarness();
    try {
      const request = bundleRequest();
      const created = await call(harness, "/api/v1/evidence-bundles", request);
      assert.equal(created.response.status, 200);
      const validators = await validatorsPromise;
      assert.equal(validators.evidenceBundle(created.json), true, JSON.stringify(validators.evidenceBundle.errors));
      const claims = created.json.claims as Array<{ text: string; evidence_status: string; citation_refs: string[] }>;
      const citations = created.json.citations as Array<{ evidence_status: string; source_id: string }>;
      assert.equal(claims.length, 1);
      assert.equal(claims[0]?.text, candidate().excerpt);
      assert.equal(claims[0]?.evidence_status, "supported");
      assert.equal(citations.length, 2);
      assert.ok(citations.some((item) => item.evidence_status === "comparative_reference"));
      assert.equal(claims.some((claim) => claim.evidence_status === "comparative_reference"), false);
      const replay = await call(harness, "/api/v1/evidence-bundles", request);
      assert.equal(replay.text, created.text);
      const changed = bundleRequest({ query: "consulta diferente" });
      await assertApiError(
        await call(harness, "/api/v1/evidence-bundles", changed),
        409,
        "idempotency_conflict"
      );
    } finally { await stopHarness(harness); }
  });

  it("rejects a hash-valid replay that promotes comparative evidence to a claim", async () => {
    const harness = await startHarness();
    try {
      const request = bundleRequest();
      const created = await call(harness, "/api/v1/evidence-bundles", request);
      assert.equal(created.response.status, 200);
      const entry = [...harness.repository.idempotency.values()][0];
      assert.ok(entry && entry.responseBody);
      const corrupted = JSON.parse(entry.responseBody) as {
        claims: Array<Record<string, unknown>>;
        citations: Array<Record<string, unknown>>;
      };
      const comparativeCitation = corrupted.citations.find(
        (citation) => citation.evidence_status === "comparative_reference"
      );
      assert.ok(comparativeCitation);
      corrupted.claims.push({
        claim_id: randomUUID(),
        text: comparativeCitation.excerpt,
        citation_refs: [comparativeCitation.citation_id],
        evidence_status: "comparative_reference",
        limitations: ["Corrupted replay must not promote this reference."],
      });
      entry.responseBody = JSON.stringify(corrupted);
      entry.responseSha256 = createHash("sha256").update(entry.responseBody).digest("hex");
      const rejected = await call(harness, "/api/v1/evidence-bundles", request);
      await assertApiError(rejected, 500, "replay_invalid");
      assert.equal(harness.repository.idempotency.size, 0);
    } finally { await stopHarness(harness); }
  });

  it("replays a semantic EvidenceBundle without calling the provider again", async () => {
    const provider = new StaticQueryEmbeddingProvider();
    const harness = await startHarness({ provider });
    try {
      const request = bundleRequest({ mode: "semantic" });
      const created = await call(harness, "/api/v1/evidence-bundles", request);
      assert.equal(created.response.status, 200);
      assert.equal(provider.calls, 1);
      const replay = await call(harness, "/api/v1/evidence-bundles", request);
      assert.equal(replay.response.status, 200);
      assert.equal(replay.text, created.text);
      assert.equal(provider.calls, 1);
    } finally { await stopHarness(harness); }
  });

  it("returns explicit missing evidence when no supported candidate exists", async () => {
    const harness = await startHarness({ candidates: [comparativeCandidate()] });
    try {
      const created = await call(harness, "/api/v1/evidence-bundles", bundleRequest());
      assert.equal(created.response.status, 200);
      assert.deepEqual(created.json.claims, []);
      assert.ok((created.json.citations as unknown[]).length === 1);
      assert.ok((created.json.missing_evidence as unknown[]).length >= 1);
      assert.match(JSON.stringify(created.json.missing_evidence), /fuente oficial|corrobor/i);
    } finally { await stopHarness(harness); }
  });

  it("commits corrupt replay cleanup before returning a generic error", async () => {
    const harness = await startHarness();
    try {
      const request = bundleRequest();
      const created = await call(harness, "/api/v1/evidence-bundles", request);
      assert.equal(created.response.status, 200);
      const entry = [...harness.repository.idempotency.values()][0];
      assert.ok(entry && entry.responseBody);
      const corrupted = JSON.parse(entry.responseBody) as Record<string, unknown>;
      corrupted.tenant_id = TENANT_B;
      entry.responseBody = JSON.stringify(corrupted);
      entry.responseSha256 = createHash("sha256").update(entry.responseBody).digest("hex");
      const rejected = await call(harness, "/api/v1/evidence-bundles", request);
      await assertApiError(rejected, 500, "replay_invalid");
      assert.equal(harness.repository.idempotency.size, 0);
      const regenerated = await call(harness, "/api/v1/evidence-bundles", request);
      assert.equal(regenerated.response.status, 200);
      assert.notEqual(regenerated.text, entry.responseBody);
    } finally { await stopHarness(harness); }
  });

  it("applies one bounded authenticated rate gate to both endpoints", async () => {
    const harness = await startHarness({ rateLimit: 1 });
    try {
      assert.equal((await call(harness, "/api/v1/search", searchRequest())).response.status, 200);
      const blockedSearch = await call(harness, "/api/v1/search", searchRequest());
      await assertApiError(blockedSearch, 429, "rate_limit_exceeded");
      assert.equal(blockedSearch.response.headers.get("retry-after") !== null, true);
      assert.equal((await call(harness, "/api/v1/evidence-bundles", bundleRequest())).response.status, 200);
      const blockedBundle = await call(harness, "/api/v1/evidence-bundles", bundleRequest());
      await assertApiError(blockedBundle, 429, "rate_limit_exceeded");
      assert.equal(harness.repository.audits.filter((audit) => audit.reasonCode === "rate_limit_exceeded").length, 2);
    } finally { await stopHarness(harness); }
  });
});
