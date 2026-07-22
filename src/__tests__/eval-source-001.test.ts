import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import {
  MIXCO_COMPARATIVE_LIMITATION,
  summarizeSourceInventory,
  validateSourceInventory,
} from "../sources/sourceInventory.js";
import {
  parseSourceInventoryManifest,
  reconcileSourceInventoryWithCorpusManifest,
} from "../sources/sourceInventoryManifest.js";

const inventoryPath = ".rag/source-inventory.json";

const load = async () =>
  parseSourceInventoryManifest(await readFile(inventoryPath, "utf8"));

describe("EVAL-SOURCE-001 — governed municipal source inventory", () => {
  it("validates explicit authority, jurisdiction, version and lifecycle state", async () => {
    const manifest = await load();
    const validation = validateSourceInventory(manifest.records);
    const summary = summarizeSourceInventory(manifest.records);

    assert.equal(validation.valid, true, JSON.stringify(validation.failures));
    assert.equal(manifest.schemaVersion, 1);
    assert.match(manifest.targetJurisdiction, /Antigua Guatemala/i);
    assert.equal(summary.total, 17);
    assert.equal(summary.acquired, 1);
    assert.equal(summary.ingested, 0);
    assert.equal(summary.byStatus.ingested, 0);
    assert.ok(summary.byStatus.verified >= 4);
    assert.ok(summary.comparative >= 8);

    for (const record of manifest.records) {
      assert.ok(record.sourceId);
      assert.ok(record.documentKey);
      assert.ok(record.documentVersion);
      assert.ok(record.targetJurisdiction);
      assert.ok(record.sourceJurisdiction);
      assert.ok(Array.isArray(record.limitations));
      assert.ok(Array.isArray(record.provenanceNotes));
    }
  });

  it("keeps other municipalities official only for their own jurisdiction", async () => {
    const manifest = await load();
    const mixco = manifest.records.filter((record) => record.municipality === "mixco");
    assert.ok(mixco.length >= 8);
    for (const record of mixco) {
      assert.equal(record.officialSource, true);
      assert.equal(record.officialForTargetJurisdiction, false);
      assert.equal(record.authorityClass, "external_reference");
      assert.equal(record.authorityLevel, "comparative");
      assert.ok(record.limitations.includes(MIXCO_COMPARATIVE_LIMITATION));
    }
  });

  it("does not promote catalog discovery or acquisition metadata to ingestion", async () => {
    const manifest = await load();
    const catalog = manifest.records.find(
      (record) => record.sourceId === "antigua-manuales-procedimientos"
    );
    const acquired = manifest.records.find(
      (record) => record.sourceId === "antigua-mnp-dmp-v3-2026"
    );
    assert.ok(catalog);
    assert.equal(catalog.status, "verified");
    assert.equal(catalog.acquisition, undefined);
    assert.equal(catalog.extraction, undefined);
    assert.equal(catalog.indexing, undefined);

    assert.ok(acquired);
    assert.equal(acquired.status, "acquired");
    assert.match(acquired.acquisition?.contentSha256 ?? "", /^[a-f0-9]{64}$/);
    assert.ok((acquired.acquisition?.byteLength ?? 0) > 0);
    assert.equal(acquired.extraction, undefined);
    assert.equal(acquired.indexing, undefined);
    assert.equal(
      reconcileSourceInventoryWithCorpusManifest(manifest.records, []).valid,
      true,
      "no source is declared ingested, so an empty operational manifest must not be contradicted"
    );
  });

  it("records that acquired bytes are external to this checkout instead of pretending durability", async () => {
    const manifest = await load();
    const acquired = manifest.records.find(
      (record) => record.sourceId === "antigua-mnp-dmp-v3-2026"
    );
    assert.ok(acquired?.acquisition?.artifactPath);
    await assert.rejects(
      () => access(acquired.acquisition!.artifactPath),
      /ENOENT/,
      "the checkout must not silently claim possession of ignored acquisition bytes"
    );
    const gitignore = await readFile(".gitignore", "utf8");
    assert.match(gitignore, /^\.rag\/library\/$/m);
    assert.ok(acquired.limitations.some((item) => /checksum|licencia|adquis/i.test(item)));
  });

  it("requires full acquisition, clean scan, extraction and indexing before ingested", async () => {
    const [source, manifestSource] = await Promise.all([
      readFile("src/sources/sourceInventory.ts", "utf8"),
      readFile("src/sources/sourceInventoryManifest.ts", "utf8"),
    ]);
    assert.match(source, /ingested_requires_full_evidence/);
    assert.match(source, /ingested_requires_clean_artifact_safety/);
    assert.match(manifestSource, /operational_manifest_without_inventory_acquisition/);
    assert.match(source, /observedContentSha256/);
    assert.match(source, /scannerDefinitionsVersion/);
    assert.match(source, /chunkCount/);
  });
});
