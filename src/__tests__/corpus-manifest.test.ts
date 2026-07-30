import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  backfillCorpusManifest,
  computeCorpusContentSha256,
  decideCorpusBackfill,
  InMemoryCorpusManifestStore,
  type CorpusBackfillDocumentInput,
  type CorpusManifestRecord,
} from "../ingestion/corpusManifest.js";
import type { VectorIndexingResult } from "../ingestion/vectorIndexing.js";

const documentInput = (overrides: Partial<CorpusBackfillDocumentInput> = {}): CorpusBackfillDocumentInput => ({
  inputPath: "corpus/ordinance.md",
  title: "Municipal Ordinance",
  documentKey: "municipal-ordinance",
  documentVersion: "2026-01",
  sourceFormat: "markdown",
  content: "# Municipal Ordinance\n\nArticle 1. Local rule.",
  embeddingProvider: "test-provider",
  embeddingModel: "test-model",
  embeddingDimension: 3,
  metadata: {
    domainPackId: "municipal-antigua",
    sourceAuthorityClass: "municipal_manual",
    documentType: "manual",
    confidentiality: "public",
  },
  ...overrides,
});

const indexingResult = (overrides: Partial<VectorIndexingResult> = {}): VectorIndexingResult => ({
  status: "indexed",
  inputPath: "corpus/ordinance.md",
  documentTitle: "Municipal Ordinance",
  sourceFormat: "markdown",
  documentKey: "municipal-ordinance",
  documentVersion: "2026-01",
  chunksPlanned: 2,
  chunksEmbedded: 2,
  recordsInserted: 2,
  recordsUpdated: 0,
  recordsUnchanged: 0,
  recordsWritten: 2,
  failures: [],
  ...overrides,
});

const manifestRecord = (overrides: Partial<CorpusManifestRecord> = {}): CorpusManifestRecord => {
  const doc = documentInput();
  return {
    documentKey: doc.documentKey,
    documentTitle: doc.title ?? null,
    sourcePath: doc.inputPath,
    sourceFormat: doc.sourceFormat ?? null,
    documentVersion: doc.documentVersion,
    contentSha256: computeCorpusContentSha256(doc.content),
    chunkCount: 2,
    embeddingProvider: doc.embeddingProvider,
    embeddingModel: doc.embeddingModel,
    embeddingDimension: doc.embeddingDimension,
    documentMetadata: doc.metadata,
    status: "indexed",
    indexedAt: "2026-01-01T00:00:00.000Z",
    failureCount: 0,
    failureCodes: [],
    ...overrides,
  };
};

const fixedNow = () => new Date("2026-01-02T00:00:00.000Z");

describe("corpus manifest reindex decisions", () => {
  it("indexes when no prior record exists", () => {
    const doc = documentInput();
    const decision = decideCorpusBackfill({
      existingRecord: null,
      document: doc,
      contentSha256: computeCorpusContentSha256(doc.content),
    });

    assert.equal(decision, "index");
  });

  it("skips unchanged indexed records", () => {
    const doc = documentInput();
    const decision = decideCorpusBackfill({
      existingRecord: manifestRecord(),
      document: doc,
      contentSha256: computeCorpusContentSha256(doc.content),
    });

    assert.equal(decision, "skip");
  });

  it("reindexes when content hash changes", () => {
    const doc = documentInput({ content: "changed content" });
    const decision = decideCorpusBackfill({
      existingRecord: manifestRecord(),
      document: doc,
      contentSha256: computeCorpusContentSha256(doc.content),
    });

    assert.equal(decision, "reindex");
  });

  it("reindexes when embedding metadata changes", () => {
    const doc = documentInput({ embeddingModel: "new-model" });
    const decision = decideCorpusBackfill({
      existingRecord: manifestRecord(),
      document: doc,
      contentSha256: computeCorpusContentSha256(doc.content),
    });

    assert.equal(decision, "reindex");
  });

  it("reindexes when domain document metadata changes", () => {
    const doc = documentInput({
      metadata: {
        domainPackId: "municipal-antigua",
        sourceAuthorityClass: "pdm_ot",
        documentType: "plan",
      },
    });
    const decision = decideCorpusBackfill({
      existingRecord: manifestRecord(),
      document: doc,
      contentSha256: computeCorpusContentSha256(doc.content),
    });

    assert.equal(decision, "reindex");
  });

  it("retries failed prior records", () => {
    const doc = documentInput();
    const decision = decideCorpusBackfill({
      existingRecord: manifestRecord({ status: "failed", failureCount: 1, failureCodes: ["provider_failed"] }),
      document: doc,
      contentSha256: computeCorpusContentSha256(doc.content),
    });

    assert.equal(decision, "retry");
  });
});

