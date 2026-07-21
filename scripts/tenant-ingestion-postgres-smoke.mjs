import assert from "node:assert/strict";
import pg from "pg";
import { PostgresIngestionJobService } from "../dist/ingestion/ingestionJobService.js";
import { TenantPgVectorRepository } from "../dist/embeddings/tenantPgVectorRepository.js";
import { DEFAULT_VECTOR_DIMENSION } from "../dist/embeddings/pgVectorRepository.js";
import { withTenantTransaction } from "../dist/security/index.js";

const { Pool } = pg;

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PRINCIPAL_A = "11111111-1111-4111-8111-111111111111";
const PRINCIPAL_B = "22222222-2222-4222-8222-222222222222";
const VERSION_A1 = "aaaaaaaa-0000-4000-8000-000000000101";
const VERSION_A2 = "aaaaaaaa-0000-4000-8000-000000000102";
const VERSION_A3 = "aaaaaaaa-0000-4000-8000-000000000103";
const VERSION_A4 = "aaaaaaaa-0000-4000-8000-000000000104";
const VERSION_A5 = "aaaaaaaa-0000-4000-8000-000000000105";
const VERSION_B1 = "bbbbbbbb-0000-4000-8000-000000000101";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the guarded smoke gate");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 6,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 5_000,
  options: "-c statement_timeout=15000 -c lock_timeout=3000 -c idle_in_transaction_session_timeout=15000",
});
const service = new PostgresIngestionJobService(pool);

const config = (extractorVersion = "6.1.200") => ({
  contractVersion: "v1",
  extractor: { name: "pdfjs-dist", version: extractorVersion },
  chunkPlanner: { name: "section_text_v1", maxChars: 1_800, overlapChars: 180 },
  embedding: {
    provider: "test-provider",
    model: "test-model-v1",
    dimension: DEFAULT_VECTOR_DIMENSION,
  },
});

const enqueueInput = ({
  tenantId = TENANT_A,
  principalId = PRINCIPAL_A,
  documentVersionId = VERSION_A1,
  artifactSha256 = "1".repeat(64),
  idempotencyKey,
  extractorVersion,
  maxAttempts,
}) => ({
  tenantId,
  principalId,
  documentVersionId,
  artifactSha256,
  idempotencyKey,
  pipelineConfig: config(extractorVersion),
  ...(maxAttempts ? { maxAttempts } : {}),
});

const vectorRecord = ({
  chunkId,
  ordinal,
  text,
  documentKey = "runtime-manual",
  documentTitle = "Manual de pruebas A",
  documentVersion = "runtime-v1",
}) => ({
  chunk: {
    chunkId,
    chunkOrdinal: ordinal,
    text,
    contentSha256: (ordinal % 10).toString().repeat(64),
    tokenEstimate: Math.ceil(text.length / 4),
    source: {
      documentKey,
      documentTitle,
      documentVersion,
      sourceFormat: "pdf",
      sectionPath: [`Página ${ordinal}`],
      sectionType: "page",
      pageStart: ordinal,
      pageEnd: ordinal,
      articleNumber: null,
      citationLabel: `Runtime manual, página ${ordinal}`,
    },
    metadata: { fixture: "synthetic-tenant-ingestion-gate" },
  },
  embedding: Array.from({ length: DEFAULT_VECTOR_DIMENSION }, () => ordinal / 100),
  embeddingModel: "test-model-v1",
  embeddingProvider: "test-provider",
  embeddingDimension: DEFAULT_VECTOR_DIMENSION,
  status: "embedded",
  indexedAt: "2026-07-19T08:00:00.000Z",
  failure: null,
});

const expectCode = async (operation, code) => {
  await assert.rejects(operation, (error) => error?.code === code);
};

const acceptedBinding = (lease) => {
  assert.ok(lease?.job.artifactObjectId, "leased job must bind an immutable artifact object");
  assert.ok(lease?.job.artifactScanId, "leased job must bind a clean artifact scan");
  return {
    artifactObjectId: lease.job.artifactObjectId,
    artifactScanId: lease.job.artifactScanId,
  };
};

