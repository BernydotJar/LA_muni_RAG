import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_VECTOR_DIMENSION } from "../embeddings/pgVectorRepository.js";
import type { EmbeddingProvider } from "../embeddings/types.js";
import {
  artifactSha256,
  type AcceptedArtifact,
  type AcceptedArtifactRequest,
  type AcceptedArtifactResolver,
} from "../ingestion/acceptedArtifact.js";
import {
  TenantIngestionWorker,
  type IngestionWorkerJobService,
  type IngestionWorkerScheduler,
} from "../ingestion/ingestionWorker.js";
import type {
  CompleteIngestionJobResult,
  DurableIngestionJob,
  HeartbeatIngestionJobInput,
  LeasedIngestionJob,
} from "../ingestion/jobTypes.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const PRINCIPAL_ID = "33333333-3333-4333-8333-333333333333";
const VERSION_ID = "aaaaaaaa-0000-4000-8000-000000000106";
const JOB_ID = "88888888-8888-4888-8888-888888888888";
const FIXED_TIME = new Date("2026-07-19T21:00:00.000Z");
const CONTENT = Buffer.from("Procedimiento municipal verificado para pruebas.", "utf8");
const DIGEST = artifactSha256(CONTENT);

const job = (overrides: Partial<DurableIngestionJob> = {}): DurableIngestionJob => ({
  jobId: JOB_ID,
  tenantId: TENANT_ID,
  principalId: PRINCIPAL_ID,
  documentVersionId: VERSION_ID,
  artifactSha256: DIGEST,
  status: "processing",
  attemptCount: 1,
  maxAttempts: 3,
  availableAt: FIXED_TIME.toISOString(),
  startedAt: FIXED_TIME.toISOString(),
  finishedAt: null,
  leaseExpiresAt: new Date(FIXED_TIME.getTime() + 120_000).toISOString(),
  heartbeatAt: FIXED_TIME.toISOString(),
  lastErrorCode: null,
  lastErrorRetryable: null,
  pipelineConfig: {
    contractVersion: "v1",
    extractor: { name: "bounded_document_registry", version: "1.0.0" },
    chunkPlanner: { name: "section_text_v1", maxChars: 1_800, overlapChars: 180 },
    embedding: {
      provider: "test-provider",
      model: "test-model-v1",
      dimension: DEFAULT_VECTOR_DIMENSION,
    },
  },
  createdAt: FIXED_TIME.toISOString(),
  updatedAt: FIXED_TIME.toISOString(),
  ...overrides,
});

const artifact = (overrides: Partial<AcceptedArtifact> = {}): AcceptedArtifact => ({
  tenantId: TENANT_ID,
  documentVersionId: VERSION_ID,
  artifactSha256: DIGEST,
  objectVersion: "object-generation-000001",
  originalFilename: "manual.txt",
  mediaType: "text/plain",
  content: Buffer.from(CONTENT),
  safety: {
    verdict: "clean",
    contentSha256: DIGEST,
    byteLength: CONTENT.byteLength,
    detectedMediaType: "text/plain",
    structuralSignature: "utf8-text-v1",
    inspectedAt: FIXED_TIME.toISOString(),
    scannerEngine: "clamav",
    scannerEngineVersion: "1.4.3",
    scannerDefinitionsVersion: "20260719.1",
  },
  ...overrides,
});

class StubResolver implements AcceptedArtifactResolver {
  readonly requests: AcceptedArtifactRequest[] = [];

  constructor(public result: AcceptedArtifact = artifact(), public error: Error | null = null) {}

  async resolveAcceptedArtifact(request: AcceptedArtifactRequest): Promise<AcceptedArtifact> {
    this.requests.push(structuredClone(request));
    if (this.error) throw this.error;
    return this.result;
  }
}

class StubWorkerService implements IngestionWorkerJobService {
  lease: LeasedIngestionJob | null = { job: job(), leaseToken: "l".repeat(43) };
  heartbeatInputs: HeartbeatIngestionJobInput[] = [];
  completeInputs: Array<{
    tenantId: string;
    jobId: string;
    leaseToken: string;
    artifactSha256: string;
    records: unknown[];
  }> = [];
  failInputs: Array<{
    tenantId: string;
    jobId: string;
    leaseToken: string;
    errorCode: string;
    retryable: boolean;
  }> = [];
  heartbeatError: Error | null = null;
  failStatus: DurableIngestionJob["status"] = "failed";

  async leaseNext(): Promise<LeasedIngestionJob | null> {
    return this.lease;
  }

  async heartbeat(input: HeartbeatIngestionJobInput): Promise<DurableIngestionJob> {
    this.heartbeatInputs.push(structuredClone(input));
    if (this.heartbeatError) throw this.heartbeatError;
    return this.lease!.job;
  }

