import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPdfWorkerArguments,
  DEFAULT_PDF_EXTRACTION_POLICY,
  extractRawPdf,
  loadPdfExtractionPolicy,
  runPdfExtractionWorker,
  type PdfExtractionPolicy,
  type PdfWorkerResult,
} from "../ingestion/extractors/rawPdfExtractor.js";
import { IngestionError } from "../ingestion/types.js";
import { buildPdf } from "./fixtures/buildPdf.js";

// Generated once from a blank one-page PDF with a fixture-only password.
const ENCRYPTED_PDF = Buffer.from(
  "JVBERi0xLjMKJeLjz9MKMSAwIG9iago8PAovUHJvZHVjZXIgPDQ0MzBiZDgyNTU+Cj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9UeXBlIC9QYWdlcwovQ291bnQgMQovS2lkcyBbIDQgMCBSIF0KPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL1BhZ2VzIDIgMCBSCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9UeXBlIC9QYWdlCi9SZXNvdXJjZXMgPDwKPj4KL01lZGlhQm94IFsgMC4wIDAuMCA2MTIgNzkyIF0KL1BhcmVudCAyIDAgUgo+PgplbmRvYmoKNSAwIG9iago8PAovViAyCi9SIDMKL0xlbmd0aCAxMjgKL1AgNDI5NDk2NzI5MgovRmlsdGVyIC9TdGFuZGFyZAovTyA8Yzk0YmZlNjYwYTQ2YjNmOWQ3NWNiYzBkZDEwZDg1NTdjNjY3YzYxOWNkNjA3NjFhODdiNDZhOWFjMDg0ZTU2Nj4KL1UgPDU4MjE0YzJmYzQzMThiMDQ2MTlkY2RiODE2OTVkODFjMjhiZjRlNWU0ZTc1OGE0MTY0MDA0ZTU2ZmZmYTAxMDg+Cj4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA1OSAwMDAwMCBuIAowMDAwMDAwMTE4IDAwMDAwIG4gCjAwMDAwMDAxNjcgMDAwMDAgbiAKMDAwMDAwMDI2MSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDYKL1Jvb3QgMyAwIFIKL0luZm8gMSAwIFIKL0lEIFsgPDM1NjEzMTMyNjIzNzY0MzczODM1NjEzNjY0MzUzNTM3MzUzNjM5NjI2MjM3MzA2NDMyMzQzMjMyNjEzNzMwMzk+IDwzNTYxMzEzMjYyMzc2NDM3MzgzNTYxMzY2NDM1MzUzNzM1MzYzOTYyNjIzNzMwNjQzMjM0MzIzMjYxMzczMDM5PiBdCi9FbmNyeXB0IDUgMCBSCj4+CnN0YXJ0eHJlZgo0NzYKJSVFT0YK",
  "base64"
);

const testPolicy = (overrides: Partial<PdfExtractionPolicy> = {}): PdfExtractionPolicy => ({
  ...DEFAULT_PDF_EXTRACTION_POLICY,
  maxInputBytes: 1_048_576,
  timeoutMs: 5_000,
  maxPages: 10,
  maxPageTextBytes: 65_536,
  maxTotalTextBytes: 262_144,
  maxOutputBytes: 1_048_576,
  maxStderrBytes: 16_384,
  memoryMb: 128,
  maxConcurrency: 1,
  ...overrides,
});

const expectIngestionCode = async (
  run: () => Promise<unknown>,
  code: string
): Promise<void> => {
  await assert.rejects(run, (error: unknown) =>
    error instanceof IngestionError && error.code === code);
};

