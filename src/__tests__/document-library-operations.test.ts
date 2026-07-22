import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { link, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative } from "node:path";
import { describe, it } from "node:test";
import { InMemoryCorpusManifestStore } from "../ingestion/corpusManifest.js";
import type { NormalizedDocument } from "../ingestion/types.js";
import { IngestionError } from "../ingestion/types.js";
import type { VectorIndexingInput, VectorIndexingResult } from "../ingestion/vectorIndexing.js";
import type { MalwareScanner } from "../sources/artifactSafety.js";
import {
  importLocalArtifact,
  ingestLibraryArtifact,
  inspectLibraryArtifact,
} from "../sources/documentLibraryOperations.js";
import type { SourceInventoryManifestFile } from "../sources/sourceInventoryManifest.js";

const fixedNow = () => new Date("2026-07-18T12:00:00.000Z");
const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "ascii");

const cleanScanner: MalwareScanner = {
  scan: async () => ({
    verdict: "clean",
    engine: "clamav",
    engineVersion: "1.4.3",
    definitionsVersion: "27654/2026-07-18",
  }),
};

const infectedScanner: MalwareScanner = {
  scan: async () => ({
    verdict: "infected",
    engine: "clamav",
    engineVersion: "1.4.3",
    definitionsVersion: "27654/2026-07-18",
    signature: "Eicar-Signature",
    failureCode: "malware_detected",
  }),
};

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

const extractedDocument = (sectionCount = 2): NormalizedDocument => {
  const sections = Array.from({ length: sectionCount }, (_, index) => ({
    heading: `Pagina ${index + 1}`,
    sectionType: "page" as const,
    sectionPath: [`Pagina ${index + 1}`],
    text: `Contenido ${index + 1}.`,
    pageStart: index + 1,
    pageEnd: index + 1,
    articleNumber: null,
    citationLabel: `PDM-OT Antigua Guatemala, pagina ${index + 1}`,
    metadata: { ordinal: index + 1 },
  }));
  return {
    title: "PDM-OT Antigua Guatemala",
    sourceFormat: "pdf",
    text: sections.map((section) => section.text).join("\n\n"),
    sections,
    metadata: { extractor: "pdfjs_isolated_process_v1" },
  };
};

const setup = async () => {
  const root = await mkdtemp(join(tmpdir(), "la-muni-library-"));
  const inventoryPath = join(root, "source-inventory.json");
  const inputPath = join(root, "source.pdf");
  const libraryRoot = join(root, "library");
  const quarantineRoot = join(root, "quarantine");
  const corpusManifestPath = join(root, "corpus-manifest.json");
  await writeInventory(inventoryPath);
  await writeFile(inputPath, PDF_BYTES);
  return { root, inventoryPath, inputPath, libraryRoot, quarantineRoot, corpusManifestPath };
};

const importArtifact = async (paths: Awaited<ReturnType<typeof setup>>) => importLocalArtifact({
  inventoryPath: paths.inventoryPath,
  sourceId: "antigua-pdm-ot",
  inputPath: paths.inputPath,
  libraryRoot: paths.libraryRoot,
  documentVersion: "2026-01",
  mediaType: "application/pdf",
  dryRun: false,
}, { now: fixedNow });

const inspectArtifact = async (
  paths: Awaited<ReturnType<typeof setup>>,
  malwareScanner: MalwareScanner = cleanScanner,
  dryRun = false
) => inspectLibraryArtifact({
  inventoryPath: paths.inventoryPath,
  sourceId: "antigua-pdm-ot",
  libraryRoot: paths.libraryRoot,
  quarantineRoot: paths.quarantineRoot,
  dryRun,
}, { now: fixedNow, malwareScanner });

