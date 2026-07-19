import type { EmbeddingProvider, EmbeddingVectorRecord } from "../embeddings/types.js";
import {
  MAX_CHUNKS_PER_DOCUMENT,
  MAX_EMBEDDING_BATCH_SIZE,
  prepareDocumentEmbeddings,
} from "../embeddings/indexer.js";
import { extractByPath } from "./registry.js";
import type { ExtractorInput, NormalizedDocument } from "./types.js";
import { IngestionError } from "./types.js";
import {
  INGESTION_LEASE_LIMITS,
} from "./ingestionJobService.js";
import {
  IngestionJobError,
  type CompleteIngestionJobResult,
  type DurableIngestionJob,
  type HeartbeatIngestionJobInput,
  type LeasedIngestionJob,
} from "./jobTypes.js";
import {
  AcceptedArtifactError,
  artifactSha256,
  verifyAcceptedArtifact,
  type AcceptedArtifact,
  type AcceptedArtifactResolver,
  type VerifyAcceptedArtifactOptions,
} from "./acceptedArtifact.js";

const SAFE_ERROR_CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const SUPPORTED_EXTRACTOR_NAME = "bounded_document_registry";
const SUPPORTED_EXTRACTOR_VERSION = "1.0.0";

export interface IngestionWorkerJobService {
  leaseNext(
    tenantId: string,
    workerId: string,
    leaseDurationSeconds?: number
  ): Promise<LeasedIngestionJob | null>;
  heartbeat(input: HeartbeatIngestionJobInput): Promise<DurableIngestionJob>;
  complete(input: {
    tenantId: string;
    jobId: string;
    leaseToken: string;
    artifactSha256: string;
    records: EmbeddingVectorRecord[];
  }): Promise<CompleteIngestionJobResult>;
  fail(input: {
    tenantId: string;
    jobId: string;
    leaseToken: string;
    errorCode: string;
    retryable: boolean;
    retryDelaySeconds?: number;
  }): Promise<DurableIngestionJob>;
}

export type IngestionWorkerResult =
  | { kind: "idle" }
  | {
      kind: "processed";
      jobId: string;
      chunkCount: number;
      insertedCount: number;
      updatedCount: number;
      unchangedCount: number;
      deletedCount: number;
    }
  | { kind: "retry_scheduled" | "failed"; jobId: string; errorCode: string }
  | { kind: "lease_lost"; jobId: string };

export interface IngestionWorkerScheduler {
  setInterval(callback: () => void, intervalMs: number): ReturnType<typeof setInterval>;
  clearInterval(handle: ReturnType<typeof setInterval>): void;
}

export interface TenantIngestionWorkerOptions extends VerifyAcceptedArtifactOptions {
  tenantId: string;
  workerId: string;
  leaseDurationSeconds?: number;
  heartbeatIntervalMs?: number;
  scheduler?: IngestionWorkerScheduler;
  extract?: (
    sourcePath: string,
    input: Omit<ExtractorInput, "sourcePath">
  ) => Promise<NormalizedDocument> | NormalizedDocument;
}

interface ClassifiedWorkerFailure {
  code: string;
  retryable: boolean;
}

const defaultScheduler: IngestionWorkerScheduler = {
  setInterval: (callback, intervalMs) => setInterval(callback, intervalMs),
  clearInterval: (handle) => clearInterval(handle),
};

const boundedHeartbeatInterval = (
  leaseDurationSeconds: number,
  configured?: number
): number => {
  const maximum = Math.max(1_000, Math.floor((leaseDurationSeconds * 1_000) / 3));
  const value = configured ?? Math.min(30_000, maximum);
  if (!Number.isSafeInteger(value) || value < 1_000 || value > maximum) {
    throw new Error(`heartbeatIntervalMs must be between 1000 and ${maximum}`);
  }
  return value;
};

const classifyFailure = (error: unknown): ClassifiedWorkerFailure => {
  if (error instanceof AcceptedArtifactError) {
    return { code: error.code, retryable: error.retryable };
  }
  if (error instanceof IngestionError) {
    return { code: error.code, retryable: error.retryable };
  }
  if (error instanceof IngestionJobError) {
    return {
      code: error.code === "ingestion_lease_rejected" ? "ingestion_lease_lost" : error.code,
      retryable: error.retryable,
    };
  }
  return { code: "ingestion_worker_failed", retryable: true };
};

