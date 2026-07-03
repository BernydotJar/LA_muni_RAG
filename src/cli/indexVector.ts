import "dotenv/config";
import { indexVectorSource, formatVectorIndexingResult } from "../ingestion/vectorIndexing.js";

interface ParsedArgs {
  inputPath?: string;
  title?: string;
  documentKey?: string;
  documentVersion?: string;
  help: boolean;
}

const usage = `Usage:
  node --import tsx src/cli/indexVector.ts --input path/to/document.md [--title "Document Title"] [--document-key key] [--document-version v1]

Options:
  --input              Source document path to index.
  --title              Optional document title override.
  --document-key       Optional stable document key. Defaults to input path.
  --document-version   Optional document version. Defaults to v1.
  --help               Show this help text.
`;

const parseArgs = (args: string[]): ParsedArgs => {
  const parsed: ParsedArgs = { help: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--input") {
      parsed.inputPath = next;
      index += 1;
      continue;
    }

    if (arg === "--title") {
      parsed.title = next;
      index += 1;
      continue;
    }

    if (arg === "--document-key") {
      parsed.documentKey = next;
      index += 1;
      continue;
    }

    if (arg === "--document-version") {
      parsed.documentVersion = next;
      index += 1;
      continue;
    }
  }

  return parsed;
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(usage);
    return;
  }

  const result = await indexVectorSource({
    inputPath: args.inputPath ?? "",
    title: args.title,
    documentKey: args.documentKey,
    documentVersion: args.documentVersion,
  });

  console.log(formatVectorIndexingResult(result));

  if (result.status !== "indexed") {
    process.exitCode = 1;
  }
};

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        status: "failed",
        failures: [
          {
            code: "vector_indexing_cli_failed",
            message: error instanceof Error ? error.message : String(error),
            retryable: true,
          },
        ],
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