  async complete(input: {
    tenantId: string;
    jobId: string;
    leaseToken: string;
    artifactSha256: string;
    records: never[];
  }): Promise<CompleteIngestionJobResult> {
    this.completeInputs.push(structuredClone(input));
    return {
      job: job({ status: "processed", finishedAt: FIXED_TIME.toISOString() }),
      vectors: {
        insertedCount: input.records.length,
        updatedCount: 0,
        unchangedCount: 0,
        deletedCount: 0,
      },
    };
  }

  async fail(input: {
    tenantId: string;
    jobId: string;
    leaseToken: string;
    errorCode: string;
    retryable: boolean;
  }): Promise<DurableIngestionJob> {
    this.failInputs.push(structuredClone(input));
    return job({
      status: this.failStatus,
      lastErrorCode: input.errorCode,
      lastErrorRetryable: input.retryable,
    });
  }
}

const provider = (embed?: EmbeddingProvider["embed"]): EmbeddingProvider => ({
  providerName: "test-provider",
  model: "test-model-v1",
  dimensions: DEFAULT_VECTOR_DIMENSION,
  embed: embed ?? (async (texts) => texts.map(() => Array(DEFAULT_VECTOR_DIMENSION).fill(0.01))),
});

const inertScheduler: IngestionWorkerScheduler = {
  setInterval: () => 1 as unknown as ReturnType<typeof setInterval>,
  clearInterval: () => undefined,
};

const worker = (
  service: StubWorkerService,
  resolver: StubResolver,
  embeddingProvider: EmbeddingProvider = provider(),
  overrides: Partial<ConstructorParameters<typeof TenantIngestionWorker>[3]> = {}
) => new TenantIngestionWorker(service, resolver, embeddingProvider, {
  tenantId: TENANT_ID,
  workerId: "synthetic-worker-1",
  leaseDurationSeconds: 120,
  heartbeatIntervalMs: 30_000,
  scheduler: inertScheduler,
  now: () => FIXED_TIME,
  policy: {
    maxArtifactBytes: 1024 * 1024,
    malwareScanMaxAgeMs: 24 * 60 * 60 * 1000,
    malwareScanTimeoutMs: 120_000,
  },
  ...overrides,
});

