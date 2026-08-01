import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { createClamAvScannerFromEnv } from "../sources/artifactSafety.js";
import { acquireSourcePackHtml } from "../sources/htmlAcquisition.js";
import { parseHtmlAcquisitionPlan } from "../sources/htmlAcquisitionPolicy.js";
import { validateSourceInventory } from "../sources/sourceInventory.js";
import { parseSourceInventoryManifest } from "../sources/sourceInventoryManifest.js";
import { parseSourcePack, validateSourcePackInventoryBindings } from "../sources/sourcePack.js";

const value = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const atomicJson = async (path: string, input: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.part-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, `${JSON.stringify(input, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
};

const configPath = value("--config") ?? "config/acquisition-packs/guatemala-municipal-core-html.json";
const packPath = value("--source-pack") ?? "config/source-packs/guatemala-municipal-core.json";
const inventoryPath = value("--inventory") ?? ".rag/source-inventory.json";
const receiptPath = value("--receipt") ?? "program/reports/2026-08-01-official-source-acquisition.json";
const libraryRoot = value("--library-root") ?? process.env.SOURCE_PACK_LIBRARY_ROOT;
if (!libraryRoot || !isAbsolute(libraryRoot)) throw new Error("An absolute --library-root or SOURCE_PACK_LIBRARY_ROOT is required.");

const [planText, packText, inventoryText] = await Promise.all([
  readFile(configPath, "utf8"),
  readFile(packPath, "utf8"),
  readFile(inventoryPath, "utf8"),
]);
const plan = parseHtmlAcquisitionPlan(JSON.parse(planText) as unknown);
const pack = parseSourcePack(packText);
const inventory = parseSourceInventoryManifest(inventoryText);
const inventoryValidation = validateSourceInventory(inventory.records);
if (!inventoryValidation.valid) throw new Error(inventoryValidation.failures.map((item) => `${item.sourceId ?? "inventory"}: ${item.message}`).join("\n"));
const binding = validateSourcePackInventoryBindings(pack, inventory.records);
if (!binding.valid) throw new Error(binding.failures.map((item) => `${item.path}: ${item.message}`).join("\n"));
const scanner = createClamAvScannerFromEnv(process.env);
if (!scanner) throw new Error("A real ClamAV scanner is required; set DOCUMENT_MALWARE_SCANNER=clamscan or clamdscan.");

const result = await acquireSourcePackHtml({
  plan,
  pack,
  inventory,
  libraryRoot: resolve(libraryRoot),
  dependencies: { scanner },
});
await atomicJson(receiptPath, result.receipt);
if (result.receipt.result === "pass") {
  const nextValidation = validateSourceInventory(result.inventory.records);
  if (!nextValidation.valid) throw new Error(nextValidation.failures.map((item) => `${item.sourceId ?? "inventory"}: ${item.message}`).join("\n"));
  await atomicJson(inventoryPath, result.inventory);
}
console.log(JSON.stringify({
  status: result.receipt.result,
  acquisitionId: result.receipt.acquisitionId,
  attempted: result.receipt.attempted,
  successful: result.receipt.successful,
  blocked: result.receipt.blocked,
  inventoryUpdated: result.receipt.result === "pass",
  libraryRoot: resolve(libraryRoot),
  receiptPath,
}));
if (result.receipt.result !== "pass") process.exitCode = 1;
