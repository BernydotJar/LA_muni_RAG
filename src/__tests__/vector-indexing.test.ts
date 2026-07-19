import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { NormalizedDocument } from "../ingestion/types.js";
import { IngestionError } from "../ingestion/types.js";
import type { EmbeddingProvider, EmbeddingRepository, EmbeddingVectorRecord } from "../embeddings/types.js";
import { formatVectorIndexingResult, indexVectorSource } from "../ingestion/vectorIndexing.js";

const normalizedDocument: NormalizedDocument = {
  title: "Test Ordinance",
  sourceFormat: "markdown",
  text: "# Test Ordinance\n\nArticle 1. Local rule.",
  sections: [
    {
      heading: "Article 1",
      sectionType: "article",
      sectionPath: ["Article 1"],
      text: "Article 1. Local rule.",
      pageStart: null,
      pageEnd: null,
      articleNumber: "1",
      citationLabel: "Test Ordinance > Article 1",
      metadata: {},
    },
  ],
  metadata: {
    sourcePath: "fixtures/test.md",
  },
};

const createProvider = (embed?: EmbeddingProvider["embed"]): EmbeddingProvider => ({
  providerName: "test-provider",
  model: "test-model",
  dimensions: 3,
  embed: embed ?? (async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3])),
});

const createRepository = (upsert?: EmbeddingRepository["upsert"]): EmbeddingRepository => {
  const records: EmbeddingVectorRecord[] = [];
  return {
    async upsert(record) {
      records.push(record);
      return upsert ? upsert(record) : "inserted";
    },
    async get(chunkId) {
      return records.find((record) => record.chunk.chunkId === chunkId) ?? null;
    },
    async list() {
      return records;
    },
  };
};

const baseDependencies = () => ({
  readFile: async () => "# Test Ordinance\n\nArticle 1. Local rule.",
  extractByPath: async () => normalizedDocument,
  embeddingProvider: createProvider(),
  embeddingRepository: createRepository(),
  now: () => new Date("2026-01-01T00:00:00.000Z"),
});

