#!/usr/bin/env node

const PROTOCOL_VERSION = 1;
const FAILURE_CODES = new Set([
  "pdf_input_empty",
  "pdf_input_too_large",
  "pdf_encrypted",
  "pdf_malformed",
  "pdf_no_extractable_text",
  "pdf_page_limit_exceeded",
  "pdf_page_text_limit_exceeded",
  "pdf_text_limit_exceeded",
  "pdf_output_limit_exceeded",
]);

const failure = (code) => ({ schemaVersion: PROTOCOL_VERSION, ok: false, code });

const isPositiveSafeInteger = (value) => Number.isSafeInteger(value) && value > 0;

const parsePolicy = () => {
  let value;
  try {
    value = JSON.parse(process.argv[2] ?? "");
  } catch {
    throw new Error("invalid_policy");
  }
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    value.schemaVersion !== PROTOCOL_VERSION ||
    !isPositiveSafeInteger(value.maxInputBytes) ||
    !isPositiveSafeInteger(value.maxPages) ||
    !isPositiveSafeInteger(value.maxPageTextBytes) ||
    !isPositiveSafeInteger(value.maxTotalTextBytes) ||
    !isPositiveSafeInteger(value.maxOutputBytes)
  ) {
    throw new Error("invalid_policy");
  }
  return value;
};

const normalizeText = (value) => {
  const lines = value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u0000/g, "")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""));
  const compact = [];
  let previousBlank = false;
  for (const line of lines) {
    const blank = line.trim().length === 0;
    if (blank && previousBlank) continue;
    compact.push(line);
    previousBlank = blank;
  }
  return compact.join("\n").trim();
};

const readBoundedStdin = async (maxInputBytes) => {
  const chunks = [];
  let byteLength = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteLength += buffer.byteLength;
    if (byteLength > maxInputBytes) return null;
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, byteLength);
};

const errorCode = (error) => {
  const name = typeof error?.name === "string" ? error.name : "";
  if (name === "PasswordException") return "pdf_encrypted";
  if (
    name === "InvalidPDFException" ||
    name === "MissingPDFException" ||
    name === "UnexpectedResponseException" ||
    name === "FormatError"
  ) {
    return "pdf_malformed";
  }
  return "pdf_malformed";
};

const pageText = (textContent, maxPageTextBytes) => {
  const parts = [];
  let rawBytes = 0;
  for (const item of textContent.items ?? []) {
    if (typeof item !== "object" || item === null || typeof item.str !== "string") continue;
    const suffix = item.hasEOL === true ? "\n" : " ";
    rawBytes += Buffer.byteLength(item.str, "utf8") + Buffer.byteLength(suffix, "utf8");
    if (rawBytes > maxPageTextBytes) return null;
    parts.push(item.str, suffix);
  }
  const normalized = normalizeText(parts.join(""));
  return Buffer.byteLength(normalized, "utf8") <= maxPageTextBytes ? normalized : null;
};

const emit = (result, maxOutputBytes) => {
  const output = JSON.stringify(result);
  if (Buffer.byteLength(output, "utf8") > maxOutputBytes) {
    process.stdout.write(JSON.stringify(failure("pdf_output_limit_exceeded")));
    return;
  }
  process.stdout.write(output);
};

const extract = async (policy, bytes) => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfjsEntry = import.meta.resolve("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfjsRoot = new URL("../../", pdfjsEntry);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    cMapUrl: new URL("cmaps/", pdfjsRoot).pathname,
    cMapPacked: true,
    standardFontDataUrl: new URL("standard_fonts/", pdfjsRoot).pathname,
    iccUrl: new URL("iccs/", pdfjsRoot).pathname,
    useWorkerFetch: false,
    useWasm: false,
    stopAtErrors: true,
    maxImageSize: 1,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    fontExtraProperties: false,
    enableXfa: false,
    verbosity: 0,
  });

  let document;
  try {
    document = await loadingTask.promise;
    if (!isPositiveSafeInteger(document.numPages)) return failure("pdf_malformed");
    if (document.numPages > policy.maxPages) return failure("pdf_page_limit_exceeded");

    const pages = [];
    let totalTextBytes = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const textContent = await page.getTextContent({
          includeMarkedContent: false,
          disableNormalization: false,
        });
        const text = pageText(textContent, policy.maxPageTextBytes);
        if (text === null) return failure("pdf_page_text_limit_exceeded");
        if (!text) continue;
        totalTextBytes += Buffer.byteLength(text, "utf8");
        if (totalTextBytes > policy.maxTotalTextBytes) return failure("pdf_text_limit_exceeded");
        pages.push({ page: pageNumber, text });
      } finally {
        page.cleanup();
      }
    }

    if (pages.length === 0) return failure("pdf_no_extractable_text");
    return {
      schemaVersion: PROTOCOL_VERSION,
      ok: true,
      parser: "pdfjs-dist",
      parserVersion: pdfjs.version,
      pageCount: document.numPages,
      pages,
    };
  } finally {
    await loadingTask.destroy();
  }
};

const main = async () => {
  let policy;
  try {
    policy = parsePolicy();
  } catch {
    emit(failure("pdf_malformed"), 1024);
    return;
  }

  const bytes = await readBoundedStdin(policy.maxInputBytes);
  if (bytes === null) {
    emit(failure("pdf_input_too_large"), policy.maxOutputBytes);
    return;
  }
  if (bytes.byteLength === 0) {
    emit(failure("pdf_input_empty"), policy.maxOutputBytes);
    return;
  }

  try {
    const result = await extract(policy, bytes);
    emit(result, policy.maxOutputBytes);
  } catch (error) {
    const code = errorCode(error);
    emit(failure(FAILURE_CODES.has(code) ? code : "pdf_malformed"), policy.maxOutputBytes);
  }
};

await main();
