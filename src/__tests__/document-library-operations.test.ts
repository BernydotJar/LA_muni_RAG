import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { describe, it } from "node:test";
import { InMemoryCorpusManifestStore } from "../ingestion/corpusManifest.js";
import type { VectorIndexingResult } from "../ingestion/vectorIndexing.js";
import {
  importLocalArtifact,
  ingestLibraryArtifact,
} from "../sources/documentLibraryOperations.js";
import type { SourceInventoryManifestFile } from "../sources/sourceInventoryManifest.js";

const fixedNow = () => new Date("2026-07-18T12:00:00.000Z");

const inventory = (): SourceInventoryManifestFile => ({
  schemaVersion: 1,
  targetJurisdiction: "Municipalidad de La Antigua Guatemala",
  generatedAt: "2026-07-18T00:00:00.000Z",
  records: [
    {
      sourceId: "antigua-pdm-ot",
      documentKey: "antigua-pdm-ot",
      documentVersion: "2026-01",
      title: "PDM-OT Antigua Guatemala",
      category: "planning",
      status: "verified",
      targetJurisdiction: "Municipalidad de La Antigua Guatemala",
      sourceJurisdiction: "Municipalidad de La Antigua Guatemala",
      municipality: "Antigua Guatemala",
      authorityClass: "official_municipal",
      authorityLevel: "primary",
      officialSource: true,
      officialForTargetJurisdiction: true,
      publicUrl: "https://muniantigua.gob.gt/documentos/pdm-ot.pdf",
      verifiedAt: "2026-07-18T00:00:00.000Z",
      limitations: [],
      provenanceNotes: ["Fixture de prueba."],
    },
  ],
});

const writeInventory = async (path: string): Promise<void> => {
  await writeFile(path, `${JSON.stringify(inventory(), null, 2)}\n`, "utf-8");
};

const indexedResult = (): VectorIndexingResult => ({
  status: "indexed",
  inputPath: "library/antigua-pdm-ot.pdf",
  documentTitle: "PDM-OT Antigua Guatemala",
  sourceFormat: "pdf",
  documentKey: "antigua-pdm-ot",
  documentVersion: "2026-01",
  chunksPlanned: 3,
  chunksEmbedded: 3,
  recordsInserted: 3,
  recordsUpdated: 0,
  recordsUnchanged: 0,
  recordsWritten: 3,
  failures: [],
});

const setup = async () => {
  const root = await mkdtemp(join(tmpdir(), "la-muni-library-"));
  const inventoryPath = join(root, "source-inventory.json");
  const inputPath = join(root, "source.pdf");
  const libraryRoot = join(root, "library");
  const corpusManifestPath = join(root, "corpus-manifest.json");
  await writeInventory(inventoryPath);
  await writeFile(inputPath, Buffer.from([0, 255, 1, 2, 3, 4, 5]));
  return { root, inventoryPath, inputPath, libraryRoot, corpusManifestPath };
};

describe("document library import operations", () => {
  it("plans a binary import without mutating inventory or copying files", async () => {
    const paths = await setup();
    const before = await readFile(paths.inventoryPath, "utf-8");

    const result = await importLocalArtifact({
      inventoryPath: paths.inventoryPath,
      sourceId: "antigua-pdm-ot",
      inputPath: paths.inputPath,
      libraryRoot: paths.libraryRoot,
      documentVersion: "2026-01",
      mediaType: "application/pdf",
      dryRun: true,
    }, { now: fixedNow });

    assert.equal(result.status, "planned");
    assert.equal(result.mutated, false);
    assert.equal(result.contentSha256, createHash("sha256").update(Buffer.from([0, 255, 1, 2, 3, 4, 5])).digest("hex"));
    assert.equal(await readFile(paths.inventoryPath, "utf-8"), before);
  });

  it("imports bytes, records acquisition evidence, and is idempotent", async () => {
    const paths = await setup();
    const first = await importLocalArtifact({
      inventoryPath: paths.inventoryPath,
      sourceId: "antigua-pdm-ot",
      inputPath: paths.inputPath,
      libraryRoot: paths.libraryRoot,
      documentVersion: "2026-01",
      mediaType: "application/pdf",
      dryRun: false,
    }, { now: fixedNow });

    assert.equal(first.status, "imported");
    assert.equal(first.mutated, true);
    assert.ok(first.artifactPath);
    assert.deepEqual(await readFile(first.artifactPath), Buffer.from([0, 255, 1, 2, 3, 4, 5]));

    const second = await importLocalArtifact({
      inventoryPath: paths.inventoryPath,
      sourceId: "antigua-pdm-ot",
      inputPath: paths.inputPath,
      libraryRoot: paths.libraryRoot,
      documentVersion: "2026-01",
      mediaType: "application/pdf",
      dryRun: false,
    }, { now: fixedNow });

    assert.equal(second.status, "noop");
    assert.equal(second.mutated, false);
  });

  it("stores a portable artifact path when the configured library root is relative", async () => {
    const paths = await setup();
    const relativeLibraryRoot = relative(process.cwd(), paths.libraryRoot);

    const result = await importLocalArtifact({
      inventoryPath: paths.inventoryPath,
      sourceId: "antigua-pdm-ot",
      inputPath: paths.inputPath,
      libraryRoot: relativeLibraryRoot,
      documentVersion: "2026-01",
      mediaType: "application/pdf",
      dryRun: false,
    }, { now: fixedNow });

    assert.equal(result.status, "imported");
    assert.ok(result.artifactPath);
    assert.equal(isAbsolute(result.artifactPath), false);
    assert.deepEqual(await readFile(result.artifactPath), Buffer.from([0, 255, 1, 2, 3, 4, 5]));

    const saved = JSON.parse(await readFile(paths.inventoryPath, "utf8")) as SourceInventoryManifestFile;
    assert.equal(isAbsolute(saved.records[0]?.acquisition?.artifactPath ?? ""), false);
  });

  it("fails closed when the same version is imported with a different hash", async () => {
    const paths = await setup();
    await importLocalArtifact({
      inventoryPath: paths.inventoryPath,
      sourceId: "antigua-pdm-ot",
      inputPath: paths.inputPath,
      libraryRoot: paths.libraryRoot,
      documentVersion: "2026-01",
      dryRun: false,
    }, { now: fixedNow });
    await writeFile(paths.inputPath, Buffer.from("different bytes"));

    const result = await importLocalArtifact({
      inventoryPath: paths.inventoryPath,
      sourceId: "antigua-pdm-ot",
      inputPath: paths.inputPath,
      libraryRoot: paths.libraryRoot,
      documentVersion: "2026-01",
      dryRun: false,
    }, { now: fixedNow });

    assert.equal(result.status, "failed");
    assert.match(result.failures[0]?.message ?? "", /different hash/i);
  });
});

