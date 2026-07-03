import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  computeCorpusContentSha256,
  CorpusManifestFileError,
  JsonFileCorpusManifestStore,
  type CorpusManifestRecord,
} from "../ingestion/corpusManifest.js";

const tempDirs: string[] = [];

const createTempManifestPath = async (): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "la-muni-rag-manifest-"));
  tempDirs.push(directory);
  return join(directory, "manifest.json");
};

after(async () => {
  await Promise.all(tempDirs.map((directory) => rm(directory, { recursive: true, force: true })));
});

const manifestRecord = (overrides: Partial<CorpusManifestRecord> = {}): CorpusManifestRecord => ({
  documentKey: "municipal-ordinance",
  documentTitle: "Municipal Ordinance",
  sourcePath: "corpus/ordinance.md",
  sourceFormat: "markdown",
  documentVersion: "2026-01",
  contentSha256: computeCorpusContentSha256("# Municipal Ordinance\n\nArticle 1."),
  chunkCount: 2,
  embeddingProvider: "test-provider",
  embeddingModel: "test-model",
  embeddingDimension: 3,
  status: "indexed",
  indexedAt: "2026-01-01T00:00:00.000Z",
  failureCount: 0,
  failureCodes: [],
  ...overrides,
});

describe("JSON file corpus manifest store", () => {
  it("treats a missing manifest file as an empty store", async () => {
    const manifestPath = await createTempManifestPath();
    const store = new JsonFileCorpusManifestStore(manifestPath);

    assert.equal(await store.get("missing-document"), null);
    assert.deepEqual(await store.list(), []);
  });

  it("reads an existing manifest record from disk", async () => {
    const manifestPath = await createTempManifestPath();
    const record = manifestRecord();
    await writeFile(
      manifestPath,
      JSON.stringify({ schemaVersion: 1, records: [record] }, null, 2),
      "utf-8"
    );

    const store = new JsonFileCorpusManifestStore(manifestPath);

    assert.deepEqual(await store.get(record.documentKey), record);
  });

  it("persists put writes across store instances", async () => {
    const manifestPath = await createTempManifestPath();
    const record = manifestRecord();

    await new JsonFileCorpusManifestStore(manifestPath).put(record);
    const reloadedStore = new JsonFileCorpusManifestStore(manifestPath);

    assert.deepEqual(await reloadedStore.get(record.documentKey), record);
  });

  it("replaces an existing document key instead of duplicating it", async () => {
    const manifestPath = await createTempManifestPath();
    const store = new JsonFileCorpusManifestStore(manifestPath);
    const original = manifestRecord({ chunkCount: 2 });
    const updated = manifestRecord({ chunkCount: 5, documentVersion: "2026-02" });

    await store.put(original);
    await store.put(updated);

    const records = await store.list();
    assert.equal(records.length, 1);
    assert.equal(records[0].documentKey, original.documentKey);
    assert.equal(records[0].chunkCount, 5);
    assert.equal(records[0].documentVersion, "2026-02");
  });

  it("lists records in deterministic documentKey order", async () => {
    const manifestPath = await createTempManifestPath();
    const store = new JsonFileCorpusManifestStore(manifestPath);

    await store.put(manifestRecord({ documentKey: "zoning-rules" }));
    await store.put(manifestRecord({ documentKey: "building-code" }));
    await store.put(manifestRecord({ documentKey: "ambiental-policy" }));

    assert.deepEqual(
      (await store.list()).map((record) => record.documentKey),
      ["ambiental-policy", "building-code", "zoning-rules"]
    );
  });

  it("writes stable JSON with schemaVersion and records", async () => {
    const manifestPath = await createTempManifestPath();
    const store = new JsonFileCorpusManifestStore(manifestPath);
    await store.put(manifestRecord());

    const file = JSON.parse(await readFile(manifestPath, "utf-8")) as { schemaVersion?: unknown; records?: unknown };

    assert.equal(file.schemaVersion, 1);
    assert.equal(Array.isArray(file.records), true);
  });

  it("fails clearly on invalid JSON", async () => {
    const manifestPath = await createTempManifestPath();
    await writeFile(manifestPath, "{ invalid json", "utf-8");
    const store = new JsonFileCorpusManifestStore(manifestPath);

    await assert.rejects(() => store.list(), CorpusManifestFileError);
  });

  it("fails clearly on invalid manifest shape", async () => {
    const manifestPath = await createTempManifestPath();
    await writeFile(manifestPath, JSON.stringify({ schemaVersion: 1, records: "not-an-array" }), "utf-8");
    const store = new JsonFileCorpusManifestStore(manifestPath);

    await assert.rejects(() => store.list(), CorpusManifestFileError);
  });

  it("fails clearly on invalid record documentKey", async () => {
    const manifestPath = await createTempManifestPath();
    await writeFile(manifestPath, JSON.stringify({ schemaVersion: 1, records: [{ documentKey: "" }] }), "utf-8");
    const store = new JsonFileCorpusManifestStore(manifestPath);

    await assert.rejects(() => store.list(), CorpusManifestFileError);
  });
});