const tenantCount = async (tenantId, sql, values = []) => withTenantTransaction(
  pool,
  tenantId,
  async (client) => {
    const result = await client.query(sql, values);
    return Number(result.rows[0]?.count ?? 0);
  }
);

try {
  const firstInput = enqueueInput({ idempotencyKey: "runtime-main-idempotency-20260719" });
  const first = await service.enqueue(firstInput);
  assert.equal(first.kind, "new");
  const replay = await service.enqueue(firstInput);
  assert.equal(replay.kind, "replay");
  assert.equal(replay.job.jobId, first.job.jobId);
  const conflict = await service.enqueue({ ...firstInput, maxAttempts: 4 });
  assert.equal(conflict.kind, "conflict");
  const duplicate = await service.enqueue({
    ...firstInput,
    idempotencyKey: "runtime-main-duplicate-work-20260719",
  });
  assert.equal(duplicate.kind, "duplicate_work");
  assert.equal(duplicate.job.jobId, first.job.jobId);

  const tenantB = await service.enqueue(enqueueInput({
    tenantId: TENANT_B,
    principalId: PRINCIPAL_B,
    documentVersionId: VERSION_B1,
    artifactSha256: "1".repeat(64),
    idempotencyKey: "runtime-main-idempotency-20260719",
  }));
  assert.equal(tenantB.kind, "new");
  assert.notEqual(tenantB.job.jobId, first.job.jobId);

  const leaseA = await service.leaseNext(TENANT_A, "worker-a-main");
  assert.ok(leaseA);
  assert.equal(leaseA.job.jobId, first.job.jobId);
  await expectCode(
    () => service.heartbeat({ tenantId: TENANT_A, jobId: leaseA.job.jobId, leaseToken: "x".repeat(43) }),
    "ingestion_lease_rejected"
  );
  const heartbeat = await service.heartbeat({
    tenantId: TENANT_A,
    jobId: leaseA.job.jobId,
    leaseToken: leaseA.leaseToken,
  });
  assert.equal(heartbeat.status, "processing");
  await expectCode(
    () => service.complete({
      tenantId: TENANT_A,
      jobId: leaseA.job.jobId,
      leaseToken: leaseA.leaseToken,
      artifactSha256: "9".repeat(64),
      ...acceptedBinding(leaseA),
      records: [vectorRecord({ chunkId: "wrong-artifact-chunk", ordinal: 1, text: "Wrong artifact." })],
    }),
    "ingestion_artifact_identity_mismatch"
  );

  const completedA = await service.complete({
    tenantId: TENANT_A,
    jobId: leaseA.job.jobId,
    leaseToken: leaseA.leaseToken,
    artifactSha256: "1".repeat(64),
    ...acceptedBinding(leaseA),
    records: [
      vectorRecord({ chunkId: "shared-runtime-chunk", ordinal: 1, text: "Tenant A current chunk." }),
      vectorRecord({ chunkId: "tenant-a-stale-chunk", ordinal: 2, text: "Tenant A stale chunk." }),
    ],
  });
  assert.equal(completedA.job.status, "processed");
  assert.equal(completedA.vectors.insertedCount, 2);
  await expectCode(
    () => service.complete({
      tenantId: TENANT_A,
      jobId: leaseA.job.jobId,
      leaseToken: leaseA.leaseToken,
      artifactSha256: "1".repeat(64),
      ...acceptedBinding(leaseA),
      records: [vectorRecord({ chunkId: "shared-runtime-chunk", ordinal: 1, text: "stale worker" })],
    }),
    "ingestion_lease_rejected"
  );

  const firstSearch = await withTenantTransaction(pool, TENANT_A, async (client) =>
    new TenantPgVectorRepository(client, {
      tenantId: TENANT_A,
      embeddingProvider: "test-provider",
      embeddingModel: "test-model-v1",
      embeddingDimension: DEFAULT_VECTOR_DIMENSION,
    }).searchPublic(Array.from({ length: DEFAULT_VECTOR_DIMENSION }, () => 0.01), 10)
  );
  assert.equal(firstSearch.length, 2);

  const replacement = await service.enqueue(enqueueInput({
    idempotencyKey: "runtime-replacement-idempotency-20260719",
    extractorVersion: "6.1.200-rerun",
  }));
  assert.equal(replacement.kind, "new");
  const replacementLease = await service.leaseNext(TENANT_A, "worker-a-replacement");
  assert.ok(replacementLease);
  assert.equal(replacementLease.job.jobId, replacement.job.jobId);
  const replaced = await service.complete({
    tenantId: TENANT_A,
    jobId: replacementLease.job.jobId,
    leaseToken: replacementLease.leaseToken,
    artifactSha256: "1".repeat(64),
    ...acceptedBinding(replacementLease),
    records: [vectorRecord({ chunkId: "shared-runtime-chunk", ordinal: 1, text: "Tenant A replacement chunk." })],
  });
  assert.equal(replaced.vectors.updatedCount, 1);
  assert.equal(replaced.vectors.deletedCount, 1);
  assert.equal(
    await tenantCount(TENANT_A, "SELECT count(*) FROM rag.embedding_vectors WHERE document_version_id = $1::uuid", [VERSION_A1]),
    1
  );

  const leaseB = await service.leaseNext(TENANT_B, "worker-b-main");
  assert.ok(leaseB);
  const completedB = await service.complete({
    tenantId: TENANT_B,
    jobId: leaseB.job.jobId,
    leaseToken: leaseB.leaseToken,
    artifactSha256: "1".repeat(64),
    ...acceptedBinding(leaseB),
    records: [vectorRecord({
      chunkId: "shared-runtime-chunk",
      ordinal: 1,
      text: "TENANT_B_SECRET_MARKER",
      documentTitle: "TENANT_B_SECRET_MARKER",
    })],
  });
  assert.equal(completedB.job.status, "processed");
  assert.equal(await service.get(TENANT_B, first.job.jobId), null);
  assert.equal(
    await tenantCount(TENANT_A, "SELECT count(*) FROM rag.embedding_vectors WHERE chunk_id = 'shared-runtime-chunk'"),
    1
  );
  assert.equal(
    await tenantCount(TENANT_B, "SELECT count(*) FROM rag.embedding_vectors WHERE chunk_id = 'shared-runtime-chunk'"),
    1
  );

  const retryJob = await service.enqueue(enqueueInput({
    documentVersionId: VERSION_A2,
    artifactSha256: "2".repeat(64),
    idempotencyKey: "runtime-retry-idempotency-20260719",
  }));
  assert.equal(retryJob.kind, "new");
  const retryLease = await service.leaseNext(TENANT_A, "worker-a-retry-1");
  assert.ok(retryLease);
  const queuedAgain = await service.fail({
    tenantId: TENANT_A,
    jobId: retryLease.job.jobId,
    leaseToken: retryLease.leaseToken,
    errorCode: "provider_unavailable",
    retryable: true,
    retryDelaySeconds: 0,
  });
  assert.equal(queuedAgain.status, "queued");
  const retryLease2 = await service.leaseNext(TENANT_A, "worker-a-retry-2");
  assert.ok(retryLease2);
  assert.equal(retryLease2.job.attemptCount, 2);
  const terminal = await service.fail({
    tenantId: TENANT_A,
    jobId: retryLease2.job.jobId,
    leaseToken: retryLease2.leaseToken,
    errorCode: "invalid_document",
    retryable: false,
  });
  assert.equal(terminal.status, "failed");

  const fencedJob = await service.enqueue(enqueueInput({
    documentVersionId: VERSION_A3,
    artifactSha256: "3".repeat(64),
    idempotencyKey: "runtime-fencing-idempotency-20260719",
  }));
  assert.equal(fencedJob.kind, "new");
  const staleLease = await service.leaseNext(TENANT_A, "worker-a-stale");
  assert.ok(staleLease);
  await withTenantTransaction(pool, TENANT_A, async (client) => {
    await client.query(
      "UPDATE rag.ingestion_jobs SET lease_expires_at = statement_timestamp() - interval '1 second' WHERE tenant_id = $1::uuid AND id = $2::uuid",
      [TENANT_A, staleLease.job.jobId]
    );
  });
  const reclaimed = await service.leaseNext(TENANT_A, "worker-a-reclaimed");
  assert.ok(reclaimed);
  assert.equal(reclaimed.job.jobId, staleLease.job.jobId);
  assert.notEqual(reclaimed.leaseToken, staleLease.leaseToken);
  await expectCode(
    () => service.heartbeat({
      tenantId: TENANT_A,
      jobId: staleLease.job.jobId,
      leaseToken: staleLease.leaseToken,
    }),
    "ingestion_lease_rejected"
  );
  await service.fail({
    tenantId: TENANT_A,
    jobId: reclaimed.job.jobId,
    leaseToken: reclaimed.leaseToken,
    errorCode: "reclaimed_fixture_done",
    retryable: false,
  });

  const rollbackJob = await service.enqueue(enqueueInput({
    documentVersionId: VERSION_A4,
    artifactSha256: "4".repeat(64),
    idempotencyKey: "runtime-rollback-idempotency-20260719",
  }));
  assert.equal(rollbackJob.kind, "new");
  const rollbackLease = await service.leaseNext(TENANT_A, "worker-a-rollback");
  assert.ok(rollbackLease);
  await assert.rejects(
    () => withTenantTransaction(pool, TENANT_A, async (client) => {
      await new TenantPgVectorRepository(client, {
        tenantId: TENANT_A,
        embeddingProvider: "test-provider",
        embeddingModel: "test-model-v1",
        embeddingDimension: DEFAULT_VECTOR_DIMENSION,
      }).replaceDocumentVersion([
        vectorRecord({
          chunkId: "rollback-only-chunk",
          ordinal: 4,
          text: "This transaction must roll back.",
          documentVersion: "runtime-rollback",
        }),
      ], {
        documentKey: "runtime-manual",
        documentTitle: "Manual de pruebas A",
        documentVersion: "runtime-rollback",
      }, {
        documentVersionId: VERSION_A4,
        ingestionJobId: rollbackJob.job.jobId,
      });
      throw new Error("synthetic_finalize_failure");
    }),
    /synthetic_finalize_failure/
  );
  assert.equal(
    await tenantCount(TENANT_A, "SELECT count(*) FROM rag.embedding_vectors WHERE chunk_id = 'rollback-only-chunk'"),
    0
  );
  await service.fail({
    tenantId: TENANT_A,
    jobId: rollbackLease.job.jobId,
    leaseToken: rollbackLease.leaseToken,
    errorCode: "synthetic_finalize_failure",
    retryable: false,
  });

  const concurrentInput = enqueueInput({
    documentVersionId: VERSION_A5,
    artifactSha256: "5".repeat(64),
    idempotencyKey: "runtime-concurrent-idempotency-20260719",
  });
  const concurrent = await Promise.all(Array.from({ length: 50 }, () => service.enqueue(concurrentInput)));
  const concurrentIds = new Set(concurrent.flatMap((result) => result.kind === "conflict" ? [] : [result.job.jobId]));
  assert.equal(concurrentIds.size, 1);
  assert.equal(concurrent.filter((result) => result.kind === "new").length, 1);
  const claims = await Promise.all([
    service.leaseNext(TENANT_A, "worker-a-concurrent-1"),
    service.leaseNext(TENANT_A, "worker-a-concurrent-2"),
  ]);
  assert.equal(claims.filter(Boolean).length, 1);
  const concurrentLease = claims.find(Boolean);
  await service.fail({
    tenantId: TENANT_A,
    jobId: concurrentLease.job.jobId,
    leaseToken: concurrentLease.leaseToken,
    errorCode: "concurrency_fixture_done",
    retryable: false,
  });

  process.stdout.write(`${JSON.stringify({
    result: "tenant_ingestion_postgres_smoke_passed",
    idempotentSubmissions: concurrent.length,
    uniqueConcurrentJobs: concurrentIds.size,
    uniqueConcurrentLeases: claims.filter(Boolean).length,
    staleLeaseFenced: true,
    artifactIdentityFenced: true,
    crossTenantChunkIdsCoexist: true,
    rollbackVectorCount: 0,
    replacementDeletedStaleChunks: replaced.vectors.deletedCount,
    persistedAcceptanceBound: true,
    controlledArtifactsRead: 0,
  })}\n`);
} finally {
  await pool.end();
}
