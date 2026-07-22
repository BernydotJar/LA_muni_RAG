import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCitationLabel } from "../citation.js";
import { normalizeWhitespace } from "../normalize.js";
import type { DocumentExtractor, ExtractorInput, NormalizedDocument, NormalizedSection } from "../types.js";
import { IngestionError } from "../types.js";

const MIB = 1024 * 1024;
const KIB = 1024;

export const PDF_EXTRACTION_PROTOCOL_VERSION = 1;

export interface PdfExtractionPolicy {
  maxInputBytes: number;
  timeoutMs: number;
  maxPages: number;
  maxPageTextBytes: number;
  maxTotalTextBytes: number;
  maxOutputBytes: number;
  maxStderrBytes: number;
  memoryMb: number;
  maxConcurrency: number;
}

export const DEFAULT_PDF_EXTRACTION_POLICY: PdfExtractionPolicy = {
  maxInputBytes: 64 * MIB,
  timeoutMs: 120_000,
  maxPages: 1_000,
  maxPageTextBytes: 256 * KIB,
  maxTotalTextBytes: 8 * MIB,
  maxOutputBytes: 34 * MIB,
  maxStderrBytes: 64 * KIB,
  memoryMb: 512,
  maxConcurrency: 1,
};

const HARD_MAX_PDF_INPUT_BYTES = 100 * MIB;
const HARD_MAX_PDF_TIMEOUT_MS = 300_000;
const HARD_MAX_PDF_PAGES = 5_000;
const HARD_MAX_PAGE_TEXT_BYTES = 1 * MIB;
const HARD_MAX_TOTAL_TEXT_BYTES = 32 * MIB;
const HARD_MAX_OUTPUT_BYTES = 64 * MIB;
const HARD_MAX_PDF_MEMORY_MB = 1_024;
const HARD_MAX_PDF_CONCURRENCY = 4;

