import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { WATER_RESEARCH_CATEGORIES } from "../domain/packs/municipal-antigua-water.js";
import type { SourceInventoryRecord } from "../sources/sourceInventory.js";
import { parseSourceInventoryManifest } from "../sources/sourceInventoryManifest.js";
import {
  parseSourcePack,
  validateSourcePackInventoryBindings,
  type SourcePackManifest,
} from "../sources/sourcePack.js";

const inventory = async () => parseSourceInventoryManifest(await readFile(".rag/source-inventory.json", "utf8"));
const nationalPack = async () => parseSourcePack(await readFile("config/source-packs/guatemala-municipal-core.json", "utf8"));

const NEW_SOURCE_IDS = [
  "guatemala-mafim-second-edition",
  "marn-environmental-taxonomy",
  "marn-environmental-category-a",
  "marn-environmental-category-b1",
  "marn-environmental-category-b2",
  "segeplan-snip-standards-2027",
  "mspas-water-health-authority",
  "mspas-water-project-quality-certification",
  "guatecompras-use-rules-2022",
] as const;

const clonePack = (pack: SourcePackManifest): SourcePackManifest => structuredClone(pack);
const cloneInventory = (records: SourceInventoryRecord[]): SourceInventoryRecord[] => structuredClone(records);

describe("official national source coverage pack v1", () => {
  it("binds every non-template source to the governed inventory and covers required tags", async () => {
    const [manifest, pack] = await Promise.all([inventory(), nationalPack()]);
    const validation = validateSourcePackInventoryBindings(pack, manifest.records);
    assert.deepEqual(validation, { valid: true, failures: [] });

    const boundIds = pack.connectors.flatMap((connector) => connector.sourceInventoryIds);
    for (const sourceId of NEW_SOURCE_IDS) assert.ok(boundIds.includes(sourceId), `missing source-pack binding for ${sourceId}`);
  });

  it("keeps nine official sources within governed discovery or acquisition states without indexing", async () => {
    const manifest = await inventory();
    const records = new Map(manifest.records.map((record) => [record.sourceId, record]));
    for (const sourceId of NEW_SOURCE_IDS) {
      const record = records.get(sourceId);
      assert.ok(record, `missing inventory record ${sourceId}`);
      assert.ok(["verified", "ingestion_pending"].includes(record.status), `${sourceId} has invalid status ${record.status}`);
      assert.equal(record.authorityClass, "official_national");
      assert.equal(record.authorityLevel, "national");
      assert.equal(record.officialSource, true);
      assert.equal(record.officialForTargetJurisdiction, true);
      assert.equal(record.indexing, undefined);
      if (record.status === "verified") {
        assert.equal(record.acquisition, undefined);
        assert.equal(record.artifactSafety, undefined);
        assert.equal(record.extraction, undefined);
      } else {
        assert.ok(record.acquisition?.contentSha256);
        assert.equal(record.artifactSafety?.verdict, "clean");
        assert.ok((record.extraction?.sectionCount ?? 0) > 0);
      }
      assert.ok(record.limitations.some((item) => /no (?:prueba|acredita)|no contiene todavía|no constituye|no establece por sí sola/i.test(item)));
    }
  });

  it("uses the taxative list as the environmental entry point and keeps categories as candidates", async () => {
    const pack = await nationalPack();
    assert.equal(pack.connectors.some((connector) => connector.connectorId === "marn-environmental-category-c"), false);
    const connector = pack.connectors.find((item) => item.connectorId === "marn-environmental-classification");
    assert.ok(connector);
    assert.equal(connector.discoveryUrl, "https://www.marn.gob.gt/listados-taxativos/");
    assert.deepEqual(connector.sourceInventoryIds, [
      "marn-environmental-taxonomy",
      "marn-environmental-category-a",
      "marn-environmental-category-b1",
      "marn-environmental-category-b2",
      "marn-environmental-category-c",
    ]);

    const manifest = await inventory();
    for (const sourceId of connector.sourceInventoryIds.filter((id) => id !== "marn-environmental-taxonomy")) {
      const record = manifest.records.find((item) => item.sourceId === sourceId);
      assert.ok(record?.limitations.some((item) => /no implica|depende del listado taxativo|categoría aplicable depende/i.test(item)));
    }
  });

  it("gives all 47 categories concrete required evidence and keeps academy fallback in parity", async () => {
    const curriculum = JSON.parse(await readFile("public/data/water-training-map.json", "utf8")) as {
      research_categories: Array<{ label: string; required_evidence: string[]; evidence_prompt: string }>;
    };
    assert.equal(WATER_RESEARCH_CATEGORIES.length, 47);
    assert.equal(curriculum.research_categories.length, 47);
    const byLabel = new Map(curriculum.research_categories.map((category) => [category.label, category]));

    for (const category of WATER_RESEARCH_CATEGORIES) {
      assert.ok(category.requiredEvidence.length > 0, `${category.title} has no required evidence`);
      assert.ok(category.requiredEvidence.every((item) => !/^Documento o evidencia verificable sobre/i.test(item)));
      const staticCategory = byLabel.get(category.title);
      assert.ok(staticCategory, `academy category missing for ${category.title}`);
      assert.deepEqual(staticCategory.required_evidence, category.requiredEvidence);
      assert.match(staticCategory.evidence_prompt, /^Localizar y validar:/);
    }

    const environment = WATER_RESEARCH_CATEGORIES.find((item) => item.title === "Ambiente");
    assert.ok(environment?.requiredEvidence.some((item) => /Listado Taxativo vigente/i.test(item)));
    assert.equal(environment?.requiredEvidence.some((item) => /categoría C$/i.test(item)), false);
  });

  it("fails closed on unknown IDs, duplicate bindings, uncovered required tags and host mismatch", async () => {
    const [manifest, basePack] = await Promise.all([inventory(), nationalPack()]);

    const unknown = clonePack(basePack);
    unknown.connectors[0]!.sourceInventoryIds.push("source-that-does-not-exist");
    assert.ok(validateSourcePackInventoryBindings(unknown, manifest.records).failures.some((failure) => /does not exist/i.test(failure.message)));

    const duplicate = clonePack(basePack);
    duplicate.connectors[1]!.sourceInventoryIds.push(duplicate.connectors[0]!.sourceInventoryIds[0]!);
    assert.ok(validateSourcePackInventoryBindings(duplicate, manifest.records).failures.some((failure) => /already bound/i.test(failure.message)));

    const uncovered = clonePack(basePack);
    uncovered.requiredCoverageTags.push("uncovered-policy-tag");
    assert.ok(validateSourcePackInventoryBindings(uncovered, manifest.records).failures.some((failure) => /not supplied/i.test(failure.message)));

    const mismatchedInventory = cloneInventory(manifest.records);
    const target = mismatchedInventory.find((record) => record.sourceId === basePack.connectors[0]!.sourceInventoryIds[0]);
    assert.ok(target);
    target.publicUrl = "https://unapproved.example/source";
    assert.ok(validateSourcePackInventoryBindings(basePack, mismatchedInventory).failures.some((failure) => /not allowed/i.test(failure.message)));
  });

  it("renders the exact source class in the public academy fallback", async () => {
    const script = await readFile("public/procedure-training.js", "utf8");
    assert.match(script, /required_evidence/);
    assert.match(script, /Fuente requerida:/);
    assert.match(script, /concreteRequirements/);
    assert.match(script, /category-required-source/);
  });
});
