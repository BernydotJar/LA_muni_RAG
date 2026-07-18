import { loadSourceInventoryManifest } from "../sources/sourceInventoryManifest.js";

export interface ValidateSourceInventoryArgs {
  manifestPath: string;
}

export const parseValidateSourceInventoryArgs = (args: string[]): ValidateSourceInventoryArgs => {
  const manifestIndex = args.indexOf("--manifest");
  const manifestPath = manifestIndex >= 0 ? args[manifestIndex + 1] : undefined;
  if (!manifestPath?.trim()) {
    throw new Error("Usage: node --import tsx src/cli/validateSourceInventory.ts --manifest .rag/source-inventory.json");
  }
  return { manifestPath };
};

export const formatSourceInventoryValidation = async (manifestPath: string): Promise<string> => {
  const loaded = await loadSourceInventoryManifest(manifestPath);
  return JSON.stringify(
    {
      status: loaded.validation.valid ? "valid" : "invalid",
      targetJurisdiction: loaded.manifest.targetJurisdiction,
      summary: loaded.summary,
      failures: loaded.validation.failures,
    },
    null,
    2
  );
};

const main = async (): Promise<void> => {
  const { manifestPath } = parseValidateSourceInventoryArgs(process.argv.slice(2));
  const loaded = await loadSourceInventoryManifest(manifestPath);
  console.log(await formatSourceInventoryValidation(manifestPath));
  if (!loaded.validation.valid) process.exitCode = 1;
};

if (process.argv[1]?.endsWith("validateSourceInventory.ts") || process.argv[1]?.endsWith("validateSourceInventory.js")) {
  void main().catch((error) => {
    console.error(JSON.stringify({ status: "failed", message: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  });
}
