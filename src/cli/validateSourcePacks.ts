import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateSourceInventory } from "../sources/sourceInventory.js";
import { parseSourceInventoryManifest } from "../sources/sourceInventoryManifest.js";
import { parseSourcePack, validateSourcePackInventoryBindings } from "../sources/sourcePack.js";

const root = process.argv[2] ?? "config/source-packs";
const inventoryPath = process.argv[3] ?? ".rag/source-inventory.json";
const files: string[] = [];

const visit = async (path: string): Promise<void> => {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) await visit(target);
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(target);
  }
};

await visit(root);
if (files.length === 0) throw new Error(`No source packs found under ${root}.`);
const inventory = parseSourceInventoryManifest(await readFile(inventoryPath, "utf8"));
const inventoryValidation = validateSourceInventory(inventory.records);
if (!inventoryValidation.valid) {
  throw new Error(inventoryValidation.failures.map((failure) => `${failure.sourceId ?? "inventory"}: ${failure.message}`).join("\n"));
}

let boundSourceCount = 0;
for (const file of files.sort()) {
  const pack = parseSourcePack(await readFile(file, "utf8"));
  const binding = validateSourcePackInventoryBindings(pack, inventory.records);
  if (!binding.valid) {
    throw new Error(binding.failures.map((failure) => `${file}:${failure.path}: ${failure.message}`).join("\n"));
  }
  if (!pack.isTemplate) boundSourceCount += pack.connectors.flatMap((connector) => connector.sourceInventoryIds).length;
}
console.log(JSON.stringify({
  status: "pass",
  sourcePackCount: files.length,
  boundSourceCount,
  inventoryPath,
  files: files.sort(),
}));