const safeFailure = (failure: ClassifiedWorkerFailure): ClassifiedWorkerFailure => ({
  code: SAFE_ERROR_CODE_PATTERN.test(failure.code) ? failure.code : "ingestion_worker_failed",
  retryable: failure.retryable,
});

const assertPipelineMatchesProvider = (
  job: DurableIngestionJob,
  provider: EmbeddingProvider
): void => {
  const { extractor, embedding } = job.pipelineConfig;
  if (
    extractor.name !== SUPPORTED_EXTRACTOR_NAME ||
    extractor.version !== SUPPORTED_EXTRACTOR_VERSION ||
    embedding.provider !== provider.providerName ||
    embedding.model !== provider.model ||
    embedding.dimension !== provider.dimensions
  ) {
    throw new IngestionJobError(
      "ingestion_pipeline_profile_mismatch",
      "Leased job does not match the configured worker pipeline."
    );
  }
};

class LeaseHeartbeat {
  private timer: ReturnType<typeof setInterval> | null = null;
  private inFlight: Promise<void> | null = null;
  private failure: unknown = null;

  constructor(
    private readonly service: IngestionWorkerJobService,
    private readonly lease: LeasedIngestionJob,
    private readonly leaseDurationSeconds: number,
    private readonly intervalMs: number,
    private readonly scheduler: IngestionWorkerScheduler
  ) {}

  start(): void {
    this.timer = this.scheduler.setInterval(() => {
      void this.beat();
    }, this.intervalMs);
  }

  private beat(): Promise<void> {
    if (this.failure) return Promise.resolve();
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.service.heartbeat({
      tenantId: this.lease.job.tenantId,
      jobId: this.lease.job.jobId,
      leaseToken: this.lease.leaseToken,
      leaseDurationSeconds: this.leaseDurationSeconds,
    }).then(
      () => undefined,
      (error: unknown) => {
        this.failure = error;
      }
    ).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  async checkpoint(): Promise<void> {
    await this.beat();
    if (this.failure) {
      throw new IngestionJobError(
        "ingestion_lease_rejected",
        "Worker lease heartbeat failed.",
        false,
        { cause: this.failure }
      );
    }
  }

  async stop(): Promise<void> {
    if (this.timer) {
      this.scheduler.clearInterval(this.timer);
      this.timer = null;
    }
    await this.inFlight;
  }
}

export class TenantIngestionWorker {
  private readonly leaseDurationSeconds: number;
  private readonly heartbeatIntervalMs: number;
  private readonly scheduler: IngestionWorkerScheduler;
  private readonly extract: NonNullable<TenantIngestionWorkerOptions["extract"]>;

  constructor(
    private readonly service: IngestionWorkerJobService,
    private readonly artifactResolver: AcceptedArtifactResolver,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly options: TenantIngestionWorkerOptions
  ) {
    this.leaseDurationSeconds = options.leaseDurationSeconds ?? INGESTION_LEASE_LIMITS.defaultSeconds;
    if (
      !Number.isSafeInteger(this.leaseDurationSeconds) ||
      this.leaseDurationSeconds < INGESTION_LEASE_LIMITS.minimumSeconds ||
      this.leaseDurationSeconds > INGESTION_LEASE_LIMITS.maximumSeconds
    ) {
      throw new Error("Worker lease duration is outside the ingestion service limits.");
    }
    this.heartbeatIntervalMs = boundedHeartbeatInterval(
      this.leaseDurationSeconds,
      options.heartbeatIntervalMs
    );
    this.scheduler = options.scheduler ?? defaultScheduler;
    this.extract = options.extract ?? extractByPath;
  }

  private verify(
    lease: LeasedIngestionJob,
    artifact: AcceptedArtifact
  ): AcceptedArtifact {
    return verifyAcceptedArtifact({
      tenantId: lease.job.tenantId,
      documentVersionId: lease.job.documentVersionId,
      artifactSha256: lease.job.artifactSha256,
    }, artifact, {
      now: this.options.now,
      policy: this.options.policy,
      env: this.options.env,
    });
  }

