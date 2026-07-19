import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_VECTOR_DIMENSION, PgVectorRepositoryError } from "../embeddings/pgVectorRepository.js";
import { TenantPgVectorRepository } from "../embeddings/tenantPgVectorRepository.js";
import type { EmbeddingVectorRecord } from "../embeddings/types.js";
import type { TenantTransactionClient } from "../security/index.js";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VERSION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const JOB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const record = (chunkId = "manual:v1:chunk-1"): EmbeddingVectorRecord => ({
  chunk: {
    chunkId,
    chunkOrdinal: 1,
    text: "Procedimiento municipal verificable.",
    contentSha256: "d".repeat(64),
    tokenEstimate: 9,
    source: {
      documentKey: "manual",
      documentTitle: "Manual municipal",
      documentVersion: "v1",
      sourceFormat: "pdf",
      sectionPath: ["Página 1"],
      sectionType: "page",
      pageStart: 1,
      pageEnd: 1,
      articleNumber: null,
      citationLabel: "Manual municipal, página 1",
    },
    metadata: { sourcePath: "managed/manual.pdf" },
  },
  embedding: Array.from({ length: DEFAULT_VECTOR_DIMENSION }, () => 0.01),
  embeddingModel: "test-model-v1",
  embeddingProvider: "test-provider",
  embeddingDimension: DEFAULT_VECTOR_DIMENSION,
  status: "embedded",
  indexedAt: "2026-07-19T00:00:00.000Z",
  failure: null,
});

const scope = {
  tenantId: TENANT,
  embeddingProvider: "test-provider",
  embeddingModel: "test-model-v1",
  embeddingDimension: DEFAULT_VECTOR_DIMENSION,
};

const generation = {
  documentVersionId: VERSION,
  ingestionJobId: JOB,
};

const documentIdentity = {
  documentKey: "manual",
  documentTitle: "Manual municipal",
  documentVersion: "v1",
};

const clientFrom = (
  handler: (sql: string, values?: unknown[]) => Promise<unknown> | unknown
): TenantTransactionClient => ({
  query: async (sql, values) => handler(sql, values),
  release() {},
});