describe("document library ingestion operations", () => {
  it("plans ingestion without calling the indexer or mutating manifests", async () => {
    const paths = await setup();
    await importLocalArtifact({
      inventoryPath: paths.inventoryPath,
      sourceId: "antigua-pdm-ot",
      inputPath: paths.inputPath,
      libraryRoot: paths.libraryRoot,
      documentVersion: "2026-01",
      dryRun: false,
    }, { now: fixedNow });
    const before = await readFile(paths.inventoryPath, "utf-8");
    let indexCalls = 0;

    const result = await ingestLibraryArtifact({
      inventoryPath: paths.inventoryPath,
      corpusManifestPath: paths.corpusManifestPath,
      sourceId: "antigua-pdm-ot",
      dryRun: true,
    }, {
      now: fixedNow,
      extractSectionCount: async () => 2,
      indexVectorSource: async () => {
        indexCalls += 1;
        return indexedResult();
      },
      corpusManifestStore: new InMemoryCorpusManifestStore(),
    });

    assert.equal(result.status, "planned");
    assert.equal(result.sectionCount, 2);
    assert.equal(indexCalls, 0);
    assert.equal(await readFile(paths.inventoryPath, "utf-8"), before);
  });

  it("indexes, reconciles, records ingestion evidence, and becomes idempotent", async () => {
    const paths = await setup();
    await importLocalArtifact({
      inventoryPath: paths.inventoryPath,
      sourceId: "antigua-pdm-ot",
      inputPath: paths.inputPath,
      libraryRoot: paths.libraryRoot,
      documentVersion: "2026-01",
      dryRun: false,
    }, { now: fixedNow });
    const store = new InMemoryCorpusManifestStore();
    let indexCalls = 0;
    const dependencies = {
      now: fixedNow,
      extractSectionCount: async () => 2,
      indexVectorSource: async () => {
        indexCalls += 1;
        return indexedResult();
      },
      corpusManifestStore: store,
      runtimeMetadata: {
        embeddingProvider: "test-provider",
        embeddingModel: "test-model",
        embeddingDimension: 3,
      },
    };

    const first = await ingestLibraryArtifact({
      inventoryPath: paths.inventoryPath,
      corpusManifestPath: paths.corpusManifestPath,
      sourceId: "antigua-pdm-ot",
      dryRun: false,
    }, dependencies);

    assert.equal(first.status, "ingested");
    assert.equal(first.sectionCount, 2);
    assert.equal(first.chunkCount, 3);
    assert.equal(indexCalls, 1);
    const operational = await store.get("antigua-pdm-ot");
    assert.equal(operational?.contentSha256, first.contentSha256);
    assert.equal(operational?.documentMetadata?.sourceAuthorityClass, "pdm_ot");

    const second = await ingestLibraryArtifact({
      inventoryPath: paths.inventoryPath,
      corpusManifestPath: paths.corpusManifestPath,
      sourceId: "antigua-pdm-ot",
      dryRun: false,
    }, dependencies);

    assert.equal(second.status, "noop");
    assert.equal(indexCalls, 1);
  });

  it("does not mark inventory ingested when indexing fails", async () => {
    const paths = await setup();
    await importLocalArtifact({
      inventoryPath: paths.inventoryPath,
      sourceId: "antigua-pdm-ot",
      inputPath: paths.inputPath,
      libraryRoot: paths.libraryRoot,
      documentVersion: "2026-01",
      dryRun: false,
    }, { now: fixedNow });
    const before = await readFile(paths.inventoryPath, "utf-8");

    const result = await ingestLibraryArtifact({
      inventoryPath: paths.inventoryPath,
      corpusManifestPath: paths.corpusManifestPath,
      sourceId: "antigua-pdm-ot",
      dryRun: false,
    }, {
      now: fixedNow,
      extractSectionCount: async () => 1,
      indexVectorSource: async () => ({
        ...indexedResult(),
        status: "failed",
        chunksPlanned: 0,
        chunksEmbedded: 0,
        recordsInserted: 0,
        recordsWritten: 0,
        failures: [{ code: "provider_failed", message: "Provider failed", retryable: true }],
      }),
      corpusManifestStore: new InMemoryCorpusManifestStore(),
    });

    assert.equal(result.status, "failed");
    assert.equal(await readFile(paths.inventoryPath, "utf-8"), before);
  });
});
