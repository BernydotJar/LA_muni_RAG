import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_VECTOR_DIMENSION } from "../embeddings/pgVectorRepository.js";
import { buildIngestionJobIdentity } from "../ingestion/jobIdentity.js";
import { IngestionJobError, type EnqueueIngestionJobInput } from "../ingestion/jobTypes.js";

const input = (overrides: Partial<EnqueueIngestionJobInput> = {}): EnqueueIngestionJobInput => ({
  tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  principalId: "11111111-1111-4111-8111-111111111111",
  documentVersionId: "22222222-2222-4222-8222-222222222222",
  artifactSha256: "a".repeat(64),
  idempotencyKey: "safe-idempotency-key-20260719",
  pipelineConfig: {
    contractVersion: "v1",
    extractor: { name: "pdfjs-dist", version: "6.1.200" },
    chunkPlanner: { name: "section_text_v1", maxChars: 1_800, overlapChars: 180 },
    embedding: {
      provider: "test-provider",
      model: "test-model-v1",
      dimension: DEFAULT_VECTOR_DIMENSION,
    },
  },
  ...overrides,
});

describe("durable ingestion job identity", () => {
  it("builds deterministic digest-only request, work, artifact, and pipeline identity", () => {
    const first = buildIngestionJobIdentity(input());
    const second = buildIngestionJobIdentity(input());

    assert.deepEqual(first, second);
    for (const digest of [
      first.idempotencyKeySha256,
      first.requestSha256,
      first.artifactSha256,
      first.pipelineConfigSha256,
      first.workSha256,
    ]) {
      assert.match(digest, /^[0-9a-f]{64}$/);
    }
    assert.equal(JSON.stringify(first).includes("safe-idempotency-key-20260719"), false);
    assert.equal(first.canonicalPipelineConfig.includes("pdfjs-dist"), true);
  });

  it("binds work identity to artifact, document version, and exact pipeline", () => {
    const baseline = buildIngestionJobIdentity(input());
    const changedArtifact = buildIngestionJobIdentity(input({ artifactSha256: "b".repeat(64) }));
    const changedDocument = buildIngestionJobIdentity(input({
      documentVersionId: "33333333-3333-4333-8333-333333333333",
    }));
    const changedModel = buildIngestionJobIdentity(input({
      pipelineConfig: {
        ...input().pipelineConfig,
        embedding: { ...input().pipelineConfig.embedding, model: "test-model-v2" },
      },
    }));

    assert.notEqual(changedArtifact.workSha256, baseline.workSha256);
    assert.notEqual(changedDocument.workSha256, baseline.workSha256);
    assert.notEqual(changedModel.workSha256, baseline.workSha256);
  });

  it("binds request identity to the principal and attempt policy", () => {
    const baseline = buildIngestionJobIdentity(input());
    const otherPrincipal = buildIngestionJobIdentity(input({
      principalId: "44444444-4444-4444-8444-444444444444",
    }));
    const otherAttempts = buildIngestionJobIdentity(input({ maxAttempts: 4 }));

    assert.equal(otherPrincipal.workSha256, baseline.workSha256);
    assert.notEqual(otherPrincipal.requestSha256, baseline.requestSha256);
    assert.equal(otherAttempts.workSha256, baseline.workSha256);
    assert.notEqual(otherAttempts.requestSha256, baseline.requestSha256);
  });

  it("rejects invalid scope, key, digest, planner, dimension, and attempt bounds", () => {
    const invalidInputs: EnqueueIngestionJobInput[] = [
      input({ tenantId: "bootstrap" }),
      input({ idempotencyKey: "short" }),
      input({ artifactSha256: "A".repeat(64) }),
      input({ maxAttempts: 11 }),
      input({
        pipelineConfig: {
          ...input().pipelineConfig,
          chunkPlanner: { name: "section_text_v1", maxChars: 100, overlapChars: 60 },
        },
      }),
      input({
        pipelineConfig: {
          ...input().pipelineConfig,
          embedding: { ...input().pipelineConfig.embedding, dimension: 3 },
        },
      }),
    ];

    for (const candidate of invalidInputs) {
      assert.throws(() => buildIngestionJobIdentity(candidate), IngestionJobError);
    }
  });
});
