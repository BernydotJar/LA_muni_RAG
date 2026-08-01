import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { parseSourcePack, validateSourcePack } from "../sources/sourcePack.js";

const files = [
  "config/source-packs/guatemala-municipal-core.json",
  "config/source-packs/antigua-guatemala-2026.json",
  "config/source-packs/templates/enterprise-governance.json",
];

describe("source packs", () => {
  it("validates municipal, national and enterprise-template packs", async () => {
    const packs = await Promise.all(files.map(async (file) => parseSourcePack(await readFile(file, "utf8"))));
    assert.equal(packs.length, 3);
    assert.equal(packs[1]?.organizationType, "municipality");
    assert.equal(packs[2]?.organizationType, "enterprise");
    assert.equal(packs[2]?.isTemplate, true);
  });

  it("fails closed on credentials, unapproved hosts and duplicate connectors", () => {
    const invalid = {
      schemaVersion: 1,
      packId: "unsafe-pack",
      displayName: "Unsafe",
      organizationType: "enterprise",
      isTemplate: false,
      jurisdiction: "Tenant",
      allowedHosts: ["example.com"],
      requiredCoverageTags: ["compliance"],
      connectors: [
        {
          connectorId: "source",
          type: "html_page",
          title: "Unsafe source",
          discoveryUrl: "https://user:secret@evil.example/policy",
          allowedHosts: ["evil.example"],
          sourceInventoryIds: ["policy"],
          coverageTags: ["compliance"],
          acceptedMediaTypes: ["text/html"],
          refresh: { cadence: "monthly", maximumAgeDays: 30 },
          enabled: true,
        },
        {
          connectorId: "source",
          type: "html_page",
          title: "Duplicate",
          discoveryUrl: "https://example.com/policy",
          allowedHosts: ["example.com"],
          sourceInventoryIds: ["policy-two"],
          coverageTags: ["compliance"],
          acceptedMediaTypes: ["text/html"],
          refresh: { cadence: "monthly", maximumAgeDays: 30 },
          enabled: true,
        }
      ]
    };
    const validation = validateSourcePack(invalid);
    assert.equal(validation.valid, false);
    assert.ok(validation.failures.some((failure) => /credentials|HTTPS/i.test(failure.message)));
    assert.ok(validation.failures.some((failure) => /also be allowed/i.test(failure.message)));
    assert.ok(validation.failures.some((failure) => /unique/i.test(failure.message)));
  });
});
