import type { EmbeddingVectorRecord } from "../embeddings/types.js";
import type { TenantVectorReplaceResult } from "../embeddings/tenantPgVectorRepository.js";

export const INGESTION_JOB_TYPE = "document_vector_index_v1" as const;

export type DurableIngestionJobStatus =
  | "queued"
  | "processing"
  | "processed"
  | "failed"
  | "superseded";

export interface IngestionPipelineConfigV1 {
  contractVersion: "v1";
  extractor: {
    name: string;
    version: string;
  };
  chunkPlanner: {
    name: "section_text_v1";
    maxChars: number;
    overlapChars: number;
  };
  embedding: {
    provider: string;
    model: string;
    dimension: number;
  };
}

export interface EnqueueIngestionJobInput {
  tenantId: string;
  principalId: string;
  documentVersionId: string;
  artifactSha256: string;
  idempotencyKey: string;
  pipelineConfig: IngestionPipelineConfigV1;
  maxAttempts?: number;
}

export interface IngestionJobIdentity {
  idempotencyKeySha256: string;
  requestSha256: string;
  artifactSha256: string;
  pipelineConfigSha256: string;
  workSha256: string;
  canonicalPipelineConfig: string;
  maxAttempts: number;
}

export interface DurableIngestionJob {
  jobId: string;
  tenantId: string;
  principalId: string;
  documentVersionId: string;
  /** Accepted raw-artifact identity; safe to return to the trusted worker. */
  artifactSha256: string;
  /** Exact persisted acceptance rows. Null until a current clean object is leased. */
  artifactObjectId: string | null;
  artifactScanId: string | null;
  status: DurableIngestionJobStatus;
  attemptCount: number;
  maxAttempts: number;
  availableAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  leaseExpiresAt: string | null;
  heartbeatAt: string | null;
  lastErrorCode: string | null;
  lastErrorRetryable: boolean | null;
  pipelineConfig: IngestionPipelineConfigV1;
  createdAt: string;
  updatedAt: string;
}

export type EnqueueIngestionJobResult =
  | { kind: "new" | "replay" | "duplicate_work"; job: DurableIngestionJob }
  | { kind: "conflict" };

export interface LeasedIngestionJob {
  job: DurableIngestionJob;
  leaseToken: string;
}

export interface CompleteIngestionJobInput {
  tenantId: string;
  jobId: string;
  leaseToken: string;
  artifactSha256: string;
  artifactObjectId: string;
  artifactScanId: string;
  records: EmbeddingVectorRecord[];
}

export interface CompleteIngestionJobResult {
  job: DurableIngestionJob;
  vectors: TenantVectorReplaceResult;
}

export interface FailIngestionJobInput {
  tenantId: string;
  jobId: string;
  leaseToken: string;
  errorCode: string;
  retryable: boolean;
  retryDelaySeconds?: number;
}

export interface HeartbeatIngestionJobInput {
  tenantId: string;
  jobId: string;
  leaseToken: string;
  leaseDurationSeconds?: number;
}

export class IngestionJobError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "IngestionJobError";
  }
}
