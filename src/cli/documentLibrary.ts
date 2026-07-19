import "dotenv/config";
import {
  formatDocumentLibraryOperationResult,
  importLocalArtifact,
  ingestLibraryArtifact,
  type ImportLocalArtifactInput,
  type IngestLibraryArtifactInput,
} from "../sources/documentLibraryOperations.js";

export type DocumentLibraryCommand = "import" | "ingest";

export interface DocumentLibraryCliArgs {
  command?: DocumentLibraryCommand;
  inventoryPath?: string;
  corpusManifestPath?: string;
  sourceId?: string;
  inputPath?: string;
  libraryRoot?: string;
  documentVersion?: string;
  mediaType?: string;
  dryRun: boolean;
  help: boolean;
}

export const usage = `Usage:
  npm run document-library -- import --inventory .rag/source-inventory.json --source-id SOURCE --input FILE --library-root .rag/library --document-version VERSION [--media-type TYPE] [--dry-run]
  npm run document-library -- ingest --inventory .rag/source-inventory.json --corpus-manifest .rag/corpus-manifest.json --source-id SOURCE [--dry-run]

Commands:
  import   Copy a local artifact into the bounded document library and record acquisition evidence.
  ingest   Extract and index an acquired artifact, reconcile manifests, and record ingestion evidence.

Safety:
  - No network acquisition is performed.
  - --dry-run never copies, indexes, or writes manifests.
  - Version and hash conflicts fail closed.
`;

const valueFlags = new Set([
  "--inventory",
  "--corpus-manifest",
  "--source-id",
  "--input",
  "--library-root",
  "--document-version",
  "--media-type",
]);

export const parseDocumentLibraryArgs = (argv: string[]): DocumentLibraryCliArgs => {
  const parsed: DocumentLibraryCliArgs = { dryRun: false, help: false };
  const [command, ...args] = argv;
  if (command === "import" || command === "ingest") parsed.command = command;
  else if (command === "--help" || command === "-h" || command === undefined) parsed.help = true;
  else throw new Error(`Unsupported document library command: ${command}.`);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (!valueFlags.has(arg)) throw new Error(`Unknown argument: ${arg}.`);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}.`);
    if (arg === "--inventory") parsed.inventoryPath = value;
    if (arg === "--corpus-manifest") parsed.corpusManifestPath = value;
    if (arg === "--source-id") parsed.sourceId = value;
    if (arg === "--input") parsed.inputPath = value;
    if (arg === "--library-root") parsed.libraryRoot = value;
    if (arg === "--document-version") parsed.documentVersion = value;
    if (arg === "--media-type") parsed.mediaType = value;
    index += 1;
  }

  return parsed;
};

const requireValue = (value: string | undefined, code: string): string => {
  if (!value?.trim()) throw new Error(code);
  return value;
};

const toImportInput = (args: DocumentLibraryCliArgs): ImportLocalArtifactInput => {
  const input: ImportLocalArtifactInput = {
    inventoryPath: requireValue(args.inventoryPath, "missing_inventory"),
    sourceId: requireValue(args.sourceId, "missing_source_id"),
    inputPath: requireValue(args.inputPath, "missing_input"),
    libraryRoot: requireValue(args.libraryRoot, "missing_library_root"),
    documentVersion: requireValue(args.documentVersion, "missing_document_version"),
    dryRun: args.dryRun,
  };
  if (args.mediaType) input.mediaType = args.mediaType;
  return input;
};

const toIngestInput = (args: DocumentLibraryCliArgs): IngestLibraryArtifactInput => ({
  inventoryPath: requireValue(args.inventoryPath, "missing_inventory"),
  corpusManifestPath: requireValue(args.corpusManifestPath, "missing_corpus_manifest"),
  sourceId: requireValue(args.sourceId, "missing_source_id"),
  dryRun: args.dryRun,
});

export const runDocumentLibraryCli = async (args: DocumentLibraryCliArgs): Promise<number> => {
  if (args.help) {
    console.log(usage);
    return 0;
  }
  if (args.command === "import") {
    const result = await importLocalArtifact(toImportInput(args));
    console.log(formatDocumentLibraryOperationResult(result));
    return result.status === "failed" ? 1 : 0;
  }
  if (args.command === "ingest") {
    const result = await ingestLibraryArtifact(toIngestInput(args));
    console.log(formatDocumentLibraryOperationResult(result));
    return result.status === "failed" ? 1 : 0;
  }
  throw new Error("missing_command");
};

const main = async (): Promise<void> => {
  const exitCode = await runDocumentLibraryCli(parseDocumentLibraryArgs(process.argv.slice(2)));
  process.exitCode = exitCode;
};

if (process.argv[1]?.endsWith("documentLibrary.ts") || process.argv[1]?.endsWith("documentLibrary.js")) {
  void main().catch((error) => {
    console.error(JSON.stringify({
      status: "failed",
      failures: [{
        code: "document_library_cli_failed",
        message: error instanceof Error ? error.message : String(error),
      }],
    }, null, 2));
    process.exitCode = 1;
  });
}
