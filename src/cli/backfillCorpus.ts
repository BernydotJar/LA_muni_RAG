import "dotenv/config";
import { readFile } from "node:fs/promises";
import { detectFormat } from "../ingestion/detectFormat.js";
import type { SourceFormat } from "../ingestion/types.js";
import {
  backfillCorpusManifest,
  computeCorpusContentSha256,
  decideCorpusBackfill,
  JsonFileCorpusManifestStore,
  type CorpusBackfillDecision,
  type CorpusBackfillDocumentInput,
  type CorpusBackfillResult,
} from "../ingestion/corpusManifest.js";
import { indexVectorSource } from "../ingestion/vectorIndexing.js";
import { loadQueryEmbeddingProviderConfig } from "../embeddings/queryEmbeddingFactory.js";

const SOURCE_FORMATS: SourceFormat[] = ["markdown", "txt", "docx", "pdf"];

export interface BackfillCorpusArgs {
  manifestPath?: string;
  inputPath?: string;
  documentKey?: string;
  documentVersion?: string;
  title?: string;
  sourceFormat?: SourceFormat;
  dryRun: boolean;
  help: boolean;
}

export interface BackfillCorpusValidationResult {
  valid: boolean;
  failures: string[];
}

export interface BackfillCorpusRuntimeMetadata {
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: number;
}

export interface BackfillCorpusDryRunResult {
  dryRun: true;
  documentKey: string;
  decision: CorpusBackfillDecision;
  existingRecordFound: boolean;
  contentSha256: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimension: number;
}

export const usage = `Usage:
  node --import tsx src/cli/backfillCorpus.ts --manifest .rag/corpus-manifest.json --input corpus/document.md --document-key key --document-version v1

Options:
  --manifest           Path to the persistent corpus manifest JSON file.
  --input              Source document path to backfill.
  --document-key       Stable document key.
  --document-version   Document version.
  --title              Optional document title override.
  --source-format      Optional source format: markdown, txt, docx, pdf.
  --dry-run            Show the manifest decision without indexing or writing the manifest.
  --help               Show this help text.
`;

const requiresValue = (flag: string): boolean =>
  ["--manifest", "--input", "--document-key", "--document-version", "--title", "--source-format"].includes(flag);

const parseSourceFormat = (value: string): SourceFormat => {
  if (SOURCE_FORMATS.includes(value as SourceFormat)) return value as SourceFormat;
  throw new Error(`Unsupported source format: ${value}`);
};