  async runOnce(): Promise<IngestionWorkerResult> {
    const lease = await this.service.leaseNext(
      this.options.tenantId,
      this.options.workerId,
      this.leaseDurationSeconds
    );
    if (!lease) return { kind: "idle" };

    const heartbeat = new LeaseHeartbeat(
      this.service,
      lease,
      this.leaseDurationSeconds,
      this.heartbeatIntervalMs,
      this.scheduler
    );
    heartbeat.start();
    try {
      assertPipelineMatchesProvider(lease.job, this.embeddingProvider);
      const artifact = this.verify(
        lease,
        await this.artifactResolver.resolveAcceptedArtifact({
          tenantId: lease.job.tenantId,
          documentVersionId: lease.job.documentVersionId,
          artifactSha256: lease.job.artifactSha256,
        })
      );
      await heartbeat.checkpoint();
      const document = await this.extract(artifact.originalFilename, {
        title: artifact.originalFilename,
        content: artifact.content,
        metadata: {
          sourceFormat: "accepted_artifact_v1",
        },
      });
      if (artifactSha256(artifact.content) !== lease.job.artifactSha256) {
        throw new AcceptedArtifactError(
          "artifact_changed_during_extraction",
          "Accepted artifact bytes changed during extraction."
        );
      }
      await heartbeat.checkpoint();
      const prepared = await prepareDocumentEmbeddings(
        document,
        {
          documentKey: lease.job.documentVersionId,
          documentVersion: "accepted-v1",
        },
        this.embeddingProvider,
        {
          chunkPlannerOptions: {
            maxChars: lease.job.pipelineConfig.chunkPlanner.maxChars,
            overlapChars: lease.job.pipelineConfig.chunkPlanner.overlapChars,
          },
          maxChunksPerDocument: MAX_CHUNKS_PER_DOCUMENT,
          embeddingBatchSize: MAX_EMBEDDING_BATCH_SIZE,
          now: this.options.now,
        }
      );
      if (prepared.failures.length > 0) {
        const first = prepared.failures[0];
        throw new IngestionError(
          SAFE_ERROR_CODE_PATTERN.test(first?.code ?? "") ? first!.code : "embedding_failed",
          document.sourceFormat,
          "Embedding preparation failed.",
          { retryable: first?.retryable ?? true }
        );
      }
      await heartbeat.checkpoint();
      await heartbeat.stop();
      const completed = await this.service.complete({
        tenantId: lease.job.tenantId,
        jobId: lease.job.jobId,
        leaseToken: lease.leaseToken,
        artifactSha256: lease.job.artifactSha256,
        records: prepared.records,
      });
      return {
        kind: "processed",
        jobId: completed.job.jobId,
        chunkCount: prepared.records.length,
        insertedCount: completed.vectors.insertedCount,
        updatedCount: completed.vectors.updatedCount,
        unchangedCount: completed.vectors.unchangedCount,
        deletedCount: completed.vectors.deletedCount,
      };
    } catch (error) {
      await heartbeat.stop();
      const failure = safeFailure(classifyFailure(error));
      if (failure.code === "ingestion_lease_lost") {
        return { kind: "lease_lost", jobId: lease.job.jobId };
      }
      try {
        const updated = await this.service.fail({
          tenantId: lease.job.tenantId,
          jobId: lease.job.jobId,
          leaseToken: lease.leaseToken,
          errorCode: failure.code,
          retryable: failure.retryable,
        });
        return {
          kind: updated.status === "queued" ? "retry_scheduled" : "failed",
          jobId: updated.jobId,
          errorCode: failure.code,
        };
      } catch (failureError) {
        if (
          failureError instanceof IngestionJobError &&
          failureError.code === "ingestion_lease_rejected"
        ) {
          return { kind: "lease_lost", jobId: lease.job.jobId };
        }
        throw failureError;
      }
    } finally {
      await heartbeat.stop();
    }
  }
}
