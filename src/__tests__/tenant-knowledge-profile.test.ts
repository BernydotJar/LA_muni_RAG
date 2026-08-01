import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { parseSourcePack, type SourcePackManifest } from "../sources/sourcePack.js";
import { parseTenantKnowledgeProfile, validateTenantKnowledgeProfile } from "../tenancy/tenantKnowledgeProfile.js";

const sourcePackFiles = [
  "config/source-packs/guatemala-municipal-core.json",
  "config/source-packs/antigua-guatemala-2026.json",
  "config/source-packs/templates/enterprise-governance.json",
];

const sourcePacks = async (): Promise<Map<string, SourcePackManifest>> => {
  const values = await Promise.all(sourcePackFiles.map(async (file) => parseSourcePack(await readFile(file, "utf8"))));
  return new Map(values.map((pack) => [pack.packId, pack]));
};

describe("tenant knowledge profiles", () => {
  it("binds a municipality to municipal and national source packs and preserves an enterprise template", async () => {
    const packs = await sourcePacks();
    const antigua = parseTenantKnowledgeProfile(await readFile("config/tenant-profiles/antigua-guatemala.json", "utf8"), packs);
    const enterprise = parseTenantKnowledgeProfile(await readFile("config/tenant-profiles/templates/enterprise-governance.json", "utf8"), packs);
    assert.equal(antigua.domainPackId, "municipal-antigua");
    assert.deepEqual(antigua.sourcePackIds, ["antigua-guatemala-2026", "guatemala-municipal-core"]);
    assert.equal(enterprise.organizationType, "enterprise");
    assert.equal(enterprise.isTemplate, true);
  });

  it("fails closed when a production tenant references a template source pack or mismatched domain", async () => {
    const packs = await sourcePacks();
    const validation = validateTenantKnowledgeProfile({
      schemaVersion: 1,
      profileId: "unsafe-tenant",
      displayName: "Unsafe",
      organizationType: "municipality",
      isTemplate: false,
      jurisdiction: "Guatemala",
      language: "es-GT",
      domainPackId: "finance",
      sourcePackIds: ["enterprise-governance-template", "antigua-guatemala-2026"],
      publicAccess: true,
      branding: {
        productName: "Unsafe",
        assistantName: "Unsafe",
        organizationName: "Unsafe",
        primaryLabel: "Unsafe"
      }
    }, packs);
    assert.equal(validation.valid, false);
    assert.ok(validation.failures.some((failure) => /template-only/i.test(failure.message)));
    assert.ok(validation.failures.some((failure) => /requires domain pack municipal-antigua/i.test(failure.message)));
  });
});