const acquireAndAccept = async (paths: Awaited<ReturnType<typeof setup>>) => {
  const imported = await importArtifact(paths);
  assert.equal(imported.status, "imported");
  const inspected = await inspectArtifact(paths);
  assert.equal(inspected.status, "accepted");
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
    assert.equal(result.contentSha256, createHash("sha256").update(PDF_BYTES).digest("hex"));
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
    assert.deepEqual(await readFile(first.artifactPath), PDF_BYTES);

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
    assert.deepEqual(await readFile(result.artifactPath), PDF_BYTES);

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
      mediaType: "application/pdf",
      dryRun: false,
    }, { now: fixedNow });
    await writeFile(paths.inputPath, Buffer.from("%PDF-1.5\nchanged\n%%EOF\n", "ascii"));

    const result = await importLocalArtifact({
      inventoryPath: paths.inventoryPath,
      sourceId: "antigua-pdm-ot",
      inputPath: paths.inputPath,
      libraryRoot: paths.libraryRoot,
      documentVersion: "2026-01",
      mediaType: "application/pdf",
      dryRun: false,
    }, { now: fixedNow });

    assert.equal(result.status, "failed");
    assert.match(result.failures[0]?.message ?? "", /different hash/i);
  });

  it("rejects a declared media type that does not match the extension and bytes", async () => {
    const paths = await setup();

    const result = await importLocalArtifact({
      inventoryPath: paths.inventoryPath,
      sourceId: "antigua-pdm-ot",
      inputPath: paths.inputPath,
      libraryRoot: paths.libraryRoot,
      documentVersion: "2026-01",
      mediaType: "text/plain",
      dryRun: false,
    }, { now: fixedNow });

    assert.equal(result.status, "failed");
    assert.equal(result.failures[0]?.code, "artifact_declared_media_type_mismatch");
  });

  it("never overwrites an unmanaged file already present at the deterministic destination", async () => {
    const paths = await setup();
    const destination = join(
      paths.libraryRoot,
      "antigua-pdm-ot",
      "antigua-pdm-ot--2026-01.pdf"
    );
    const existing = Buffer.from("operator-owned", "utf8");
    await mkdir(join(paths.libraryRoot, "antigua-pdm-ot"), { recursive: true });
    await writeFile(destination, existing);

    const result = await importArtifact(paths);

    assert.equal(result.status, "failed");
    assert.match(result.failures[0]?.message ?? "", /destination already exists/i);
    assert.deepEqual(await readFile(destination), existing);
  });

  it("does not overwrite a destination created during atomic publication", async () => {
    const paths = await setup();
    const destination = join(
      paths.libraryRoot,
      "antigua-pdm-ot",
      "antigua-pdm-ot--2026-01.pdf"
    );
    const concurrent = Buffer.from("concurrent-operator-file", "utf8");

    const result = await importLocalArtifact({
      inventoryPath: paths.inventoryPath,
      sourceId: "antigua-pdm-ot",
      inputPath: paths.inputPath,
      libraryRoot: paths.libraryRoot,
      documentVersion: "2026-01",
      mediaType: "application/pdf",
      dryRun: false,
    }, {
      now: fixedNow,
      link: async (from, to) => {
        await writeFile(to, concurrent, { flag: "wx" });
        await link(from, to);
      },
    });

    assert.equal(result.status, "failed");
    assert.match(result.failures[0]?.message ?? "", /destination already exists/i);
    assert.deepEqual(await readFile(destination), concurrent);
    const saved = JSON.parse(await readFile(paths.inventoryPath, "utf8")) as SourceInventoryManifestFile;
    assert.equal(saved.records[0]?.status, "verified");
  });
});

