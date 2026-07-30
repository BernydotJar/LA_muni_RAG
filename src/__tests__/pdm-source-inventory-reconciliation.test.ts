import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { describe, it } from "node:test";
import { validateSourceInventoryRecord } from "../sources/sourceInventory.js";
import { parseSourceInventoryManifest } from "../sources/sourceInventoryManifest.js";

const inventoryPath = ".rag/source-inventory.json";
const downloadLogPath = "docs/core-document-download-log.md";
const versionSeedPath = "db/seeds/002_document_versions.sql";
const artifactPath = "data/raw/core-documents/pdm-ot-antigua-modulo-1.pdf";
const officialUrl = "https://muniantigua.gob.gt/assets/backend/info/MODULO_1_PDMOT.pdf";
const documentVersion = "official-municipal-pdf-2026-06-22";
const contentSha256 = "824f0ee47106f062269a7c65cb3433435470bbe609054972eb29c360f368cd0b";
const byteLength = 34_822_596;

describe("PDM-OT source inventory reconciliation", () => {
  it("credits exact clean PDM-OT ingestion without legal or completeness overclaims", async () => {
    const manifest = parseSourceInventoryManifest(await readFile(inventoryPath, "utf-8"));
    const matches = manifest.records.filter((record) => record.sourceId === "antigua-pdm-ot");

    assert.equal(matches.length, 1);
    const record = matches[0]!;
    assert.equal(record.documentKey, "antigua-pdm-ot");
    assert.equal(record.documentVersion, documentVersion);
    assert.equal(record.status, "ingested");
    assert.equal(record.publicUrl, officialUrl);
    assert.equal(record.verifiedAt, "2026-06-22");
    assert.equal(record.authorityClass, "official_municipal");
    assert.equal(record.authorityLevel, "primary");
    assert.equal(record.officialSource, true);
    assert.equal(record.officialForTargetJurisdiction, true);
    assert.equal(record.acquisition?.contentSha256, contentSha256);
    assert.equal(record.acquisition?.byteLength, byteLength);
    assert.equal(record.artifactSafety?.verdict, "clean");
    assert.equal(record.extraction?.sectionCount, 224);
    assert.equal(record.indexing?.chunkCount, 444);
    assert.equal(record.indexing?.manifestDocumentKey, "antigua-pdm-ot");
    assert.ok(record.limitations.some((item) => item.includes("no demuestra vigencia")));
    assert.ok(record.limitations.some((item) => item.includes("no un modelo semántico productivo")));
    assert.ok(record.provenanceNotes.some((item) => item.includes("Feature 085")));

    const validation = validateSourceInventoryRecord(record);
    assert.equal(validation.valid, true, JSON.stringify(validation.failures));
  });

  it("matches the portable download-log and document-version evidence", async () => {
    const [downloadLog, versionSeed] = await Promise.all([
      readFile(downloadLogPath, "utf-8"),
      readFile(versionSeedPath, "utf-8"),
    ]);

    for (const evidence of [officialUrl, artifactPath, contentSha256]) {
      assert.ok(downloadLog.includes(evidence), `download log is missing ${evidence}`);
      assert.ok(versionSeed.includes(evidence), `document-version seed is missing ${evidence}`);
    }
    assert.ok(downloadLog.includes("Last updated: 2026-06-22"));
    assert.ok(downloadLog.includes("Verified PDF"));
    assert.ok(versionSeed.includes(`'${documentVersion}'`));
    assert.ok(versionSeed.includes("'application/pdf'"));
    assert.ok(versionSeed.includes('"downloaded_at": "2026-06-22"'));
    assert.ok(versionSeed.includes(`"file_size_bytes": ${byteLength}`));
  });

  it(
    "matches the optional local PDF bytes when the gitignored artifact is provisioned",
    { skip: existsSync(artifactPath) ? false : "gitignored local artifact is not provisioned" },
    async () => {
      const [bytes, metadata] = await Promise.all([readFile(artifactPath), stat(artifactPath)]);

      assert.equal(metadata.isFile(), true);
      assert.equal(metadata.size, byteLength);
      assert.equal(bytes.byteLength, byteLength);
      assert.equal(bytes.subarray(0, 8).toString("ascii"), "%PDF-1.4");
      assert.equal(createHash("sha256").update(bytes).digest("hex"), contentSha256);
    }
  );
});