describe("tenant pgvector repository", () => {
  it("inserts a complete bounded generation and removes stale rows in the same client boundary", async () => {
    const queries: string[] = [];
    const client = clientFrom((sql) => {
      queries.push(sql);
      if (sql.includes("SELECT chunk_id")) return { rows: [], rowCount: 0 };
      if (sql.includes("INSERT INTO rag.embedding_vectors")) return { rows: [{ chunk_id: "manual:v1:chunk-1" }], rowCount: 1 };
      if (sql.includes("DELETE FROM rag.embedding_vectors")) return { rows: [], rowCount: 2 };
      throw new Error("unexpected query");
    });

    const result = await new TenantPgVectorRepository(client, scope).replaceDocumentVersion(
      [record()],
      documentIdentity,
      generation
    );

    assert.deepEqual(result, {
      insertedCount: 1,
      updatedCount: 0,
      unchangedCount: 0,
      deletedCount: 2,
    });
    assert.equal(queries.length, 3);
    assert.match(queries[0]!, /tenant_id/);
    assert.match(queries[1]!, /ON CONFLICT \(tenant_id, chunk_id\)/);
    assert.match(queries[1]!, /indexed_at = statement_timestamp\(\)/);
    assert.match(queries[2]!, /ingestion_job_id IS DISTINCT FROM/);
  });

  it("updates an existing v1 chunk only when it belongs to the same document version", async () => {
    let call = 0;
    const client = clientFrom((sql) => {
      call += 1;
      if (sql.includes("SELECT chunk_id")) {
        return { rows: [{ chunk_id: "manual:v1:chunk-1", document_version_id: VERSION, contract_version: 1 }], rowCount: 1 };
      }
      if (sql.includes("INSERT INTO")) return { rows: [{ chunk_id: "manual:v1:chunk-1" }], rowCount: 1 };
      if (sql.includes("DELETE FROM")) return { rows: [], rowCount: 0 };
      throw new Error("unexpected query");
    });

    const result = await new TenantPgVectorRepository(client, scope).replaceDocumentVersion(
      [record()],
      documentIdentity,
      generation
    );
    assert.equal(result.updatedCount, 1);
    assert.equal(result.unchangedCount, 0);
    assert.equal(call, 3);
  });

  it("rejects a chunk identity bound to another document without deleting anything", async () => {
    let deletes = 0;
    const client = clientFrom((sql) => {
      if (sql.includes("SELECT chunk_id")) {
        return {
          rows: [{
            chunk_id: "manual:v1:chunk-1",
            document_version_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            contract_version: 1,
          }],
          rowCount: 1,
        };
      }
      if (sql.includes("DELETE FROM")) deletes += 1;
      return { rows: [], rowCount: 0 };
    });

    await assert.rejects(
      () => new TenantPgVectorRepository(client, scope).replaceDocumentVersion(
        [record()],
        documentIdentity,
        generation
      ),
      (error: unknown) => error instanceof PgVectorRepositoryError && error.code === "vector_chunk_identity_conflict"
    );
    assert.equal(deletes, 0);
  });

  it("persists bounded batches and uses database time instead of a worker timestamp", async () => {
    const insertParameterCounts: number[] = [];
    const client = clientFrom((sql, values = []) => {
      if (sql.includes("SELECT chunk_id")) return { rows: [], rowCount: 0 };
      if (sql.includes("INSERT INTO")) {
        insertParameterCounts.push(values.length);
        const rows = [];
        for (let offset = 3; offset < values.length; offset += 23) {
          rows.push({ chunk_id: values[offset] });
        }
        assert.match(sql, /statement_timestamp\(\)/);
        assert.doesNotMatch(sql, /::timestamptz/);
        return { rows, rowCount: rows.length };
      }
      if (sql.includes("DELETE FROM")) return { rows: [], rowCount: 0 };
      throw new Error("unexpected query");
    });
    const records = Array.from({ length: 65 }, (_, index) =>
      record(`manual:v1:chunk-${index + 1}`)
    );

    const result = await new TenantPgVectorRepository(client, scope).replaceDocumentVersion(
      records,
      documentIdentity,
      generation
    );

    assert.equal(result.insertedCount, 65);
    assert.deepEqual(insertParameterCounts, [64 * 23, 23]);
  });

  it("rejects duplicates, mismatched model scope, invalid metadata, and invalid record counts before writes", async () => {
    let queries = 0;
    const client = clientFrom(() => {
      queries += 1;
      return { rows: [], rowCount: 0 };
    });
    const repository = new TenantPgVectorRepository(client, scope);
    await assert.rejects(
      () => repository.replaceDocumentVersion([], documentIdentity, generation),
      /between 1 and 5000/
    );
    await assert.rejects(
      () => repository.replaceDocumentVersion([record(), record()], documentIdentity, generation),
      /duplicate chunk/
    );
    await assert.rejects(
      () => repository.replaceDocumentVersion(
        [{ ...record(), embeddingModel: "other-model" }],
        documentIdentity,
        generation
      ),
      /does not match/
    );
    await assert.rejects(
      () => repository.replaceDocumentVersion(
        [record()],
        { ...documentIdentity, documentVersion: "other-version" },
        generation
      ),
      /does not match/
    );
    const cyclic = record();
    const metadata = cyclic.chunk.metadata as Record<string, unknown>;
    metadata.self = metadata;
    await assert.rejects(
      () => repository.replaceDocumentVersion([cyclic], documentIdentity, generation),
      (error: unknown) => error instanceof PgVectorRepositoryError && error.code === "vector_metadata_invalid"
    );
    const invalidPage = record();
    invalidPage.chunk.source.pageStart = 0;
    await assert.rejects(
      () => repository.replaceDocumentVersion([invalidPage], documentIdentity, generation),
      (error: unknown) => error instanceof PgVectorRepositoryError && error.code === "vector_record_shape_invalid"
    );
    assert.equal(queries, 0);
  });

  it("filters search by tenant, provider, model, processed eligibility, public classification, and bounded limit", async () => {
    let querySql = "";
    const client = clientFrom((sql) => {
      querySql = sql;
      return {
        rows: [{
          tenant_id: TENANT,
          document_version_id: VERSION,
          ingestion_job_id: JOB,
          chunk_id: "manual:v1:chunk-1",
          document_key: "manual",
          document_version: "v1",
          document_title: "Manual municipal",
          citation_label: "Manual municipal, página 1",
          page_start: 1,
          page_end: 1,
          article_number: null,
          source_type: "pdf",
          section_path: ["Página 1"],
          section_type: "page",
          chunk_ordinal: 1,
          chunk_text: "Procedimiento municipal verificable.",
          content_sha256: "d".repeat(64),
          token_estimate: 9,
          embedding_model: "test-model-v1",
          embedding_provider: "test-provider",
          embedding_dimension: DEFAULT_VECTOR_DIMENSION,
          embedding: "[0.01]",
          metadata: {
            documentKey: "SPOOFED",
            embeddingModel: "SPOOFED",
            documentVersionId: "SPOOFED",
          },
          indexed_at: "2026-07-19T00:00:00.000Z",
          similarity: "0.92",
        }],
        rowCount: 1,
      };
    });
    const repository = new TenantPgVectorRepository(client, scope);
    const candidates = await repository.searchPublic(
      Array.from({ length: DEFAULT_VECTOR_DIMENSION }, () => 0.01),
      10
    );

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0]?.metadata?.documentKey, "manual");
    assert.equal(candidates[0]?.metadata?.embeddingModel, "test-model-v1");
    assert.equal(candidates[0]?.metadata?.documentVersionId, VERSION);
    assert.match(querySql, /vector\.tenant_id = \$1::uuid/);
    assert.match(querySql, /job\.status = 'processed'/);
    assert.match(querySql, /confidentiality' = 'public'/);
    await assert.rejects(
      () => repository.searchPublic(Array.from({ length: DEFAULT_VECTOR_DIMENSION }, () => 0), 101),
      /between 1 and 100/
    );
  });
});