const parseBoundedInteger = (
  value: string | undefined,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number
): number => {
  if (value === undefined || value.trim() === "") return fallback;
  if (!/^\d+$/.test(value.trim())) throw new Error(`${name} must be an integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
};

export const loadPdfExtractionPolicy = (
  env: NodeJS.ProcessEnv = process.env
): PdfExtractionPolicy => {
  const maxPages = parseBoundedInteger(
    env.PDF_EXTRACTION_MAX_PAGES,
    DEFAULT_PDF_EXTRACTION_POLICY.maxPages,
    "PDF_EXTRACTION_MAX_PAGES",
    1,
    HARD_MAX_PDF_PAGES
  );
  const maxTotalTextBytes = parseBoundedInteger(
    env.PDF_EXTRACTION_MAX_TOTAL_TEXT_BYTES,
    DEFAULT_PDF_EXTRACTION_POLICY.maxTotalTextBytes,
    "PDF_EXTRACTION_MAX_TOTAL_TEXT_BYTES",
    1 * KIB,
    HARD_MAX_TOTAL_TEXT_BYTES
  );
  const calculatedOutputBytes = Math.min(
    HARD_MAX_OUTPUT_BYTES,
    maxTotalTextBytes * 4 + maxPages * 512 + 1 * MIB
  );

  return {
    maxInputBytes: parseBoundedInteger(
      env.PDF_EXTRACTION_MAX_INPUT_BYTES,
      DEFAULT_PDF_EXTRACTION_POLICY.maxInputBytes,
      "PDF_EXTRACTION_MAX_INPUT_BYTES",
      1 * KIB,
      HARD_MAX_PDF_INPUT_BYTES
    ),
    timeoutMs: parseBoundedInteger(
      env.PDF_EXTRACTION_TIMEOUT_MS,
      DEFAULT_PDF_EXTRACTION_POLICY.timeoutMs,
      "PDF_EXTRACTION_TIMEOUT_MS",
      1_000,
      HARD_MAX_PDF_TIMEOUT_MS
    ),
    maxPages,
    maxPageTextBytes: parseBoundedInteger(
      env.PDF_EXTRACTION_MAX_PAGE_TEXT_BYTES,
      DEFAULT_PDF_EXTRACTION_POLICY.maxPageTextBytes,
      "PDF_EXTRACTION_MAX_PAGE_TEXT_BYTES",
      1 * KIB,
      HARD_MAX_PAGE_TEXT_BYTES
    ),
    maxTotalTextBytes,
    maxOutputBytes: calculatedOutputBytes,
    maxStderrBytes: DEFAULT_PDF_EXTRACTION_POLICY.maxStderrBytes,
    memoryMb: parseBoundedInteger(
      env.PDF_EXTRACTION_MEMORY_MB,
      DEFAULT_PDF_EXTRACTION_POLICY.memoryMb,
      "PDF_EXTRACTION_MEMORY_MB",
      128,
      HARD_MAX_PDF_MEMORY_MB
    ),
    maxConcurrency: parseBoundedInteger(
      env.PDF_EXTRACTION_MAX_CONCURRENCY,
      DEFAULT_PDF_EXTRACTION_POLICY.maxConcurrency,
      "PDF_EXTRACTION_MAX_CONCURRENCY",
      1,
      HARD_MAX_PDF_CONCURRENCY
    ),
  };
};

export type PdfExtractionFailureCode =
  | "pdf_binary_input_required"
  | "pdf_input_empty"
  | "pdf_input_too_large"
  | "pdf_signature_invalid"
  | "pdf_encrypted"
  | "pdf_malformed"
  | "pdf_no_extractable_text"
  | "pdf_page_limit_exceeded"
  | "pdf_page_text_limit_exceeded"
  | "pdf_text_limit_exceeded"
  | "pdf_output_limit_exceeded"
  | "pdf_worker_stderr_limit_exceeded"
  | "pdf_timeout"
  | "pdf_worker_unavailable"
  | "pdf_worker_crashed"
  | "pdf_worker_protocol_error"
  | "pdf_worker_capacity_exceeded";

const PDF_FAILURES: Record<PdfExtractionFailureCode, { message: string; retryable: boolean }> = {
  pdf_binary_input_required: { message: "PDF extraction requires verified binary input.", retryable: false },
  pdf_input_empty: { message: "PDF input is empty.", retryable: false },
  pdf_input_too_large: { message: "PDF input exceeds the extraction limit.", retryable: false },
  pdf_signature_invalid: { message: "PDF input does not have a valid bounded signature.", retryable: false },
  pdf_encrypted: { message: "Encrypted PDFs are not accepted for extraction.", retryable: false },
  pdf_malformed: { message: "PDF parsing failed on malformed input.", retryable: false },
  pdf_no_extractable_text: { message: "PDF contains no extractable text.", retryable: false },
  pdf_page_limit_exceeded: { message: "PDF page count exceeds the extraction limit.", retryable: false },
  pdf_page_text_limit_exceeded: { message: "PDF page text exceeds the extraction limit.", retryable: false },
  pdf_text_limit_exceeded: { message: "PDF total text exceeds the extraction limit.", retryable: false },
  pdf_output_limit_exceeded: { message: "PDF worker output exceeds the extraction limit.", retryable: false },
  pdf_worker_stderr_limit_exceeded: { message: "PDF worker diagnostics exceeded the safety limit.", retryable: false },
  pdf_timeout: { message: "PDF extraction exceeded the wall-clock limit.", retryable: false },
  pdf_worker_unavailable: { message: "PDF extraction worker is unavailable.", retryable: true },
  pdf_worker_crashed: { message: "PDF extraction worker exited unexpectedly.", retryable: true },
  pdf_worker_protocol_error: { message: "PDF extraction worker returned an invalid result.", retryable: false },
  pdf_worker_capacity_exceeded: { message: "PDF extraction capacity is currently exhausted.", retryable: true },
};

const pdfFailure = (code: PdfExtractionFailureCode, cause?: unknown): IngestionError => {
  const definition = PDF_FAILURES[code];
  return new IngestionError(code, "pdf", definition.message, {
    cause,
    retryable: definition.retryable,
  });
};

export interface PdfWorkerPage {
  page: number;
  text: string;
}

export interface PdfWorkerSuccess {
  schemaVersion: 1;
  ok: true;
  parser: "pdfjs-dist";
  parserVersion: string;
  pageCount: number;
  pages: PdfWorkerPage[];
}

export interface PdfWorkerFailure {
  schemaVersion: 1;
  ok: false;
  code: PdfExtractionFailureCode;
}

export type PdfWorkerResult = PdfWorkerSuccess | PdfWorkerFailure;

export interface PdfExtractionWorkerOptions {
  workerUrl?: URL;
}

let activePdfProcesses = 0;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const exactKeys = (value: Record<string, unknown>, allowed: string[]): boolean => {
  const keys = Object.keys(value).sort();
  const expected = [...allowed].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
};

const isPdfFailureCode = (value: unknown): value is PdfExtractionFailureCode =>
  typeof value === "string" && Object.hasOwn(PDF_FAILURES, value);

export const validateWorkerResult = (
  value: unknown,
  policy: PdfExtractionPolicy
): PdfWorkerResult => {
  if (!isObject(value) || value.schemaVersion !== PDF_EXTRACTION_PROTOCOL_VERSION || typeof value.ok !== "boolean") {
    throw pdfFailure("pdf_worker_protocol_error");
  }

  if (value.ok === false) {
    if (!exactKeys(value, ["schemaVersion", "ok", "code"]) || !isPdfFailureCode(value.code)) {
      throw pdfFailure("pdf_worker_protocol_error");
    }
    return value as unknown as PdfWorkerFailure;
  }

  if (
    !exactKeys(value, ["schemaVersion", "ok", "parser", "parserVersion", "pageCount", "pages"]) ||
    value.parser !== "pdfjs-dist" ||
    typeof value.parserVersion !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(value.parserVersion) ||
    !Number.isSafeInteger(value.pageCount) ||
    Number(value.pageCount) <= 0 ||
    Number(value.pageCount) > policy.maxPages ||
    !Array.isArray(value.pages) ||
    value.pages.length === 0 ||
    value.pages.length > Number(value.pageCount)
  ) {
    throw pdfFailure("pdf_worker_protocol_error");
  }

  let previousPage = 0;
  let totalTextBytes = 0;
  for (const page of value.pages) {
    if (
      !isObject(page) ||
      !exactKeys(page, ["page", "text"]) ||
      !Number.isSafeInteger(page.page) ||
      Number(page.page) <= previousPage ||
      Number(page.page) > Number(value.pageCount) ||
      typeof page.text !== "string" ||
      page.text.length === 0
    ) {
      throw pdfFailure("pdf_worker_protocol_error");
    }
    const pageBytes = Buffer.byteLength(page.text, "utf8");
    if (pageBytes > policy.maxPageTextBytes) throw pdfFailure("pdf_page_text_limit_exceeded");
    totalTextBytes += pageBytes;
    if (totalTextBytes > policy.maxTotalTextBytes) throw pdfFailure("pdf_text_limit_exceeded");
    previousPage = Number(page.page);
  }

  return value as unknown as PdfWorkerSuccess;
};

const defaultWorkerUrl = (): URL =>
  new URL("../../../scripts/pdf-extraction-worker.mjs", import.meta.url);

const resolveWorkerPaths = (workerUrl: URL): {
  workerPath: string;
  pdfjsRoot: string;
  napiScopeRoot: string;
} => {
  const require = createRequire(import.meta.url);
  const pdfjsEntry = require.resolve("pdfjs-dist/legacy/build/pdf.mjs");
  const canvasEntry = require.resolve("@napi-rs/canvas");
  return {
    workerPath: fileURLToPath(workerUrl),
    pdfjsRoot: resolve(dirname(pdfjsEntry), "../.."),
    napiScopeRoot: resolve(dirname(canvasEntry), ".."),
  };
};

export const buildPdfWorkerArguments = (
  policy: PdfExtractionPolicy,
  workerUrl: URL = defaultWorkerUrl()
): string[] => {
  const paths = resolveWorkerPaths(workerUrl);
  return [
    `--max-old-space-size=${policy.memoryMb}`,
    "--stack-size=4096",
    "--permission",
    "--allow-addons",
    `--allow-fs-read=${paths.workerPath}`,
    `--allow-fs-read=${paths.pdfjsRoot}`,
    `--allow-fs-read=${paths.napiScopeRoot}`,
    paths.workerPath,
    JSON.stringify({
      schemaVersion: PDF_EXTRACTION_PROTOCOL_VERSION,
      maxInputBytes: policy.maxInputBytes,
      maxPages: policy.maxPages,
      maxPageTextBytes: policy.maxPageTextBytes,
      maxTotalTextBytes: policy.maxTotalTextBytes,
      maxOutputBytes: policy.maxOutputBytes,
    }),
  ];
};

const parseWorkerStdout = (chunks: Buffer[], policy: PdfExtractionPolicy): PdfWorkerResult => {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch (error) {
    throw pdfFailure("pdf_worker_protocol_error", error);
  }

  try {
    return validateWorkerResult(JSON.parse(text) as unknown, policy);
  } catch (error) {
    if (error instanceof IngestionError) throw error;
    throw pdfFailure("pdf_worker_protocol_error", error);
  }
};

export const runPdfExtractionWorker = async (
  content: Buffer,
  policy: PdfExtractionPolicy,
  options: PdfExtractionWorkerOptions = {}
): Promise<PdfWorkerResult> => {
  if (activePdfProcesses >= policy.maxConcurrency) {
    throw pdfFailure("pdf_worker_capacity_exceeded");
  }
  activePdfProcesses += 1;

  let workingDirectory: string | undefined;
  try {
    workingDirectory = await mkdtemp(join(tmpdir(), "la-muni-pdf-"));
    const args = buildPdfWorkerArguments(policy, options.workerUrl ?? defaultWorkerUrl());
    const child = spawn(process.execPath, args, {
      cwd: workingDirectory,
      env: {
        NODE_ENV: "production",
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8",
        TZ: "UTC",
        UV_THREADPOOL_SIZE: "1",
      },
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    return await new Promise<PdfWorkerResult>((resolvePromise, rejectPromise) => {
      const stdoutChunks: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let forcedFailure: IngestionError | undefined;

      const forceStop = (failure: IngestionError): void => {
        if (forcedFailure) return;
        forcedFailure = failure;
        child.kill("SIGKILL");
      };

      const timer = setTimeout(() => {
        forceStop(pdfFailure("pdf_timeout"));
      }, policy.timeoutMs);
      timer.unref();

      child.stdout.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        stdoutBytes += buffer.byteLength;
        if (stdoutBytes > policy.maxOutputBytes) {
          forceStop(pdfFailure("pdf_output_limit_exceeded"));
          return;
        }
        stdoutChunks.push(buffer);
      });

      child.stderr.on("data", (chunk: Buffer | string) => {
        stderrBytes += Buffer.isBuffer(chunk) ? chunk.byteLength : Buffer.byteLength(chunk);
        if (stderrBytes > policy.maxStderrBytes) {
          forceStop(pdfFailure("pdf_worker_stderr_limit_exceeded"));
        }
      });

      child.once("error", (error) => {
        forcedFailure ??= pdfFailure("pdf_worker_unavailable", error);
      });

      child.once("close", (code, signal) => {
        clearTimeout(timer);
        if (forcedFailure) {
          rejectPromise(forcedFailure);
          return;
        }
        if (code !== 0 || signal !== null) {
          rejectPromise(pdfFailure("pdf_worker_crashed"));
          return;
        }
        try {
          resolvePromise(parseWorkerStdout(stdoutChunks, policy));
        } catch (error) {
          rejectPromise(error);
        }
      });

      child.stdin.once("error", (error: NodeJS.ErrnoException) => {
        if (error.code !== "EPIPE") forceStop(pdfFailure("pdf_worker_crashed", error));
      });
      child.stdin.end(content);
    });
  } finally {
    activePdfProcesses -= 1;
    if (workingDirectory) await rm(workingDirectory, { recursive: true, force: true });
  }
};

const hasBoundedPdfSignature = (content: Buffer): boolean => {
  const header = content.subarray(0, Math.min(content.length, 8)).toString("ascii");
  const trailer = content.subarray(Math.max(0, content.length - 2048)).toString("latin1");
  return /^%PDF-\d\.\d/.test(header) && trailer.includes("%%EOF");
};

export interface RawPdfExtractorDependencies {
  env?: NodeJS.ProcessEnv;
  policy?: PdfExtractionPolicy;
  runWorker?: (content: Buffer, policy: PdfExtractionPolicy) => Promise<PdfWorkerResult>;
}

export const extractRawPdf = async (
  input: ExtractorInput,
  dependencies: RawPdfExtractorDependencies = {}
): Promise<NormalizedDocument> => {
  if (!Buffer.isBuffer(input.content)) throw pdfFailure("pdf_binary_input_required");
  const policy = dependencies.policy ?? loadPdfExtractionPolicy(dependencies.env);
  if (input.content.byteLength === 0) throw pdfFailure("pdf_input_empty");
  if (input.content.byteLength > policy.maxInputBytes) throw pdfFailure("pdf_input_too_large");
  if (!hasBoundedPdfSignature(input.content)) throw pdfFailure("pdf_signature_invalid");

  const verifiedCopy = Buffer.from(input.content);
  const workerResult = await (dependencies.runWorker ?? runPdfExtractionWorker)(verifiedCopy, policy);
  const result = validateWorkerResult(workerResult, policy);
  if (!result.ok) throw pdfFailure(result.code);

  const sections: NormalizedSection[] = result.pages.map(({ page, text }) => {
    const normalizedText = normalizeWhitespace(text);
    const heading = `Pagina ${page}`;
    return {
      heading,
      sectionType: "page",
      sectionPath: [heading],
      text: normalizedText,
      pageStart: page,
      pageEnd: page,
      articleNumber: null,
      citationLabel: buildCitationLabel({ title: input.title, pageStart: page }),
      metadata: {
        ordinal: page,
        contentSha256: createHash("sha256").update(normalizedText, "utf8").digest("hex"),
        extractor: "pdfjs_isolated_process_v1",
        parser: result.parser,
        parserVersion: result.parserVersion,
      },
    };
  });

  return {
    title: input.title,
    sourceFormat: "pdf",
    text: sections.map((section) => section.text).join("\n\n"),
    sections,
    metadata: {
      ...(input.metadata ?? {}),
      sourcePath: input.sourcePath ?? null,
      extractor: "pdfjs_isolated_process_v1",
      parser: result.parser,
      parserVersion: result.parserVersion,
      pageCount: result.pageCount,
      extractedPageCount: sections.length,
      resourcePolicy: {
        maxInputBytes: policy.maxInputBytes,
        timeoutMs: policy.timeoutMs,
        maxPages: policy.maxPages,
        maxPageTextBytes: policy.maxPageTextBytes,
        maxTotalTextBytes: policy.maxTotalTextBytes,
      },
    },
  };
};

export const rawPdfExtractor: DocumentExtractor = {
  sourceFormat: "pdf",
  extract: extractRawPdf,
};
