import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { validateSourceInventoryRecord } from "../sources/sourceInventory.js";
import { parseSourceInventoryManifest } from "../sources/sourceInventoryManifest.js";

const inventoryPath = ".rag/source-inventory.json";
const catalogUrl = "https://muniantigua.gob.gt/informacionDetalle/?idinfo=6";
const dmpPdfUrl = "https://muniantigua.gob.gt/assets/backend/info/6_2026_eu9Z7.pdf";

describe("Antigua procedure-manual source reconciliation", () => {
  it("verifies the official catalog without claiming artifact acquisition", async () => {
    const manifest = parseSourceInventoryManifest(await readFile(inventoryPath, "utf8"));
    const matches = manifest.records.filter(
      (record) => record.sourceId === "antigua-manuales-procedimientos"
    );

    assert.equal(matches.length, 1);
    const record = matches[0]!;
    assert.equal(record.documentVersion, "portal-2026-07-18");
    assert.equal(record.status, "verified");
    assert.equal(record.category, "public_portal");
    assert.equal(record.publicUrl, catalogUrl);
    assert.equal(record.authorityClass, "official_municipal");
    assert.equal(record.authorityLevel, "primary");
    assert.equal(record.officialSource, true);
    assert.equal(record.officialForTargetJurisdiction, true);
    assert.equal(record.acquisition, undefined);
    assert.equal(record.extraction, undefined);
    assert.equal(record.indexing, undefined);
    assert.ok(record.limitations.some((item) => item.includes("no se consideran adquiridos")));
    assert.equal(validateSourceInventoryRecord(record).valid, true);
  });

  it("queues the individual DMP v3 PDF without inventing a checksum or lifecycle proof", async () => {
    const manifest = parseSourceInventoryManifest(await readFile(inventoryPath, "utf8"));
    const matches = manifest.records.filter(
      (record) => record.sourceId === "antigua-mnp-dmp-v3-2026"
    );

    assert.equal(matches.length, 1);
    const record = matches[0]!;
    assert.equal(record.status, "acquisition_pending");
    assert.equal(record.publicUrl, dmpPdfUrl);
    assert.equal(record.documentVersion, "unacquired-2026-02-17-v3");
    assert.equal(record.acquisition, undefined);
    assert.equal(record.extraction, undefined);
    assert.equal(record.indexing, undefined);
    assert.ok(record.limitations.some((item) => item.includes("no publica checksum")));
    assert.ok(record.limitations.some((item) => item.includes("licencia expresa")));
    assert.ok(record.provenanceNotes.some((item) => item.includes("49052885")));
    assert.equal(validateSourceInventoryRecord(record).valid, true);
  });
});
