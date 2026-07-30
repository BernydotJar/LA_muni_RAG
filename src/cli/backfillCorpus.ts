import "dotenv/config";
import { readFile } from "node:fs/promises";
import { detectFormat } from "../ingestion/detectFormat.js";
import type { SourceFormat } from "../ingestion/types.js";
import { IngestionError } from "../ingestion/types.js";
import { buildDomainDocumentMetadata } from "../domain/documentMetadata.js";
import type { DomainDocumentMetadata } from "../domain/types.js";
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
  domainPackId?: string;
  sourceAuthorityClass?: string;
  documentType?: string;
  jurisdiction?: string;
  organization?: string;
  confidentiality?: string;
  tags?: string[];
  dryRun: boolean;
  help: boolean;
}

export type ValidBackfillCorpusArgs = BackfillCorpusArgs & {
  manifestPath: string;
  inputPath: string;
  documentKey: string;
  documentVersion: string;
};

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
  documentMetadata: DomainDocumentMetadata;
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
                       Raw PDFs are not accepted here; use document-library inspect and ingest.
  --domain-pack        Optional domain pack id. Defaults to municipal-antigua.
  --source-authority-class
                       Optional source authority class from the selected domain pack.
  --document-type      Optional domain document type. Defaults to source format.
  --jurisdiction       Optional jurisdiction label.
  --organization       Optional source organization label.
  --confidentiality    Optional confidentiality: public, internal, restricted.
  --tag                Optional repeatable metadata tag.
  --dry-run            Show the manifest decision without indexing or writing the manifest.
  --help               Show this help text.
`;

const requiresValue = (flag: string): boolean =>
  [
    "--manifest",
    "--input",
    "--document-key",
    "--document-version",
    "--title",
    "--source-format",
    "--domain-pack",
    "--source-authority-class",
    "--document-type",
    "--jurisdiction",
    "--organization",
    "--confidentiality",
    "--tag",
  ].includes(flag);

const parseSourceFormat = (value: string): SourceFormat => {
  if (SOURCE_FORMATS.includes(value as SourceFormat)) return value as SourceFormat;
  throw new Error(`Unsupported source format: ${value}`);
};

export const isBackfillCorpusDryRunResult = (
  result: CorpusBackfillResult | BackfillCorpusDryRunResult
): result is BackfillCorpusDryRunResult => "dryRun" in result;

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
    if (arg === "--domain-pack") parsed.domainPackId = next;
    if (arg === "--source-authority-class") parsed.sourceAuthorityClass = next;
    if (arg === "--document-type") parsed.documentType = next;
    if (arg === "--jurisdiction") parsed.jurisdiction = next;
    if (arg === "--organization") parsed.organization = next;
    if (arg === "--confidentiality") parsed.confidentiality = next;
    if (arg === "--tag") parsed.tags = [...(parsed.tags ?? []), next];

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

const toValidBackfillCorpusArgs = (args: BackfillCorpusArgs): ValidBackfillCorpusArgs => {
  const validation = validateBackfillCorpusArgs(args);
  if (!validation.valid) {
    throw new Error(`Invalid corpus backfill arguments: ${validation.failures.join(", ")}.`);
  }

  return {
    ...args,
    manifestPath: args.manifestPath as string,
    inputPath: args.inputPath as string,
    documentKey: args.documentKey as string,
    documentVersion: args.documentVersion as string,
  };
};

const buildDocumentInput = async (
  args: ValidBackfillCorpusArgs,
  runtimeMetadata: BackfillCorpusRuntimeMetadata
): Promise<CorpusBackfillDocumentInput> => {
  const detectedFormat = detectFormat(args.inputPath);
  const sourceFormat = args.sourceFormat ?? detectedFormat;
  if (sourceFormat !== detectedFormat) {
    throw new IngestionError(
      "document_source_format_mismatch",
      detectedFormat,
      "Declared source format does not match the input path."
    );
  }
  if (detectedFormat === "pdf") {
    throw new IngestionError(
      "pdf_requires_document_library",
      "pdf",
      "Raw PDF backfill requires accepted document-library safety evidence and normalized extraction."
    );
  }
  const metadata = buildDomainDocumentMetadata(
    {
      domainPackId: args.domainPackId,
      sourceAuthorityClass: args.sourceAuthorityClass,
      documentType: args.documentType,
      jurisdiction: args.jurisdiction,
      organization: args.organization,
      confidentiality: args.confidentiality,
      tags: args.tags,
    },
    sourceFormat
  );
  const content = await readFile(args.inputPath);
  const document: CorpusBackfillDocumentInput = {
    inputPath: args.inputPath,
    documentKey: args.documentKey,
    documentVersion: args.documentVersion,
    sourceFormat,
    content,
    embeddingProvider: runtimeMetadata.embeddingProvider,
    embeddingModel: runtimeMetadata.embeddingModel,
    embeddingDimension: runtimeMetadata.embeddingDimension,
    metadata,
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
    `- domain-pack: ${result.documentMetadata.domainPackId}`,
    `- source-authority-class: ${result.documentMetadata.sourceAuthorityClass}`,
    `- document-type: ${result.documentMetadata.documentType}`,
  ].join("\n");

const redactBackfillCliMessage = (message: string): string =>
  message
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]")
    .replace(/https?:\/\/\S+/gi, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[_-]?key|token|password|secret)=\S+/gi, "[redacted]");

const requireDocumentMetadata = (metadata: DomainDocumentMetadata | undefined): DomainDocumentMetadata => {
  if (!metadata) throw new Error("Domain document metadata was not built.");
  return metadata;
};

export const formatBackfillCorpusError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify(
    {
      status: "failed",
      failures: [
        {
          code: error instanceof IngestionError ? error.code : "corpus_backfill_cli_failed",
          message: redactBackfillCliMessage(message),
          retryable: error instanceof IngestionError ? error.retryable : false,
        },
      ],
    },
    null,
    2
  );
};

export const runBackfillCorpusDryRun = async (
  args: ValidBackfillCorpusArgs,
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
    documentMetadata: requireDocumentMetadata(document.metadata),
  };
};

export const runBackfillCorpus = async (
  args: BackfillCorpusArgs,
  runtimeMetadata: BackfillCorpusRuntimeMetadata = resolveBackfillRuntimeMetadata()
): Promise<CorpusBackfillResult | BackfillCorpusDryRunResult> => {
  const validArgs = toValidBackfillCorpusArgs(args);

  if (validArgs.dryRun) {
    return runBackfillCorpusDryRun(validArgs, runtimeMetadata);
  }

  const manifestStore = new JsonFileCorpusManifestStore(validArgs.manifestPath);
  const document = await buildDocumentInput(validArgs, runtimeMetadata);
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
  console.log(isBackfillCorpusDryRunResult(result) ? formatBackfillCorpusDryRunResult(result) : formatBackfillCorpusResult(result));

  if (!isBackfillCorpusDryRunResult(result) && result.documentsFailed > 0) {
    process.exitCode = 1;
  }
};

if (process.argv[1]?.endsWith("backfillCorpus.ts") || process.argv[1]?.endsWith("backfillCorpus.js")) {
  void main().catch((error) => {
    console.error(formatBackfillCorpusError(error));
    process.exitCode = 1;
  });
}
