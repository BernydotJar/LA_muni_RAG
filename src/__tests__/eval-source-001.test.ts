import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
    assert.equal(summary.total, manifest.records.length);
    assert.equal(summary.acquired, manifest.records.filter((record) => record.acquisition).length);
    assert.equal(summary.ingested, manifest.records.filter((record) => record.status === "ingested").length);
    assert.equal(summary.byStatus.ingested, 3);
    assert.equal(summary.byStatus.failed, 7);
    assert.ok(summary.byStatus.verified >= 3);
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

  it("distinguishes catalog discovery, failed extraction and completed ingestion", async () => {
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
    assert.equal(acquired.status, "failed");
    assert.match(acquired.acquisition?.contentSha256 ?? "", /^[a-f0-9]{64}$/);
    assert.ok((acquired.acquisition?.byteLength ?? 0) > 0);
    assert.equal(acquired.artifactSafety?.verdict, "clean");
    assert.deepEqual(acquired.failureCodes, ["pdf_no_extractable_text"]);
    assert.equal(acquired.extraction, undefined);
    assert.equal(acquired.indexing, undefined);

    const [controlledManifest, expansionManifest] = await Promise.all([
      readFile("evals/real-corpus/controlled-corpus-manifest.json", "utf8"),
      readFile("evals/real-corpus/official-expansion-manifest.json", "utf8"),
    ]);
    const controlled = JSON.parse(controlledManifest) as {
      records: Parameters<typeof reconcileSourceInventoryWithCorpusManifest>[1];
    };
    const expansion = JSON.parse(expansionManifest) as {
      records: Parameters<typeof reconcileSourceInventoryWithCorpusManifest>[1];
    };
    const reconciliation = reconcileSourceInventoryWithCorpusManifest(
      manifest.records,
      [...controlled.records, ...expansion.records]
    );
    assert.equal(
      reconciliation.valid,
      true,
      JSON.stringify(reconciliation.failures)
    );
  });

  it("keeps raw acquisition bytes outside Git while preserving durable evidence", async () => {
    const manifest = await load();
    const acquired = manifest.records.find(
      (record) => record.sourceId === "antigua-mnp-dmp-v3-2026"
    );
    assert.ok(acquired?.acquisition?.artifactPath);
    const [gitignore, receipt] = await Promise.all([
      readFile(".gitignore", "utf8"),
      readFile("evals/real-corpus/results/controlled-ingestion-receipt.json", "utf8"),
    ]);
    assert.match(gitignore, /^\.rag\/library\/$/m);
    assert.match(receipt, /"rawBytesCommittedToGit": false/);
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
