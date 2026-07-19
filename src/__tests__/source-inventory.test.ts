import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import type { CorpusManifestRecord } from "../ingestion/corpusManifest.js";
import {
  MIXCO_COMPARATIVE_LIMITATION,
  isAntiguaPrimaryAuthority,
  summarizeSourceInventory,
  toSourceAuthorityMetadata,
  validateSourceInventory,
  validateSourceInventoryRecord,
  type SourceInventoryRecord,
} from "../sources/sourceInventory.js";
import {
  parseSourceInventoryManifest,
  reconcileSourceInventoryWithCorpusManifest,
} from "../sources/sourceInventoryManifest.js";

const target = "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala";

const baseRecord = (overrides: Partial<SourceInventoryRecord> = {}): SourceInventoryRecord => ({
  sourceId: "antigua-source",
  documentKey: "antigua-source",
  documentVersion: "v1",
  title: "Fuente municipal de Antigua",
  category: "procedure_manual",
  status: "identified",
  targetJurisdiction: target,
  sourceJurisdiction: target,
  municipality: "antigua guatemala",
  authorityClass: "official_municipal",
  authorityLevel: "primary",
  officialSource: true,
  officialForTargetJurisdiction: true,
  limitations: [],
  provenanceNotes: [],
  ...overrides,
});

const acquiredRecord = (): SourceInventoryRecord => baseRecord({
  status: "ingested",
  acquisition: {
    acquiredAt: "2026-07-18T00:00:00.000Z",
    artifactPath: "data/raw/source.pdf",
    contentSha256: "a".repeat(64),
  },
  extraction: {
    extractedAt: "2026-07-18T00:10:00.000Z",
    extractor: "pdf",
    sectionCount: 3,
  },
  indexing: {
    indexedAt: "2026-07-18T00:20:00.000Z",
    indexer: "vector-indexer",
    chunkCount: 8,
    manifestDocumentKey: "antigua-source",
  },
});

describe("municipal source inventory", () => {
  it("validates the committed inventory with one controlled acquisition and no ingestion", async () => {
    const manifest = parseSourceInventoryManifest(await readFile(".rag/source-inventory.json", "utf-8"));
    const validation = validateSourceInventory(manifest.records);
    const summary = summarizeSourceInventory(manifest.records);

    assert.equal(validation.valid, true, JSON.stringify(validation.failures));
    assert.equal(summary.acquired, 1);
    assert.equal(summary.ingested, 0);
    assert.ok(summary.comparative >= 8);
  });

  it("keeps every Mixco record comparative for Antigua", async () => {
    const manifest = parseSourceInventoryManifest(await readFile(".rag/source-inventory.json", "utf-8"));
    const mixco = manifest.records.filter((record) => record.municipality === "mixco");

    assert.ok(mixco.length >= 8);
    for (const record of mixco) {
      assert.equal(record.authorityClass, "external_reference");
      assert.equal(record.authorityLevel, "comparative");
      assert.equal(record.officialSource, true);
      assert.equal(record.officialForTargetJurisdiction, false);
      assert.ok(record.limitations.includes(MIXCO_COMPARATIVE_LIMITATION));
      assert.equal(isAntiguaPrimaryAuthority(toSourceAuthorityMetadata(record)), false);
    }
  });

  it("rejects external and unknown jurisdictions promoted to primary authority", () => {
    const external = validateSourceInventoryRecord(baseRecord({
      sourceJurisdiction: "Municipio de Escuintla, Guatemala",
      municipality: "escuintla",
      authorityClass: "official_municipal",
      authorityLevel: "primary",
      officialForTargetJurisdiction: true,
    }));
    const unknown = validateSourceInventoryRecord(baseRecord({
      sourceJurisdiction: "unknown",
      municipality: undefined,
      authorityLevel: "primary",
      officialForTargetJurisdiction: true,
    }));

    assert.equal(external.valid, false);
    assert.ok(external.failures.some((failure) => failure.code === "external_municipality_must_be_comparative"));
    assert.equal(unknown.valid, false);
    assert.ok(unknown.failures.some((failure) => failure.code === "unknown_jurisdiction_cannot_be_primary"));
  });

  it("rejects ingested state without acquisition, extraction, and indexing evidence", () => {
    const validation = validateSourceInventoryRecord(baseRecord({ status: "ingested" }));
    assert.equal(validation.valid, false);
    assert.ok(validation.failures.some((failure) => failure.code === "ingested_requires_full_evidence"));
  });

  it("detects duplicate versions and conflicting acquired hashes", () => {
    const duplicate = validateSourceInventory([baseRecord(), baseRecord()]);
    const conflicting = validateSourceInventory([
      baseRecord({
        status: "acquired",
        acquisition: { acquiredAt: "2026-07-18", artifactPath: "a.pdf", contentSha256: "a".repeat(64) },
      }),
      baseRecord({
        status: "acquired",
        acquisition: { acquiredAt: "2026-07-18", artifactPath: "b.pdf", contentSha256: "b".repeat(64) },
      }),
    ]);

    assert.ok(duplicate.failures.some((failure) => failure.code === "duplicate_declared_version"));
    assert.ok(conflicting.failures.some((failure) => failure.code === "conflicting_acquired_hash"));
  });

  it("requires the operational manifest to match an ingested inventory record", () => {
    const inventory = acquiredRecord();
    const operational: CorpusManifestRecord = {
      documentKey: inventory.documentKey,
      documentTitle: inventory.title,
      sourcePath: inventory.acquisition!.artifactPath,
      sourceFormat: "pdf",
      documentVersion: inventory.documentVersion,
      contentSha256: inventory.acquisition!.contentSha256,
      chunkCount: 8,
      embeddingProvider: "test",
      embeddingModel: "test",
      embeddingDimension: 3,
      status: "indexed",
      indexedAt: "2026-07-18T00:20:00.000Z",
      failureCount: 0,
      failureCodes: [],
    };

    assert.equal(reconcileSourceInventoryWithCorpusManifest([inventory], [operational]).valid, true);
    assert.equal(reconcileSourceInventoryWithCorpusManifest([inventory], []).valid, false);
    assert.equal(
      reconcileSourceInventoryWithCorpusManifest([inventory], [{ ...operational, contentSha256: "b".repeat(64) }]).valid,
      false
    );
  });
});