describe("isolated raw PDF extraction", () => {
  it("extracts text from PDF bytes in the real bounded worker", async () => {
    const document = await extractRawPdf({
      title: "Fixture PDF",
      sourcePath: "fixture.pdf",
      content: buildPdf("Hello PDF"),
    }, { policy: testPolicy() });

    assert.equal(document.sourceFormat, "pdf");
    assert.equal(document.sections.length, 1);
    assert.match(document.sections[0]?.text ?? "", /Hello PDF/);
    assert.equal(document.sections[0]?.pageStart, 1);
    assert.equal(document.metadata.extractor, "pdfjs_isolated_process_v1");
    assert.equal(document.metadata.parser, "pdfjs-dist");
    assert.match(String(document.metadata.parserVersion), /^6\.1\.200$/);
  });

  it("maps malformed and text-free PDFs to stable non-retryable failures", async () => {
    await expectIngestionCode(
      () => extractRawPdf({
        title: "Malformed",
        sourcePath: "malformed.pdf",
        content: Buffer.from("%PDF-1.4\nnot-an-object\n%%EOF\n", "ascii"),
      }, { policy: testPolicy() }),
      "pdf_malformed"
    );
    await expectIngestionCode(
      () => extractRawPdf({
        title: "No text",
        sourcePath: "no-text.pdf",
        content: buildPdf(""),
      }, { policy: testPolicy() }),
      "pdf_no_extractable_text"
    );
  });

  it("rejects non-binary, oversized, and encrypted inputs with stable codes", async () => {
    await expectIngestionCode(
      () => extractRawPdf({ title: "Text", sourcePath: "text.pdf", content: "%PDF-1.4\n%%EOF" }),
      "pdf_binary_input_required"
    );
    const valid = buildPdf("Bounded");
    await expectIngestionCode(
      () => extractRawPdf(
        { title: "Large", sourcePath: "large.pdf", content: valid },
        { policy: testPolicy({ maxInputBytes: valid.byteLength - 1 }) }
      ),
      "pdf_input_too_large"
    );
    await expectIngestionCode(
      () => extractRawPdf(
        { title: "Encrypted", sourcePath: "encrypted.pdf", content: ENCRYPTED_PDF },
        { policy: testPolicy() }
      ),
      "pdf_encrypted"
    );
  });

  it("validates injected worker results through the same strict protocol", async () => {
    await expectIngestionCode(
      () => extractRawPdf(
        { title: "Invalid", sourcePath: "invalid.pdf", content: buildPdf("Invalid") },
        {
          policy: testPolicy(),
          runWorker: async () => ({
            schemaVersion: 1,
            ok: true,
            extra: "unexpected",
          } as unknown as PdfWorkerResult),
        }
      ),
      "pdf_worker_protocol_error"
    );
  });

  it("enforces page and text expansion limits at the parent protocol boundary", async () => {
    const content = buildPdf("Expansion");
    await expectIngestionCode(
      () => extractRawPdf(
        { title: "Pages", sourcePath: "pages.pdf", content },
        {
          policy: testPolicy(),
          runWorker: async () => ({
            schemaVersion: 1,
            ok: false,
            code: "pdf_page_limit_exceeded",
          }),
        }
      ),
      "pdf_page_limit_exceeded"
    );
    await expectIngestionCode(
      () => extractRawPdf(
        { title: "Page text", sourcePath: "page-text.pdf", content },
        {
          policy: testPolicy({ maxPageTextBytes: 32 }),
          runWorker: async () => ({
            schemaVersion: 1,
            ok: true,
            parser: "pdfjs-dist",
            parserVersion: "6.1.200",
            pageCount: 1,
            pages: [{ page: 1, text: "x".repeat(33) }],
          }),
        }
      ),
      "pdf_page_text_limit_exceeded"
    );
    await expectIngestionCode(
      () => extractRawPdf(
        { title: "Total text", sourcePath: "total-text.pdf", content },
        {
          policy: testPolicy({ maxPageTextBytes: 64, maxTotalTextBytes: 100 }),
          runWorker: async () => ({
            schemaVersion: 1,
            ok: true,
            parser: "pdfjs-dist",
            parserVersion: "6.1.200",
            pageCount: 2,
            pages: [
              { page: 1, text: "x".repeat(60) },
              { page: 2, text: "y".repeat(60) },
            ],
          }),
        }
      ),
      "pdf_text_limit_exceeded"
    );
  });

  it("kills workers that hang or exceed stdout and stderr limits", async () => {
    const content = buildPdf("Limits");
    await expectIngestionCode(
      () => runPdfExtractionWorker(content, testPolicy({ timeoutMs: 100 }), {
        workerUrl: new URL("./fixtures/pdf-worker-hang.mjs", import.meta.url),
      }),
      "pdf_timeout"
    );
    await expectIngestionCode(
      () => runPdfExtractionWorker(content, testPolicy({ maxOutputBytes: 1_024 }), {
        workerUrl: new URL("./fixtures/pdf-worker-flood.mjs", import.meta.url),
      }),
      "pdf_output_limit_exceeded"
    );
    await expectIngestionCode(
      () => runPdfExtractionWorker(content, testPolicy({ maxStderrBytes: 1_024 }), {
        workerUrl: new URL("./fixtures/pdf-worker-stderr-flood.mjs", import.meta.url),
      }),
      "pdf_worker_stderr_limit_exceeded"
    );
    await expectIngestionCode(
      () => runPdfExtractionWorker(content, testPolicy(), {
        workerUrl: new URL("./fixtures/pdf-worker-crash.mjs", import.meta.url),
      }),
      "pdf_worker_crashed"
    );
  });

  it("rejects invalid worker JSON and does not grant filesystem writes or child processes", async () => {
    await expectIngestionCode(
      () => runPdfExtractionWorker(buildPdf("Protocol"), testPolicy(), {
        workerUrl: new URL("./fixtures/pdf-worker-invalid.mjs", import.meta.url),
      }),
      "pdf_worker_protocol_error"
    );

    const args = buildPdfWorkerArguments(testPolicy());
    assert.ok(args.includes("--permission"));
    assert.ok(args.includes("--allow-addons"));
    assert.ok(args.some((arg) => arg.startsWith("--allow-fs-read=")));
    assert.ok(!args.some((arg) => arg.startsWith("--allow-fs-write")));
    assert.ok(!args.includes("--allow-child-process"));
    assert.ok(!args.includes("--allow-worker"));
  });

  it("accepts only bounded extraction policy values", () => {
    const policy = loadPdfExtractionPolicy({
      PDF_EXTRACTION_MAX_INPUT_BYTES: "1048576",
      PDF_EXTRACTION_TIMEOUT_MS: "5000",
      PDF_EXTRACTION_MAX_PAGES: "25",
      PDF_EXTRACTION_MAX_PAGE_TEXT_BYTES: "65536",
      PDF_EXTRACTION_MAX_TOTAL_TEXT_BYTES: "262144",
      PDF_EXTRACTION_MEMORY_MB: "256",
      PDF_EXTRACTION_MAX_CONCURRENCY: "2",
    });
    assert.equal(policy.maxPages, 25);
    assert.equal(policy.memoryMb, 256);
    assert.equal(policy.maxConcurrency, 2);
    assert.throws(() => loadPdfExtractionPolicy({ PDF_EXTRACTION_MAX_PAGES: "5001" }));
    assert.throws(() => loadPdfExtractionPolicy({ PDF_EXTRACTION_TIMEOUT_MS: "unbounded" }));
    assert.throws(() => loadPdfExtractionPolicy({ PDF_EXTRACTION_MAX_CONCURRENCY: "5" }));
  });
});
