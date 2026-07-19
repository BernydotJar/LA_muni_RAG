import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_VECTOR_DIMENSION } from "../embeddings/pgVectorRepository.js";
import { PostgresIngestionJobService } from "../ingestion/ingestionJobService.js";
import type { EnqueueIngestionJobInput } from "../ingestion/jobTypes.js";
import type { TenantTransactionClient, TenantTransactionPool } from "../security/index.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VERSION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const JOB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OWNER = "11111111-1111-4111-8111-111111111111";
const REQUESTER = "22222222-2222-4222-8222-222222222222";
const RAW_KEY = "cross-principal-dedup-key-20260719";
const ARTIFACT = "a".repeat(64);
const NOW = "2026-07-19T10:00:00.000Z";

const pipelineConfig = {
  contractVersion: "v1" as const,
  extractor: { name: "pdfjs-dist", version: "6.1.200" },
  chunkPlanner: { name: "section_text_v1" as const, maxChars: 1_800, overlapChars: 180 },
  embedding: {
    provider: "test-provider",
    model: "test-model-v1",
    dimension: DEFAULT_VECTOR_DIMENSION,
  },
};

const storedJob = {
  id: JOB,
  tenant_id: TENANT,
  requested_by_principal_id: OWNER,
  document_version_id: VERSION,
  artifact_sha256: ARTIFACT,
  status: "queued",
  attempt_count: 0,
  max_attempts: 3,
  available_at: NOW,
  started_at: null,
  finished_at: null,
  lease_expires_at: null,
  heartbeat_at: null,
  last_error_code: null,
  last_error_retryable: null,
  pipeline_config: {
    contract_version: "v1",
    extractor: { name: "pdfjs-dist", version: "6.1.200" },
    chunk_planner: { name: "section_text_v1", max_chars: 1_800, overlap_chars: 180 },
    embedding: {
      provider: "test-provider",
      model: "test-model-v1",
      dimension: DEFAULT_VECTOR_DIMENSION,
    },
  },
  created_at: NOW,
  updated_at: NOW,
};

describe("durable ingestion job service", () => {
  it("attributes tenant-wide duplicate work to the actual requester without persisting the raw key", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    let released = false;
    const client: TenantTransactionClient = {
      async query(sql, values = []) {
        calls.push({ sql, values });
        if (sql === "BEGIN" || sql === "COMMIT" || sql.includes("set_config")) return { rows: [] };
        if (sql.includes("SELECT version.content_sha256")) {
          return { rows: [{ content_sha256: ARTIFACT }], rowCount: 1 };
        }
        if (sql.includes("INSERT INTO rag.ingestion_jobs")) return { rows: [], rowCount: 0 };
        if (sql.includes("idempotency_key_sha256 = decode")) return { rows: [], rowCount: 0 };
        if (sql.includes("work_sha256 = decode")) return { rows: [storedJob], rowCount: 1 };
        if (sql.includes("INSERT INTO audit.events")) return { rows: [], rowCount: 1 };
        throw new Error("unexpected query");
      },
      release() {
        released = true;
      },
    };
    const pool: TenantTransactionPool = { connect: async () => client };
    const service = new PostgresIngestionJobService(pool, {
      uuid: () => "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    });
    const input: EnqueueIngestionJobInput = {
      tenantId: TENANT,
      principalId: REQUESTER,
      documentVersionId: VERSION,
      artifactSha256: ARTIFACT,
      idempotencyKey: RAW_KEY,
      pipelineConfig,
    };

    const result = await service.enqueue(input);

    assert.equal(result.kind, "duplicate_work");
    if (result.kind !== "duplicate_work") return;
    assert.equal(result.job.principalId, OWNER);
    const audit = calls.find(({ sql }) => sql.includes("INSERT INTO audit.events"));
    assert.equal(audit?.values[2], REQUESTER);
    assert.equal(JSON.stringify(calls).includes(RAW_KEY), false);
    assert.equal(released, true);
  });
});
