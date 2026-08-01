import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, it } from "node:test";

interface SourceConfig {
  sourceId: string;
  documentVersion: string;
  relativePath: string;
  expectedSha256: string;
  expectedByteLength: number;
}

interface ManifestRecord {
  documentKey: string;
  documentVersion: string;
  contentSha256: string;
  chunkCount: number;
  status: string;
}

interface ReceiptSource {
  sourceId: string;
  documentKey: string;
  documentVersion: string;
  contentSha256: string;
  byteLength: number;
  structuralSignature: string;
  scanner: { engine: string; version: string; definitionsVersion: string };
  acceptance: { artifactObjectId: string; artifactScanId: string };
  jobId: string;
  ingestionStatus: string;
  sectionCount: number;
  chunkCount: number;
  failureCode: string | null;
}

interface InventoryRecord {
  sourceId: string;
  documentKey?: string;
  documentVersion?: string;
  status: string;
  limitations?: string[];
  acquisition?: { contentSha256: string; byteLength: number; artifactPath: string };
  artifactSafety?: {
    verdict: string;
    observedContentSha256: string;
    observedByteLength: number;
    failureCodes: string[];
  };
  extraction?: { sectionCount: number };
  indexing?: { chunkCount: number; manifestDocumentKey: string };
}

const loadExpansionEvidence = async () => {
  const [configText, manifestText, receiptText, inventoryText] = await Promise.all([
    readFile("evals/real-corpus/official-expansion-config.json", "utf8"),
    readFile("evals/real-corpus/official-expansion-manifest.json", "utf8"),
    readFile("evals/real-corpus/results/official-expansion-receipt.json", "utf8"),
    readFile(".rag/source-inventory.json", "utf8"),
  ]);
  return {
    config: JSON.parse(configText) as { schemaVersion: number; sources: SourceConfig[] },
    manifest: JSON.parse(manifestText) as { schemaVersion: number; records: ManifestRecord[] },
    receipt: JSON.parse(receiptText) as {
      schemaVersion: number;
      database: {
        deploymentClass: string;
        disposable: boolean;
        runtimeRoleNonOwner: boolean;
        runtimeRoleNoBypassRls: boolean;
      };
      sources: ReceiptSource[];
    },
    inventory: JSON.parse(inventoryText) as { schemaVersion: number; records: InventoryRecord[] },
  };
};

describe("official corpus expansion config", () => {
  it("reconciles config, manifest, managed receipt and inventory without requiring raw PDFs in Git", async () => {
    const { config, manifest, receipt, inventory } = await loadExpansionEvidence();
    const expectedIds = ["antigua-pdmot-module-3", "antigua-pdmot-module-4"];

    assert.equal(config.schemaVersion, 1);
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(receipt.schemaVersion, 1);
    assert.equal(inventory.schemaVersion, 1);
    assert.deepEqual(config.sources.map((source) => source.sourceId), expectedIds);
    assert.equal(receipt.database.deploymentClass, "managed");
    assert.equal(receipt.database.disposable, false);
    assert.equal(receipt.database.runtimeRoleNonOwner, true);
    assert.equal(receipt.database.runtimeRoleNoBypassRls, true);

    const manifestByKey = new Map(manifest.records.map((record) => [record.documentKey, record]));
    const receiptById = new Map(receipt.sources.map((source) => [source.sourceId, source]));
    const inventoryById = new Map(inventory.records.map((record) => [record.sourceId, record]));

    for (const source of config.sources) {
      const manifestRecord = manifestByKey.get(source.sourceId);
      const receiptSource = receiptById.get(source.sourceId);
      const inventoryRecord = inventoryById.get(source.sourceId);
      assert.ok(manifestRecord, `missing manifest record for ${source.sourceId}`);
      assert.ok(receiptSource, `missing receipt source for ${source.sourceId}`);
      assert.ok(inventoryRecord, `missing inventory source for ${source.sourceId}`);

      assert.equal(manifestRecord.documentVersion, source.documentVersion);
      assert.equal(manifestRecord.contentSha256, source.expectedSha256);
      assert.equal(manifestRecord.status, "indexed");
      assert.ok(manifestRecord.chunkCount > 0);

      assert.equal(receiptSource.documentKey, source.sourceId);
      assert.equal(receiptSource.documentVersion, source.documentVersion);
      assert.equal(receiptSource.contentSha256, source.expectedSha256);
      assert.equal(receiptSource.byteLength, source.expectedByteLength);
      assert.equal(receiptSource.structuralSignature, "pdf-header-eof-v1");
      assert.equal(receiptSource.scanner.engine, "clamav");
      assert.ok(receiptSource.scanner.version.length > 0);
      assert.ok(receiptSource.scanner.definitionsVersion.length > 0);
      assert.match(receiptSource.acceptance.artifactObjectId, /^[0-9a-f-]{36}$/i);
      assert.match(receiptSource.acceptance.artifactScanId, /^[0-9a-f-]{36}$/i);
      assert.match(receiptSource.jobId, /^[0-9a-f-]{36}$/i);
      assert.equal(receiptSource.ingestionStatus, "ingested");
      assert.ok(receiptSource.sectionCount > 0);
      assert.equal(receiptSource.chunkCount, manifestRecord.chunkCount);
      assert.equal(receiptSource.failureCode, null);

      assert.equal(inventoryRecord.status, "ingested");
      assert.equal(inventoryRecord.documentKey, source.sourceId);
      assert.equal(inventoryRecord.documentVersion, source.documentVersion);
      assert.equal(inventoryRecord.acquisition?.contentSha256, source.expectedSha256);
      assert.equal(inventoryRecord.acquisition?.byteLength, source.expectedByteLength);
      assert.equal(inventoryRecord.artifactSafety?.verdict, "clean");
      assert.equal(inventoryRecord.artifactSafety?.observedContentSha256, source.expectedSha256);
      assert.equal(inventoryRecord.artifactSafety?.observedByteLength, source.expectedByteLength);
      assert.deepEqual(inventoryRecord.artifactSafety?.failureCodes, []);
      assert.equal(inventoryRecord.extraction?.sectionCount, receiptSource.sectionCount);
      assert.equal(inventoryRecord.indexing?.chunkCount, receiptSource.chunkCount);
      assert.equal(inventoryRecord.indexing?.manifestDocumentKey, source.sourceId);
      assert.ok(inventoryRecord.limitations?.every((item) => !/aún no adquirido ni ingerido/i.test(item)));
    }
  });

  it("verifies exact bytes when the immutable local artifact store is mounted", async () => {
    const { config } = await loadExpansionEvidence();
    const paths = config.sources.map((source) => resolve(".rag/library", source.relativePath));
    const presence = await Promise.all(paths.map(async (path) => access(path).then(() => true, () => false)));

    if (presence.every((value) => !value)) {
      const gitignore = await readFile(".gitignore", "utf8");
      assert.match(gitignore, /\.rag\/library/);
      return;
    }
    assert.ok(presence.every(Boolean), "immutable artifact store must be fully mounted, not partially mounted");

    for (const [index, source] of config.sources.entries()) {
      const bytes = await readFile(paths[index]);
      assert.equal(bytes.byteLength, source.expectedByteLength);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), source.expectedSha256);
    }
  });
});