describe("corpus manifest backfill orchestration", () => {
  it("writes a manifest record after first-time indexing", async () => {
    const store = new InMemoryCorpusManifestStore();
    const doc = documentInput();
    let indexCalls = 0;

    const result = await backfillCorpusManifest(
      { documents: [doc] },
      {
        manifestStore: store,
        now: fixedNow,
        indexVectorSource: async () => {
          indexCalls += 1;
          return indexingResult();
        },
      }
    );

    const record = await store.get(doc.documentKey);
    assert.equal(indexCalls, 1);
    assert.equal(result.documentsConsidered, 1);
    assert.equal(result.documentsIndexed, 1);
    assert.equal(result.documentsSkipped, 0);
    assert.equal(result.documentsFailed, 0);
    assert.equal(record?.status, "indexed");
    assert.equal(record?.contentSha256, computeCorpusContentSha256(doc.content));
    assert.equal(record?.chunkCount, 2);
    assert.equal(record?.embeddingModel, "test-model");
    assert.deepEqual(record?.documentMetadata, doc.metadata);
  });

  it("passes domain document metadata into the indexer", async () => {
    const store = new InMemoryCorpusManifestStore();
    const doc = documentInput();
    let receivedMetadata: unknown = null;

    await backfillCorpusManifest(
      { documents: [doc] },
      {
        manifestStore: store,
        now: fixedNow,
        indexVectorSource: async (input) => {
          receivedMetadata = input.metadata;
          return indexingResult();
        },
      }
    );

    assert.deepEqual(receivedMetadata, doc.metadata);
  });

  it("hashes exact binary bytes and passes the same content to the indexer", async () => {
    const store = new InMemoryCorpusManifestStore();
    const content = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0x00, 0x7f]);
    const doc = documentInput({
      inputPath: "corpus/manual.docx",
      sourceFormat: "docx",
      content,
    });
    let receivedContent: string | Buffer | undefined;

    await backfillCorpusManifest(
      { documents: [doc] },
      {
        manifestStore: store,
        now: fixedNow,
        indexVectorSource: async (input) => {
          receivedContent = input.content;
          return indexingResult({ sourceFormat: "docx", inputPath: doc.inputPath });
        },
      }
    );

    assert.strictEqual(receivedContent, content);
    assert.equal(
      (await store.get(doc.documentKey))?.contentSha256,
      createHash("sha256").update(content).digest("hex")
    );
  });

  it("skips unchanged documents without calling the indexer", async () => {
    const existing = manifestRecord();
    const store = new InMemoryCorpusManifestStore([existing]);
    const doc = documentInput();
    let indexCalls = 0;

    const result = await backfillCorpusManifest(
      { documents: [doc] },
      {
        manifestStore: store,
        now: fixedNow,
        indexVectorSource: async () => {
          indexCalls += 1;
          return indexingResult();
        },
      }
    );

    const record = await store.get(doc.documentKey);
    assert.equal(indexCalls, 0);
    assert.equal(result.documentsSkipped, 1);
    assert.equal(result.results[0].decision, "skip");
    assert.equal(record?.status, "skipped");
    assert.deepEqual(record?.failureCodes, []);
  });

  it("reindexes stale documents when content changes", async () => {
    const store = new InMemoryCorpusManifestStore([manifestRecord()]);
    const doc = documentInput({ content: "changed content" });

    const result = await backfillCorpusManifest(
      { documents: [doc] },
      {
        manifestStore: store,
        now: fixedNow,
        indexVectorSource: async () => indexingResult({ chunksPlanned: 1, chunksEmbedded: 1, recordsInserted: 0, recordsUpdated: 1, recordsWritten: 1 }),
      }
    );

    const record = await store.get(doc.documentKey);
    assert.equal(result.documentsStale, 1);
    assert.equal(result.documentsIndexed, 1);
    assert.equal(result.results[0].decision, "reindex");
    assert.equal(record?.contentSha256, computeCorpusContentSha256(doc.content));
    assert.equal(record?.chunkCount, 1);
  });

  it("retries failed prior records", async () => {
    const store = new InMemoryCorpusManifestStore([
      manifestRecord({ status: "failed", failureCount: 1, failureCodes: ["provider_failed"] }),
    ]);
    const doc = documentInput();

    const result = await backfillCorpusManifest(
      { documents: [doc] },
      {
        manifestStore: store,
        now: fixedNow,
        indexVectorSource: async () => indexingResult(),
      }
    );

    const record = await store.get(doc.documentKey);
    assert.equal(result.documentsIndexed, 1);
    assert.equal(result.results[0].decision, "retry");
    assert.equal(record?.status, "indexed");
    assert.equal(record?.failureCount, 0);
  });

  it("writes failed manifest state when indexing fails", async () => {
    const store = new InMemoryCorpusManifestStore();
    const doc = documentInput();

    const result = await backfillCorpusManifest(
      { documents: [doc] },
      {
        manifestStore: store,
        now: fixedNow,
        indexVectorSource: async () =>
          indexingResult({
            status: "failed",
            chunksPlanned: 2,
            chunksEmbedded: 0,
            recordsInserted: 0,
            recordsWritten: 0,
            failures: [{ code: "provider_failed", message: "Provider failed", retryable: true }],
          }),
      }
    );

    const record = await store.get(doc.documentKey);
    assert.equal(result.documentsFailed, 1);
    assert.equal(result.results[0].status, "failed");
    assert.deepEqual(result.results[0].failureCodes, ["provider_failed"]);
    assert.equal(record?.status, "failed");
    assert.equal(record?.failureCount, 1);
    assert.deepEqual(record?.failureCodes, ["provider_failed"]);
  });
});