describe("tenant ingestion worker", () => {
  it("returns idle without resolving storage or invoking provider work", async () => {
    const service = new StubWorkerService();
    service.lease = null;
    const resolver = new StubResolver();
    let providerCalls = 0;
    const result = await worker(service, resolver, provider(async () => {
      providerCalls += 1;
      return [];
    })).runOnce();
    assert.deepEqual(result, { kind: "idle" });
    assert.equal(resolver.requests.length, 0);
    assert.equal(providerCalls, 0);
  });

  it("verifies immutable clean bytes, heartbeats, embeds outside DB, and completes without exposing its lease", async () => {
    const service = new StubWorkerService();
    const resolver = new StubResolver();
    const result = await worker(service, resolver).runOnce();
    assert.equal(result.kind, "processed");
    assert.equal(resolver.requests[0]?.artifactSha256, DIGEST);
    assert.ok(service.heartbeatInputs.length >= 3);
    assert.equal(service.completeInputs.length, 1);
    assert.equal(service.completeInputs[0]?.artifactSha256, DIGEST);
    assert.ok((service.completeInputs[0]?.records.length ?? 0) > 0);
    assert.equal(service.failInputs.length, 0);
    assert.doesNotMatch(JSON.stringify(result), /lease|llll/i);
  });

  it("fails closed before parser/provider work when scan evidence is stale or mismatched", async () => {
    const service = new StubWorkerService();
    const stale = artifact({
      safety: {
        ...artifact().safety,
        inspectedAt: new Date(FIXED_TIME.getTime() - 48 * 60 * 60 * 1000).toISOString(),
      },
    });
    const resolver = new StubResolver(stale);
    let extracted = 0;
    let embedded = 0;
    const result = await worker(service, resolver, provider(async () => {
      embedded += 1;
      return [];
    }), {
      extract: () => {
        extracted += 1;
        throw new Error("must not run");
      },
    }).runOnce();
    assert.deepEqual(result, {
      kind: "failed",
      jobId: JOB_ID,
      errorCode: "artifact_safety_evidence_invalid",
    });
    assert.equal(extracted, 0);
    assert.equal(embedded, 0);
    assert.equal(service.completeInputs.length, 0);
    assert.equal(service.failInputs[0]?.retryable, false);
  });

  it("enforces the artifact byte ceiling before parser/provider work", async () => {
    const service = new StubWorkerService();
    const resolver = new StubResolver();
    let extracted = 0;
    let embedded = 0;
    const result = await worker(service, resolver, provider(async () => {
      embedded += 1;
      return [];
    }), {
      policy: {
        maxArtifactBytes: CONTENT.byteLength - 1,
        malwareScanMaxAgeMs: 24 * 60 * 60 * 1000,
        malwareScanTimeoutMs: 120_000,
      },
      extract: () => {
        extracted += 1;
        throw new Error("must not run");
      },
    }).runOnce();
    assert.deepEqual(result, {
      kind: "failed",
      jobId: JOB_ID,
      errorCode: "artifact_structural_verification_failed",
    });
    assert.equal(extracted, 0);
    assert.equal(embedded, 0);
  });

  it("rejects unbounded media metadata and invalid safety policy", async () => {
    const invalidMediaService = new StubWorkerService();
    const invalidMedia = await worker(
      invalidMediaService,
      new StubResolver(artifact({ mediaType: "text/plain\nunsafe" }))
    ).runOnce();
    assert.deepEqual(invalidMedia, {
      kind: "failed",
      jobId: JOB_ID,
      errorCode: "artifact_media_type_invalid",
    });

    const invalidPolicyService = new StubWorkerService();
    const invalidPolicy = await worker(
      invalidPolicyService,
      new StubResolver(),
      provider(),
      {
        policy: {
          maxArtifactBytes: 0,
          malwareScanMaxAgeMs: 1,
          malwareScanTimeoutMs: 1,
        },
      }
    ).runOnce();
    assert.deepEqual(invalidPolicy, {
      kind: "failed",
      jobId: JOB_ID,
      errorCode: "artifact_safety_policy_invalid",
    });
  });

  it("detects a parser-side byte mutation before embedding or completion", async () => {
    const service = new StubWorkerService();
    const resolver = new StubResolver();
    let providerCalls = 0;
    const result = await worker(service, resolver, provider(async () => {
      providerCalls += 1;
      return [];
    }), {
      extract: (_path, input) => {
        assert.ok(Buffer.isBuffer(input.content));
        input.content[0] = 0x58;
        return {
          title: "mutated",
          sourceFormat: "txt",
          text: "mutated",
          sections: [],
          metadata: {},
        };
      },
    }).runOnce();
    assert.deepEqual(result, {
      kind: "failed",
      jobId: JOB_ID,
      errorCode: "artifact_changed_during_extraction",
    });
    assert.equal(providerCalls, 0);
    assert.equal(service.completeInputs.length, 0);
    assert.equal(resolver.result.content[0], CONTENT[0]);
  });

  it("schedules a bounded retry for provider failures", async () => {
    const service = new StubWorkerService();
    service.failStatus = "queued";
    const resolver = new StubResolver();
    const result = await worker(service, resolver, provider(async () => {
      throw new Error("provider secret detail must not persist");
    })).runOnce();
    assert.deepEqual(result, {
      kind: "retry_scheduled",
      jobId: JOB_ID,
      errorCode: "embedding_pipeline_failed",
    });
    assert.deepEqual(service.failInputs[0], {
      tenantId: TENANT_ID,
      jobId: JOB_ID,
      leaseToken: "l".repeat(43),
      errorCode: "embedding_pipeline_failed",
      retryable: true,
    });
    assert.equal(JSON.stringify(service.failInputs).includes("provider secret"), false);
  });

  it("abandons work without finalization when heartbeat fencing reports a lost lease", async () => {
    const service = new StubWorkerService();
    service.heartbeatError = new Error("lease was reclaimed");
    const resolver = new StubResolver();
    const result = await worker(service, resolver).runOnce();
    assert.deepEqual(result, { kind: "lease_lost", jobId: JOB_ID });
    assert.equal(service.completeInputs.length, 0);
    assert.equal(service.failInputs.length, 0);
  });

  it("rejects jobs whose server-owned pipeline does not match the worker", async () => {
    const service = new StubWorkerService();
    service.lease = {
      job: job({
        pipelineConfig: {
          ...job().pipelineConfig,
          embedding: {
            provider: "other-provider",
            model: "other-model",
            dimension: DEFAULT_VECTOR_DIMENSION,
          },
        },
      }),
      leaseToken: "l".repeat(43),
    };
    const resolver = new StubResolver();
    const result = await worker(service, resolver).runOnce();
    assert.deepEqual(result, {
      kind: "failed",
      jobId: JOB_ID,
      errorCode: "ingestion_pipeline_profile_mismatch",
    });
    assert.equal(resolver.requests.length, 0);
    assert.equal(service.completeInputs.length, 0);
  });
});