describe("vector indexing orchestration", () => {
  it("indexes a supported source document into the repository", async () => {
    const repository = createRepository();
    const result = await indexVectorSource(
      {
        inputPath: "fixtures/test.md",
        documentKey: "test-ordinance",
        documentVersion: "2026-01",
      },
      {
        ...baseDependencies(),
        embeddingRepository: repository,
      }
    );

    assert.equal(result.status, "indexed");
    assert.equal(result.documentTitle, "Test Ordinance");
    assert.equal(result.sourceFormat, "markdown");
    assert.equal(result.documentKey, "test-ordinance");
    assert.equal(result.documentVersion, "2026-01");
    assert.equal(result.chunksPlanned, 1);
    assert.equal(result.chunksEmbedded, 1);
    assert.equal(result.recordsInserted, 1);
    assert.equal(result.recordsWritten, 1);
    assert.deepEqual(result.failures, []);
    assert.equal((await repository.list()).length, 1);
  });

  it("indexes caller-verified bytes without rereading a mutable artifact path", async () => {
    const verified = Buffer.from("# Verified\n\nExact bytes.", "utf8");
    let extractedContent: string | Buffer | undefined;

    const result = await indexVectorSource({
      inputPath: "fixtures/test.md",
      content: verified,
      documentKey: "verified-document",
      documentVersion: "v1",
    }, {
      ...baseDependencies(),
      readFile: async () => {
        throw new Error("mutable path must not be reread");
      },
      extractByPath: async (_sourcePath, input) => {
        extractedContent = input.content;
        return normalizedDocument;
      },
    });

    assert.equal(result.status, "indexed");
    assert.strictEqual(extractedContent, verified);
  });

  it("rejects raw PDF entry points before provider setup, file reads, or extraction", async () => {
    let readCalls = 0;
    let extractCalls = 0;
    const result = await indexVectorSource({
      inputPath: "fixtures/manual.pdf",
      content: Buffer.from("%PDF-1.4\n%%EOF\n", "ascii"),
    }, {
      env: {},
      readFile: async () => {
        readCalls += 1;
        return Buffer.alloc(0);
      },
      extractByPath: async () => {
        extractCalls += 1;
        return { ...normalizedDocument, sourceFormat: "pdf" };
      },
    });

    assert.equal(result.status, "failed");
    assert.equal(result.failures[0]?.code, "pdf_requires_document_library");
    assert.equal(result.failures[0]?.retryable, false);
    assert.equal(readCalls, 0);
    assert.equal(extractCalls, 0);
  });

  it("indexes a pre-normalized PDF without reopening or reparsing its path", async () => {
    const repository = createRepository();
    const document: NormalizedDocument = {
      ...normalizedDocument,
      sourceFormat: "pdf",
      metadata: { sourcePath: "fixtures/manual.pdf", extractor: "pdfjs_isolated_process_v1" },
    };
    const result = await indexVectorSource({
      inputPath: "fixtures/manual.pdf",
      document,
      documentKey: "manual",
      documentVersion: "v1",
      metadata: {
        domainPackId: "municipal-antigua",
        sourceAuthorityClass: "municipal_manual",
      },
    }, {
      ...baseDependencies(),
      embeddingRepository: repository,
      readFile: async () => {
        throw new Error("pre-normalized input must not be reread");
      },
      extractByPath: async () => {
        throw new Error("pre-normalized input must not be reparsed");
      },
    });

    assert.equal(result.status, "indexed");
    assert.equal(result.sourceFormat, "pdf");
    assert.equal(result.chunksPlanned, 1);
    const indexedMetadata = (await repository.list())[0]?.chunk.metadata.documentMetadata as
      | Record<string, unknown>
      | undefined;
    assert.equal(
      indexedMetadata?.domainPackId,
      "municipal-antigua"
    );
  });

  it("rejects a normalized document whose format does not match its path", async () => {
    const result = await indexVectorSource({
      inputPath: "fixtures/manual.pdf",
      document: normalizedDocument,
    }, baseDependencies());

    assert.equal(result.status, "failed");
    assert.equal(result.failures[0]?.code, "document_source_format_mismatch");
  });

  it("preserves stable ingestion failure codes and retryability", async () => {
    const result = await indexVectorSource({ inputPath: "fixtures/test.md" }, {
      ...baseDependencies(),
      extractByPath: async () => {
        throw new IngestionError("extractor_bounded_failure", "markdown", "Bounded extraction failed.", {
          retryable: false,
        });
      },
    });

    assert.equal(result.status, "failed");
    assert.deepEqual(result.failures, [{
      code: "extractor_bounded_failure",
      message: "Bounded extraction failed.",
      retryable: false,
    }]);
  });

  it("preserves domain document metadata in planned vector chunks", async () => {
    const repository = createRepository();
    const metadata = {
      domainPackId: "hr",
      sourceAuthorityClass: "employee_handbook",
      documentType: "handbook",
      confidentiality: "internal",
      tags: ["onboarding"],
    };

    const result = await indexVectorSource(
      {
        inputPath: "fixtures/test.md",
        documentKey: "hr-handbook",
        documentVersion: "2026-01",
        metadata,
      },
      {
        ...baseDependencies(),
        embeddingRepository: repository,
        extractByPath: async (_sourcePath, input) => ({
          ...normalizedDocument,
          metadata: input.metadata ?? {},
        }),
      }
    );

    const records = await repository.list();
    assert.equal(result.status, "indexed");
    assert.deepEqual(records[0]?.chunk.metadata.documentMetadata, {
      ...metadata,
      sourcePath: "fixtures/test.md",
    });
  });

  it("returns a stable failure when input is missing", async () => {
    const result = await indexVectorSource({ inputPath: "" }, baseDependencies());

    assert.equal(result.status, "failed");
    assert.equal(result.failures[0].code, "missing_input");
    assert.equal(result.recordsWritten, 0);
  });

  it("returns a stable failure when provider config is missing", async () => {
    const result = await indexVectorSource(
      { inputPath: "fixtures/test.md" },
      {
        readFile: async () => "content",
        extractByPath: async () => normalizedDocument,
        embeddingRepository: createRepository(),
        env: {},
      }
    );

    assert.equal(result.status, "failed");
    assert.equal(result.failures[0].code, "missing_embedding_provider_config");
    assert.equal(result.recordsWritten, 0);
  });

  it("fails closed when no explicit tenant ingestion repository is supplied", async () => {
    const result = await indexVectorSource(
      { inputPath: "fixtures/test.md" },
      {
        readFile: async () => "content",
        extractByPath: async () => normalizedDocument,
        embeddingProvider: createProvider(),
        env: {},
      }
    );

    assert.equal(result.status, "failed");
    assert.equal(result.failures[0].code, "tenant_ingestion_job_required");
    assert.equal(result.recordsWritten, 0);
  });

  it("reports provider failures without writing records", async () => {
    const result = await indexVectorSource(
      { inputPath: "fixtures/test.md" },
      {
        ...baseDependencies(),
        embeddingProvider: createProvider(async () => {
          throw new Error("provider failed");
        }),
      }
    );

    assert.equal(result.status, "failed");
    assert.equal(result.chunksPlanned, 1);
    assert.equal(result.recordsWritten, 0);
    assert.equal(result.failures[0].code, "embedding_pipeline_failed");
  });

  it("reports vector write failures", async () => {
    const result = await indexVectorSource(
      { inputPath: "fixtures/test.md" },
      {
        ...baseDependencies(),
        embeddingRepository: createRepository(async () => {
          throw new Error("write failed");
        }),
      }
    );

    assert.equal(result.status, "failed");
    assert.equal(result.chunksPlanned, 1);
    assert.equal(result.recordsWritten, 0);
    assert.equal(result.failures[0].code, "embedding_pipeline_failed");
  });

  it("does not leak sensitive values in formatted output", async () => {
    const env = {
      DATABASE_URL: "postgresql://user:secret-password@example.test:5432/db",
      QUERY_EMBEDDING_API_KEY: "super-secret-api-key",
      QUERY_EMBEDDING_ENDPOINT: "https://secret-provider.example.test/embeddings",
    };

    const result = await indexVectorSource(
      { inputPath: "fixtures/test.md" },
      {
        ...baseDependencies(),
        env,
        embeddingProvider: createProvider(async () => {
          throw new Error(
            `provider failed at ${env.QUERY_EMBEDDING_ENDPOINT} with ${env.QUERY_EMBEDDING_API_KEY} and ${env.DATABASE_URL}`
          );
        }),
      }
    );

    const output = formatVectorIndexingResult(result);
    assert.ok(!output.includes(env.DATABASE_URL));
    assert.ok(!output.includes(env.QUERY_EMBEDDING_API_KEY));
    assert.ok(!output.includes(env.QUERY_EMBEDDING_ENDPOINT));
    assert.ok(output.includes("[redacted]"));
  });
});
