import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ArtifactSafetyError,
  ClamAvCommandScanner,
  createClamAvScannerFromEnv,
  inspectArtifactContent,
  loadArtifactSafetyPolicy,
  type ScannerCommandResult,
  type ScannerCommandRunner,
} from "../sources/artifactSafety.js";

const PDF_BYTES = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n", "ascii");

const commandResult = (overrides: Partial<ScannerCommandResult> = {}): ScannerCommandResult => ({
  exitCode: 0,
  stdout: "",
  stderr: "",
  timedOut: false,
  ...overrides,
});

describe("artifact structural safety inspection", () => {
  it("binds a PDF extension, declaration, header, and trailer", () => {
    const result = inspectArtifactContent({
      content: PDF_BYTES,
      sourcePath: "manual.pdf",
      declaredMediaType: "application/pdf; charset=binary",
    });

    assert.deepEqual(result, {
      byteLength: PDF_BYTES.byteLength,
      declaredMediaType: "application/pdf",
      detectedMediaType: "application/pdf",
      signature: "pdf-header-eof-v1",
    });
  });

  it("rejects extension, media-type, signature, and size mismatches with stable codes", () => {
    const cases = [
      () => inspectArtifactContent({ content: PDF_BYTES, sourcePath: "manual.exe", declaredMediaType: "application/pdf" }),
      () => inspectArtifactContent({ content: PDF_BYTES, sourcePath: "manual.pdf", declaredMediaType: "text/plain" }),
      () => inspectArtifactContent({ content: Buffer.from("not a PDF"), sourcePath: "manual.pdf", declaredMediaType: "application/pdf" }),
      () => inspectArtifactContent({ content: PDF_BYTES, sourcePath: "manual.pdf", declaredMediaType: "application/pdf", maxArtifactBytes: 2 }),
    ];
    const expected = [
      "artifact_extension_unsupported",
      "artifact_declared_media_type_mismatch",
      "artifact_signature_mismatch",
      "artifact_size_exceeded",
    ];

    cases.forEach((run, index) => {
      assert.throws(run, (error: unknown) =>
        error instanceof ArtifactSafetyError && error.code === expected[index]);
    });
  });

  it("recognizes DOCX OPC markers and strict UTF-8 text without treating either as PDF", () => {
    const docx = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      Buffer.from("[Content_Types].xml word/document.xml", "utf8"),
    ]);
    const docxResult = inspectArtifactContent({
      content: docx,
      sourcePath: "manual.docx",
      declaredMediaType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const textResult = inspectArtifactContent({
      content: Buffer.from("# Procedimiento\n\nPaso uno.", "utf8"),
      sourcePath: "manual.md",
      declaredMediaType: "text/markdown",
    });

    assert.equal(docxResult.signature, "docx-opc-markers-v1");
    assert.equal(textResult.signature, "utf8-text-v1");
  });
});

describe("ClamAV command scanner adapter", () => {
  it("maps exit code 1 to an infected verdict without exposing a shell command", async () => {
    const calls: Array<{ executable: string; args: string[] }> = [];
    const runner: ScannerCommandRunner = async (executable, args) => {
      calls.push({ executable, args });
      if (args[0] === "--version") {
        return commandResult({ stdout: "ClamAV 1.4.3/27654/Fri Jul 18 12:00:00 2026\n" });
      }
      return commandResult({
        exitCode: 1,
        stdout: "/tmp/manual.pdf: Eicar-Signature FOUND\n",
      });
    };
    const scanner = new ClamAvCommandScanner({
      mode: "clamdscan",
      executable: "clamdscan",
      runner,
    });

    const result = await scanner.scan("/tmp/manual with spaces.pdf");

    assert.equal(result.verdict, "infected");
    assert.equal(result.signature, "Eicar-Signature");
    assert.equal(result.engineVersion, "1.4.3");
    assert.ok(result.definitionsVersion?.startsWith("27654/"));
    assert.ok(calls[1]?.args.includes("--stream"));
    assert.deepEqual(calls[1]?.args.at(-1), "/tmp/manual with spaces.pdf");
  });

  it("enables ClamAV limit and encrypted-document alerts for standalone scans", async () => {
    let scanArgs: string[] = [];
    const runner: ScannerCommandRunner = async (_executable, args) => {
      if (args[0] === "--version") return commandResult({ stdout: "ClamAV 1.4.3/27654/date\n" });
      scanArgs = args;
      return commandResult();
    };
    const scanner = new ClamAvCommandScanner({ mode: "clamscan", executable: "clamscan", runner });

    const result = await scanner.scan("/tmp/manual.pdf");

    assert.equal(result.verdict, "clean");
    assert.ok(scanArgs.includes("--official-db-only=yes"));
    assert.ok(scanArgs.includes("--alert-encrypted=yes"));
    assert.ok(scanArgs.includes("--alert-exceeds-max=yes"));
    assert.equal(scanArgs.at(-1), "/tmp/manual.pdf");
  });

  it("fails closed when the scanner version probe is unavailable", async () => {
    const scanner = new ClamAvCommandScanner({
      mode: "clamdscan",
      executable: "clamdscan",
      runner: async () => commandResult({ exitCode: null, errorCode: "ENOENT" }),
    });

    const result = await scanner.scan("/tmp/manual.pdf");

    assert.equal(result.verdict, "error");
    assert.equal(result.failureCode, "malware_scanner_unavailable");
  });

  it("accepts only bounded numeric policy settings and fixed scanner modes", () => {
    const policy = loadArtifactSafetyPolicy({
      DOCUMENT_MAX_ARTIFACT_BYTES: "2048",
      DOCUMENT_MALWARE_SCAN_MAX_AGE_SECONDS: "600",
      DOCUMENT_MALWARE_SCAN_TIMEOUT_MS: "5000",
    });

    assert.equal(policy.maxArtifactBytes, 2048);
    assert.equal(policy.malwareScanMaxAgeMs, 600_000);
    assert.equal(policy.malwareScanTimeoutMs, 5000);
    assert.throws(() => loadArtifactSafetyPolicy({ DOCUMENT_MAX_ARTIFACT_BYTES: "0" }));
    assert.throws(() => createClamAvScannerFromEnv({ DOCUMENT_MALWARE_SCANNER: "custom" }));
    assert.throws(() => createClamAvScannerFromEnv({
      DOCUMENT_MALWARE_SCANNER: "clamdscan",
      DOCUMENT_MALWARE_SCANNER_COMMAND: "arbitrary-scanner",
    }));
    assert.throws(() => createClamAvScannerFromEnv({
      DOCUMENT_MALWARE_SCANNER: "clamdscan",
      DOCUMENT_MALWARE_SCANNER_COMMAND: "/bin/echo",
    }));
    assert.ok(createClamAvScannerFromEnv({
      DOCUMENT_MALWARE_SCANNER: "clamdscan",
      DOCUMENT_MALWARE_SCANNER_COMMAND: "/usr/bin/clamdscan",
    }));
  });
});