describe("document library artifact safety operations", () => {
  it("records matching clean scanner evidence before extraction is permitted", async () => {
    const paths = await setup();
    await importArtifact(paths);

    const result = await inspectArtifact(paths);
    const saved = JSON.parse(await readFile(paths.inventoryPath, "utf8")) as SourceInventoryManifestFile;

    assert.equal(result.status, "accepted");
    assert.equal(result.artifactSafety?.verdict, "clean");
    assert.equal(result.artifactSafety?.detectedMediaType, "application/pdf");
    assert.equal(saved.records[0]?.artifactSafety?.scannerEngine, "clamav");
    assert.equal(saved.records[0]?.status, "acquired");
  });

  it("rejects overlapping library and quarantine roots before invoking the scanner", async () => {
    const paths = await setup();
    await importArtifact(paths);
    let scanCalls = 0;

    const result = await inspectLibraryArtifact({
      inventoryPath: paths.inventoryPath,
      sourceId: "antigua-pdm-ot",
      libraryRoot: paths.libraryRoot,
      quarantineRoot: join(paths.libraryRoot, "quarantine"),
      dryRun: true,
    }, {
      now: fixedNow,
      malwareScanner: {
        scan: async () => {
          scanCalls += 1;
          return cleanScanner.scan("ignored");
        },
      },
    });

    assert.equal(result.status, "failed");
    assert.equal(result.failures[0]?.code, "artifact_roots_overlap");
    assert.equal(scanCalls, 0);
  });

  it("quarantines scanner failures, blocks extraction, and supports a clean retry", async () => {
    const paths = await setup();
    const imported = await importArtifact(paths);
    assert.ok(imported.artifactPath);
    let extractCalls = 0;

    const quarantined = await inspectLibraryArtifact({
      inventoryPath: paths.inventoryPath,
      sourceId: "antigua-pdm-ot",
      libraryRoot: paths.libraryRoot,
      quarantineRoot: paths.quarantineRoot,
      dryRun: false,
    }, { now: fixedNow, env: {} });

    assert.equal(quarantined.status, "quarantined");
    assert.equal(quarantined.failures[0]?.code, "malware_scanner_unconfigured");
    assert.match(quarantined.artifactPath ?? "", /quarantine/);
    await assert.rejects(readFile(imported.artifactPath), /ENOENT/);
    assert.deepEqual(await readFile(quarantined.artifactPath!), PDF_BYTES);

    const blocked = await ingestLibraryArtifact({
      inventoryPath: paths.inventoryPath,
      corpusManifestPath: paths.corpusManifestPath,
      sourceId: "antigua-pdm-ot",
      dryRun: true,
    }, {
      now: fixedNow,
      extractDocument: async () => {
        extractCalls += 1;
        return extractedDocument(1);
      },
    });
    assert.equal(blocked.status, "failed");
    assert.equal(blocked.failures[0]?.code, "artifact_safety_not_accepted");
    assert.equal(extractCalls, 0);

    const retried = await inspectArtifact(paths, cleanScanner);
    assert.equal(retried.status, "accepted");
    assert.equal(retried.artifactPath, imported.artifactPath);
    assert.deepEqual(await readFile(retried.artifactPath!), PDF_BYTES);
  });

  it("dry-runs an infected verdict without moving bytes or mutating inventory", async () => {
    const paths = await setup();
    const imported = await importArtifact(paths);
    const before = await readFile(paths.inventoryPath, "utf8");

    const result = await inspectArtifact(paths, infectedScanner, true);

    assert.equal(result.status, "planned");
    assert.equal(result.mutated, false);
    assert.equal(result.artifactSafety?.verdict, "infected");
    assert.equal(result.artifactSafety?.malwareSignature, "Eicar-Signature");
    assert.equal(result.failures[0]?.code, "malware_detected");
    assert.equal(await readFile(paths.inventoryPath, "utf8"), before);
    assert.deepEqual(await readFile(imported.artifactPath!), PDF_BYTES);
  });

  it("quarantines bytes that no longer match acquisition evidence without rewriting the expected hash", async () => {
    const paths = await setup();
    const imported = await importArtifact(paths);
    const expectedHash = imported.contentSha256;
    const tampered = Buffer.from("%PDF-1.4\ntampered-object\n%%EOF\n", "ascii");
    await writeFile(imported.artifactPath!, tampered);

    const result = await inspectArtifact(paths);
    const saved = JSON.parse(await readFile(paths.inventoryPath, "utf8")) as SourceInventoryManifestFile;

    assert.equal(result.status, "quarantined");
    assert.ok(result.failures.some((failure) => failure.code === "artifact_acquisition_hash_mismatch"));
    assert.equal(saved.records[0]?.acquisition?.contentSha256, expectedHash);
    assert.notEqual(saved.records[0]?.artifactSafety?.observedContentSha256, expectedHash);
    assert.equal(saved.records[0]?.status, "failed");
    assert.deepEqual(await readFile(result.artifactPath!), tampered);
  });

  it("scans a private immutable snapshot even if the managed path undergoes an ABA mutation", async () => {
    const paths = await setup();
    const imported = await importArtifact(paths);
    assert.ok(imported.artifactPath);
    let snapshotPath = "";
    const scanner: MalwareScanner = {
      scan: async (path) => {
        snapshotPath = path;
        assert.notEqual(path, imported.artifactPath);
        assert.deepEqual(await readFile(path), PDF_BYTES);
        await writeFile(imported.artifactPath!, Buffer.from("%PDF-1.4\nchanged\n%%EOF\n", "ascii"));
        await writeFile(imported.artifactPath!, PDF_BYTES);
        return cleanScanner.scan(path);
      },
    };

    const result = await inspectArtifact(paths, scanner);

    assert.equal(result.status, "accepted");
    assert.ok(snapshotPath.includes("la-muni-artifact-scan-"));
    await assert.rejects(() => readFile(snapshotPath), /ENOENT/);
    assert.deepEqual(await readFile(imported.artifactPath!), PDF_BYTES);
  });

  it("fails closed if a scanner changes its private snapshot", async () => {
    const paths = await setup();
    await importArtifact(paths);
    const scanner: MalwareScanner = {
      scan: async (path) => {
        await writeFile(path, Buffer.from("changed snapshot", "utf8"));
        return cleanScanner.scan(path);
      },
    };

    const result = await inspectArtifact(paths, scanner);

    assert.equal(result.status, "quarantined");
    assert.ok(result.failures.some((failure) => failure.code === "artifact_scan_snapshot_changed"));
  });
});

