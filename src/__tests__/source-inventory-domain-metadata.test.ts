import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadDomainPack } from "../domain/registry.js";
import {
  sourceInventoryAuthorityToDomainClass,
  sourceInventoryRecordToDomainMetadata,
  type SourceInventoryRecord,
} from "../sources/sourceInventory.js";

const target = "Municipio de La Antigua Guatemala, Sacatepéquez, Guatemala";

const record = (overrides: Partial<SourceInventoryRecord> = {}): SourceInventoryRecord => ({
  sourceId: "source",
  documentKey: "source",
  documentVersion: "v1",
  title: "Manual municipal",
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

const validAuthorityIds = new Set(loadDomainPack("municipal-antigua").sourceAuthorityClasses.map((item) => item.id));

describe("source inventory domain metadata mapping", () => {
  it("maps declarative authority classes to valid domain pack authority ids", () => {
    const cases = [
      record(),
      record({ title: "PDM-OT Antigua Guatemala", category: "planning" }),
      record({ title: "POA Antigua Guatemala", category: "planning" }),
      record({ title: "Código Municipal", category: "national_law", authorityClass: "official_national", authorityLevel: "national", sourceJurisdiction: "República de Guatemala" }),
      record({ title: "Ley de Contrataciones", category: "national_law", authorityClass: "official_national", authorityLevel: "national", sourceJurisdiction: "República de Guatemala" }),
      record({ title: "Manual Mixco", authorityClass: "external_reference", authorityLevel: "comparative", sourceJurisdiction: "Municipio de Mixco", municipality: "mixco", officialForTargetJurisdiction: false }),
    ];

    for (const source of cases) {
      const domainClass = sourceInventoryAuthorityToDomainClass(source);
      assert.equal(validAuthorityIds.has(domainClass), true, domainClass);
      assert.equal(sourceInventoryRecordToDomainMetadata(source).sourceAuthorityClass, domainClass);
    }
  });

  it("preserves explicit inventory authority in tags while using valid domain ids", () => {
    const source = record({ authorityClass: "official_municipal" });
    const metadata = sourceInventoryRecordToDomainMetadata(source);

    assert.equal(metadata.sourceAuthorityClass, "municipal_manual");
    assert.ok(metadata.tags?.includes("inventory_authority:official_municipal"));
    assert.ok(metadata.tags?.includes("official_for_target:true"));
  });
});
