import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  formatBackfillCorpusDryRunResult,
  formatBackfillCorpusError,
  formatBackfillCorpusResult,
  parseBackfillCorpusArgs,
  resolveBackfillRuntimeMetadata,
  runBackfillCorpus,
  validateBackfillCorpusArgs,
  type BackfillCorpusRuntimeMetadata,
} from "../cli/backfillCorpus.js";
import type { CorpusBackfillResult } from "../ingestion/corpusManifest.js";

const tempDirs: string[] = [];

const createTempDir = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "la-muni-rag-backfill-cli-"));
  tempDirs.push(directory);
  return directory;
};

after(async () => {
  await Promise.all(tempDirs.map((directory) => rm(directory, { recursive: true, force: true })));
});

const runtimeMetadata: BackfillCorpusRuntimeMetadata = {
  embeddingProvider: "test-provider",
  embeddingModel: "test-model",
  embeddingDimension: 3,
};

describe("corpus backfill CLI helpers", () => {
  it("parses required and optional arguments", () => {
    const args = parseBackfillCorpusArgs([
      "--manifest",
      ".rag/corpus-manifest.json",
      "--input",
      "corpus/doc.md",
      "--document-key",
      "doc-key",
      "--document-version",
      "v1",
      "--title",
      "Document Title",
      "--source-format",
      "markdown",
      "--dry-run",
    ]);

    assert.deepEqual(args, {
      manifestPath: ".rag/corpus-manifest.json",
      inputPath: "corpus/doc.md",
      documentKey: "doc-key",
      documentVersion: "v1",
      title: "Document Title",
      sourceFormat: "markdown",
      dryRun: true,
      help: false,
    });
  });

  it("rejects unknown arguments", () => {
    assert.throws(() => parseBackfillCorpusArgs(["--bogus"]), /Unknown argument/);
  });

  it("rejects missing flag values", () => {
    assert.throws(() => parseBackfillCorpusArgs(["--manifest", "--input", "doc.md"]), /Missing value/);
  });

  it("validates required arguments", () => {
    const validation = validateBackfillCorpusArgs({ dryRun: false, help: false });

    assert.equal(validation.valid, false);
    assert.deepEqual(validation.failures, [
      "missing_manifest",
      "missing_input",
      "missing_document_key",
      "missing_document_version",
    ]);
  });

  it("loads runtime metadata from query embedding environment variables without exposing endpoint or key", () => {
    const metadata = resolveBackfillRuntimeMetadata({
      QUERY_EMBEDDING_PROVIDER: "http",
      QUERY_EMBEDDING_ENDPOINT: "https://example.invalid/embed",
      QUERY_EMBEDDING_API_KEY: "secret-key",
      QUERY_EMBEDDING_MODEL: "embedding-model",
      QUERY_EMBEDDING_DIMENSIONS: "768",
    });

    assert.deepEqual(metadata, {
      embeddingProvider: "http",
      embeddingModel: "embedding-model",
      embeddingDimension: 768,
    });
  });

  it("formats safe backfill summaries", () => {
    const result: CorpusBackfillResult = {
      documentsConsidered: 1,
      documentsIndexed: 0,
      documentsSkipped: 0,
      documentsFailed: 1,
      documentsStale: 0,
      results: [
        {
          documentKey: "doc-key",
          decision: "index",
          status: "failed",
          failureCodes: ["missing_embedding_provider_config"],
        },
      ],
    };

    assert.equal(
      formatBackfillCorpusResult(result),
      [
        "Corpus backfill result",
        "- considered: 1",
        "- indexed: 0",
        "- skipped: 0",
        "- stale: 0",
        "- failed: 1",
        "",
        "Documents",
        "- doc-key: status=failed decision=index failureCodes=[missing_embedding_provider_config]",
      ].join("\n")
    );
  });

  it("redacts secrets from formatted CLI errors", () => {
    const formatted = formatBackfillCorpusError(
      new Error(
        "failed with postgresql://user:pass@localhost:5432/db and https://provider.invalid/embed api_key=abc123 Bearer token123"
      )
    );

    assert.doesNotMatch(formatted, /postgresql:\/\//);
    assert.doesNotMatch(formatted, /provider\.invalid/);
    assert.doesNotMatch(formatted, /abc123/);
    assert.doesNotMatch(formatted, /token123/);
    assert.match(formatted, /\[redacted\]/);
  });

  it("runs dry-run without writing the manifest", async () => {
    const directory = await createTempDir();
    const inputPath = join(directory, "doc.md");
    const manifestPath = join(directory, "manifest.json");
    await writeFile(inputPath, "# Document\n\nArticle 1.", "utf-8");

    const result = await runBackfillCorpus(
      {
        manifestPath,
        inputPath,
        documentKey: "doc-key",
        documentVersion: "v1",
        sourceFormat: "markdown",
        dryRun: true,
        help: false,
      },
      runtimeMetadata
    );

    assert.equal(result.dryRun, true);
    assert.equal(result.documentKey, "doc-key");
    assert.equal(result.decision, "index");
    await assert.rejects(() => readFile(manifestPath, "utf-8"), /ENOENT/);
    assert.match(formatBackfillCorpusDryRunResult(result), /Corpus backfill dry run/);
  });

  it("fails before manifest writes when required args are missing", async () => {
    const directory = await createTempDir();
    const manifestPath = join(directory, "manifest.json");

    await assert.rejects(
      () => runBackfillCorpus({ manifestPath, dryRun: false, help: false }, runtimeMetadata),
      /Invalid corpus backfill arguments/
    );
    await assert.rejects(() => readFile(manifestPath, "utf-8"), /ENOENT/);
  });
});