describe("document library ingestion operations", () => {
  it("plans ingestion without calling the indexer or mutating manifests", async () => {
    const paths = await setup();
    await acquireAndAccept(paths);
    const before = await readFile(paths.inventoryPath, "utf-8");
    let indexCalls = 0;

    const result = await ingestLibraryArtifact({
      inventoryPath: paths.inventoryPath,
      corpusManifestPath: paths.corpusManifestPath,
      sourceId: "antigua-pdm-ot",
      dryRun: true,
    }, {
      now: fixedNow,
      extractDocument: async () => extractedDocument(2),
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
    await acquireAndAccept(paths);
    const store = new InMemoryCorpusManifestStore();
    let indexCalls = 0;
    let extractCalls = 0;
    let indexedContent: string | Buffer | undefined;
    let indexedDocument: NormalizedDocument | undefined;
    const parsedDocument = extractedDocument(2);
    const dependencies = {
      now: fixedNow,
      extractDocument: async () => {
        extractCalls += 1;
        return parsedDocument;
      },
      indexVectorSource: async (input: VectorIndexingInput) => {
        indexCalls += 1;
        indexedContent = input.content;
        indexedDocument = input.document;
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
    assert.equal(extractCalls, 1);
    assert.deepEqual(indexedContent, PDF_BYTES);
    assert.strictEqual(indexedDocument?.sections, parsedDocument.sections);
    assert.equal(indexedDocument?.metadata.domainPackId, "municipal-antigua");
    assert.equal(indexedDocument?.metadata.sourceAuthorityClass, "pdm_ot");
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
    assert.equal(extractCalls, 1);
  });

  it("does not mark inventory ingested when indexing fails", async () => {
    const paths = await setup();
    await acquireAndAccept(paths);
    const before = await readFile(paths.inventoryPath, "utf-8");

    const result = await ingestLibraryArtifact({
      inventoryPath: paths.inventoryPath,
      corpusManifestPath: paths.corpusManifestPath,
      sourceId: "antigua-pdm-ot",
      dryRun: false,
    }, {
      now: fixedNow,
      extractDocument: async () => extractedDocument(1),
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

  it("preserves stable extractor failure codes without mutating inventory", async () => {
    const paths = await setup();
    await acquireAndAccept(paths);
    const before = await readFile(paths.inventoryPath, "utf-8");

    const result = await ingestLibraryArtifact({
      inventoryPath: paths.inventoryPath,
      corpusManifestPath: paths.corpusManifestPath,
      sourceId: "antigua-pdm-ot",
      dryRun: true,
    }, {
      now: fixedNow,
      extractDocument: async () => {
        throw new IngestionError("pdf_timeout", "pdf", "PDF extraction exceeded the wall-clock limit.");
      },
    });

    assert.equal(result.status, "failed");
    assert.equal(result.failures[0]?.code, "pdf_timeout");
    assert.equal(await readFile(paths.inventoryPath, "utf-8"), before);
  });

  it("refuses stale scanner evidence before invoking the extractor", async () => {
    const paths = await setup();
    await acquireAndAccept(paths);
    let extractCalls = 0;

    const result = await ingestLibraryArtifact({
      inventoryPath: paths.inventoryPath,
      corpusManifestPath: paths.corpusManifestPath,
      sourceId: "antigua-pdm-ot",
      dryRun: true,
    }, {
      now: () => new Date("2026-07-20T12:00:00.001Z"),
      extractDocument: async () => {
        extractCalls += 1;
        return extractedDocument(1);
      },
    });

    assert.equal(result.status, "failed");
    assert.equal(result.failures[0]?.code, "artifact_safety_evidence_stale");
    assert.equal(extractCalls, 0);
  });
});