export const parseBackfillCorpusArgs = (args: string[]): BackfillCorpusArgs => {
  const parsed: BackfillCorpusArgs = { dryRun: false, help: false };

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

    if (!requiresValue(arg)) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for ${arg}.`);
    }

    if (arg === "--manifest") parsed.manifestPath = next;
    if (arg === "--input") parsed.inputPath = next;
    if (arg === "--document-key") parsed.documentKey = next;
    if (arg === "--document-version") parsed.documentVersion = next;
    if (arg === "--title") parsed.title = next;
    if (arg === "--source-format") parsed.sourceFormat = parseSourceFormat(next);

    index += 1;
  }

  return parsed;
};

export const validateBackfillCorpusArgs = (args: BackfillCorpusArgs): BackfillCorpusValidationResult => {
  const failures: string[] = [];
  if (!args.manifestPath?.trim()) failures.push("missing_manifest");
  if (!args.inputPath?.trim()) failures.push("missing_input");
  if (!args.documentKey?.trim()) failures.push("missing_document_key");
  if (!args.documentVersion?.trim()) failures.push("missing_document_version");
  return { valid: failures.length === 0, failures };
};

export const resolveBackfillRuntimeMetadata = (
  env: NodeJS.ProcessEnv = process.env
): BackfillCorpusRuntimeMetadata => {
  const config = loadQueryEmbeddingProviderConfig(env);
  return {
    embeddingProvider: config.provider ?? "unknown",
    embeddingModel: config.model ?? "unknown",
    embeddingDimension: config.dimensions ?? 0,
  };
};

const requireValidBackfillArgs = (args: BackfillCorpusArgs): asserts args is BackfillCorpusArgs & {
  manifestPath: string;
  inputPath: string;
  documentKey: string;
  documentVersion: string;
} => {
  const validation = validateBackfillCorpusArgs(args);
  if (!validation.valid) {
    throw new Error(`Invalid corpus backfill arguments: ${validation.failures.join(", ")}.`);
  }
};

const buildDocumentInput = async (
  args: BackfillCorpusArgs & {
    inputPath: string;
    documentKey: string;
    documentVersion: string;
  },
  runtimeMetadata: BackfillCorpusRuntimeMetadata
): Promise<CorpusBackfillDocumentInput> => {
  const content = await readFile(args.inputPath, "utf-8");
  const sourceFormat = args.sourceFormat ?? detectFormat(args.inputPath);
  const document: CorpusBackfillDocumentInput = {
    inputPath: args.inputPath,
    documentKey: args.documentKey,
    documentVersion: args.documentVersion,
    sourceFormat,
    content,
    embeddingProvider: runtimeMetadata.embeddingProvider,
    embeddingModel: runtimeMetadata.embeddingModel,
    embeddingDimension: runtimeMetadata.embeddingDimension,
  };
  if (args.title !== undefined) document.title = args.title;
  return document;
};

export const formatBackfillCorpusResult = (result: CorpusBackfillResult): string => {
  const lines = [
    "Corpus backfill result",
    `- considered: ${result.documentsConsidered}`,
    `- indexed: ${result.documentsIndexed}`,
    `- skipped: ${result.documentsSkipped}`,
    `- stale: ${result.documentsStale}`,
    `- failed: ${result.documentsFailed}`,
    "",
    "Documents",
    ...result.results.map(
      (document) =>
        `- ${document.documentKey}: status=${document.status} decision=${document.decision} failureCodes=[${document.failureCodes.join(",")}]`
    ),
  ];
  return lines.join("\n");
};

export const formatBackfillCorpusDryRunResult = (result: BackfillCorpusDryRunResult): string =>
  [
    "Corpus backfill dry run",
    `- document-key: ${result.documentKey}`,
    `- decision: ${result.decision}`,
    `- existing-record: ${result.existingRecordFound ? "yes" : "no"}`,
    `- content-sha256: ${result.contentSha256}`,
    `- embedding-provider: ${result.embeddingProvider}`,
    `- embedding-model: ${result.embeddingModel}`,
    `- embedding-dimension: ${result.embeddingDimension}`,
  ].join("\n");

const redactBackfillCliMessage = (message: string): string =>
  message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]")
    .replace(/https?:\/\/\S+/gi, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[_-]?key|token|password|secret)=\S+/gi, "[redacted]");

export const formatBackfillCorpusError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify(
    {
      status: "failed",
      failures: [
        {
          code: "corpus_backfill_cli_failed",
          message: redactBackfillCliMessage(message),
          retryable: false,
        },
      ],
    },
    null,
    2
  );
};

export const runBackfillCorpusDryRun = async (
  args: BackfillCorpusArgs & {
    manifestPath: string;
    inputPath: string;
    documentKey: string;
    documentVersion: string;
  },
  runtimeMetadata: BackfillCorpusRuntimeMetadata = resolveBackfillRuntimeMetadata()
): Promise<BackfillCorpusDryRunResult> => {
  const manifestStore = new JsonFileCorpusManifestStore(args.manifestPath);
  const document = await buildDocumentInput(args, runtimeMetadata);
  const existingRecord = await manifestStore.get(document.documentKey);
  const contentSha256 = computeCorpusContentSha256(document.content);
  return {
    dryRun: true,
    documentKey: document.documentKey,
    decision: decideCorpusBackfill({ existingRecord, document, contentSha256 }),
    existingRecordFound: existingRecord !== null,
    contentSha256,
    embeddingProvider: document.embeddingProvider,
    embeddingModel: document.embeddingModel,
    embeddingDimension: document.embeddingDimension,
  };
};

export const runBackfillCorpus = async (
  args: BackfillCorpusArgs,
  runtimeMetadata: BackfillCorpusRuntimeMetadata = resolveBackfillRuntimeMetadata()
): Promise<CorpusBackfillResult | BackfillCorpusDryRunResult> => {
  requireValidBackfillArgs(args);

  if (args.dryRun) {
    return runBackfillCorpusDryRun(args, runtimeMetadata);
  }

  const manifestStore = new JsonFileCorpusManifestStore(args.manifestPath);
  const document = await buildDocumentInput(args, runtimeMetadata);
  return backfillCorpusManifest(
    { documents: [document] },
    {
      manifestStore,
      indexVectorSource,
    }
  );
};

const main = async (): Promise<void> => {
  const args = parseBackfillCorpusArgs(process.argv.slice(2));

  if (args.help) {
    console.log(usage);
    return;
  }

  const result = await runBackfillCorpus(args);
  console.log(result.dryRun ? formatBackfillCorpusDryRunResult(result) : formatBackfillCorpusResult(result));

  if (!result.dryRun && result.documentsFailed > 0) {
    process.exitCode = 1;
  }
};

if (process.argv[1]?.endsWith("backfillCorpus.ts") || process.argv[1]?.endsWith("backfillCorpus.js")) {
  void main().catch((error) => {
    console.error(formatBackfillCorpusError(error));
    process.exitCode = 1;
  });
}
