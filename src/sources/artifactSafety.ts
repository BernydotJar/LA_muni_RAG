import { execFile } from "node:child_process";
import { basename, extname, isAbsolute } from "node:path";

export const DEFAULT_MAX_ARTIFACT_BYTES = 100 * 1024 * 1024;
export const DEFAULT_MALWARE_SCAN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_MALWARE_SCAN_TIMEOUT_MS = 120_000;

const MAX_CONFIGURED_ARTIFACT_BYTES = 1024 * 1024 * 1024;
const MAX_CONFIGURED_SCAN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CONFIGURED_SCAN_TIMEOUT_MS = 10 * 60 * 1000;
const SCANNER_OUTPUT_LIMIT_BYTES = 64 * 1024;

export type ArtifactSafetyVerdict = "clean" | "infected" | "rejected" | "error";
export type ClamAvScannerMode = "clamdscan" | "clamscan";

export interface ArtifactSafetyPolicy {
  maxArtifactBytes: number;
  malwareScanMaxAgeMs: number;
  malwareScanTimeoutMs: number;
}

export interface ArtifactStructuralInspection {
  byteLength: number;
  declaredMediaType: string;
  detectedMediaType: string;
  signature: string;
}

export interface MalwareScanResult {
  verdict: "clean" | "infected" | "error";
  engine: string;
  engineVersion: string;
  definitionsVersion?: string;
  signature?: string;
  failureCode?: string;
}

export interface MalwareScanner {
  scan(filePath: string): Promise<MalwareScanResult>;
}

export interface ScannerCommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  errorCode?: string;
  timedOut: boolean;
}

export type ScannerCommandRunner = (
  executable: string,
  args: string[],
  options: { timeoutMs: number }
) => Promise<ScannerCommandResult>;

export interface ClamAvCommandScannerOptions {
  mode: ClamAvScannerMode;
  executable: string;
  timeoutMs?: number;
  configFile?: string;
  runner?: ScannerCommandRunner;
}

const MEDIA_TYPE_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
};

const parseBoundedInteger = (
  value: string | undefined,
  fallback: number,
  label: string,
  minimum: number,
  maximum: number
): number => {
  if (value === undefined || value.trim() === "") return fallback;
  if (!/^\d+$/.test(value.trim())) throw new Error(`${label} must be an integer.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}.`);
  }
  return parsed;
};

export const loadArtifactSafetyPolicy = (
  env: NodeJS.ProcessEnv = process.env
): ArtifactSafetyPolicy => ({
  maxArtifactBytes: parseBoundedInteger(
    env.DOCUMENT_MAX_ARTIFACT_BYTES,
    DEFAULT_MAX_ARTIFACT_BYTES,
    "DOCUMENT_MAX_ARTIFACT_BYTES",
    1,
    MAX_CONFIGURED_ARTIFACT_BYTES
  ),
  malwareScanMaxAgeMs: parseBoundedInteger(
    env.DOCUMENT_MALWARE_SCAN_MAX_AGE_SECONDS,
    DEFAULT_MALWARE_SCAN_MAX_AGE_MS / 1000,
    "DOCUMENT_MALWARE_SCAN_MAX_AGE_SECONDS",
    60,
    MAX_CONFIGURED_SCAN_AGE_MS / 1000
  ) * 1000,
  malwareScanTimeoutMs: parseBoundedInteger(
    env.DOCUMENT_MALWARE_SCAN_TIMEOUT_MS,
    DEFAULT_MALWARE_SCAN_TIMEOUT_MS,
    "DOCUMENT_MALWARE_SCAN_TIMEOUT_MS",
    1000,
    MAX_CONFIGURED_SCAN_TIMEOUT_MS
  ),
});

export class ArtifactSafetyError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ArtifactSafetyError";
  }
}

export const assertArtifactByteLength = (byteLength: number, maxArtifactBytes: number): void => {
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0) {
    throw new ArtifactSafetyError("artifact_empty", "Artifact must contain at least one byte.");
  }
  if (byteLength > maxArtifactBytes) {
    throw new ArtifactSafetyError(
      "artifact_size_exceeded",
      `Artifact exceeds the configured ${maxArtifactBytes}-byte limit.`
    );
  }
};

const normalizeMediaType = (value: string): string =>
  value.split(";", 1)[0]?.trim().toLowerCase() ?? "";

const bufferStartsWith = (buffer: Buffer, prefix: Buffer): boolean =>
  buffer.length >= prefix.length && buffer.subarray(0, prefix.length).equals(prefix);

const hasPdfSignature = (content: Buffer): boolean => {
  const header = content.subarray(0, Math.min(content.length, 8)).toString("ascii");
  if (!/^%PDF-\d\.\d/.test(header)) return false;
  const trailer = content.subarray(Math.max(0, content.length - 2048)).toString("latin1");
  return trailer.includes("%%EOF");
};

const hasDocxSignature = (content: Buffer): boolean => {
  if (!bufferStartsWith(content, Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return false;
  return content.includes(Buffer.from("[Content_Types].xml", "utf8")) &&
    content.includes(Buffer.from("word/document.xml", "utf8"));
};

const isUtf8Text = (content: Buffer): boolean => {
  if (content.includes(0)) return false;
  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    return false;
  }
  if (!decoded.trim()) return false;
  const controlCharacters = [...decoded].filter((character) => {
    const code = character.charCodeAt(0);
    return code < 0x20 && character !== "\n" && character !== "\r" && character !== "\t";
  }).length;
  return controlCharacters / decoded.length <= 0.01;
};

export const inspectArtifactContent = (input: {
  content: Buffer;
  sourcePath: string;
  declaredMediaType: string;
  maxArtifactBytes?: number;
}): ArtifactStructuralInspection => {
  const maxArtifactBytes = input.maxArtifactBytes ?? DEFAULT_MAX_ARTIFACT_BYTES;
  assertArtifactByteLength(input.content.byteLength, maxArtifactBytes);

  const extension = extname(input.sourcePath).toLowerCase();
  const expectedMediaType = MEDIA_TYPE_BY_EXTENSION[extension];
  if (!expectedMediaType) {
    throw new ArtifactSafetyError(
      "artifact_extension_unsupported",
      `Artifact extension ${extension || "(none)"} is not supported.`
    );
  }

  const declaredMediaType = normalizeMediaType(input.declaredMediaType);
  if (!declaredMediaType) {
    throw new ArtifactSafetyError(
      "artifact_media_type_missing",
      "A declared artifact media type is required."
    );
  }
  if (declaredMediaType !== expectedMediaType) {
    throw new ArtifactSafetyError(
      "artifact_declared_media_type_mismatch",
      "Declared media type does not match the artifact extension."
    );
  }

  let detectedMediaType: string;
  let signature: string;
  if (hasPdfSignature(input.content)) {
    detectedMediaType = "application/pdf";
    signature = "pdf-header-eof-v1";
  } else if (hasDocxSignature(input.content)) {
    detectedMediaType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    signature = "docx-opc-markers-v1";
  } else if (isUtf8Text(input.content)) {
    detectedMediaType = extension === ".md" || extension === ".markdown" ? "text/markdown" : "text/plain";
    signature = "utf8-text-v1";
  } else {
    throw new ArtifactSafetyError(
      "artifact_signature_unrecognized",
      "Artifact bytes do not match a supported file signature."
    );
  }

  if (detectedMediaType !== expectedMediaType) {
    throw new ArtifactSafetyError(
      "artifact_signature_mismatch",
      "Detected artifact signature does not match the extension and declared media type."
    );
  }

  return {
    byteLength: input.content.byteLength,
    declaredMediaType,
    detectedMediaType,
    signature,
  };
};

export const runScannerCommand: ScannerCommandRunner = (
  executable,
  args,
  options
) => new Promise((resolve) => {
  execFile(executable, args, {
    encoding: "utf8",
    maxBuffer: SCANNER_OUTPUT_LIMIT_BYTES,
    shell: false,
    timeout: options.timeoutMs,
    windowsHide: true,
  }, (error, stdout, stderr) => {
    const commandError = error as (NodeJS.ErrnoException & {
      code?: string | number;
      killed?: boolean;
      signal?: NodeJS.Signals;
    }) | null;
    resolve({
      exitCode: commandError === null
        ? 0
        : typeof commandError.code === "number"
          ? commandError.code
          : null,
      stdout: String(stdout ?? ""),
      stderr: String(stderr ?? ""),
      ...(typeof commandError?.code === "string" ? { errorCode: commandError.code } : {}),
      timedOut: Boolean(commandError?.killed && commandError?.signal === "SIGTERM"),
    });
  });
});

const safeScannerValue = (value: string, fallback: string): string => {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_.:+/-]+/g, "-").slice(0, 160);
  return cleaned || fallback;
};

const parseClamAvVersion = (output: string): { engineVersion: string; definitionsVersion?: string } | null => {
  const line = output.split(/\r?\n/).map((value) => value.trim()).find(Boolean);
  if (!line) return null;
  const match = line.match(/ClamAV\s+([^/\s]+)(?:\/([^/\s]+)\/(.+))?/i);
  if (!match?.[1]) return null;
  const parsed: { engineVersion: string; definitionsVersion?: string } = {
    engineVersion: safeScannerValue(match[1], "unknown"),
  };
  if (match[2]) {
    parsed.definitionsVersion = safeScannerValue(
      `${match[2]}${match[3] ? `/${match[3]}` : ""}`,
      "unknown"
    );
  }
  return parsed;
};

const parseDetectionSignature = (output: string): string => {
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/:\s+(.+?)\s+FOUND\s*$/i);
    if (match?.[1]) return safeScannerValue(match[1], "clamav-detection");
  }
  return "clamav-detection";
};

export class ClamAvCommandScanner implements MalwareScanner {
  private readonly timeoutMs: number;
  private readonly runner: ScannerCommandRunner;

  constructor(private readonly options: ClamAvCommandScannerOptions) {
    if (options.mode !== "clamdscan" && options.mode !== "clamscan") {
      throw new Error("Unsupported ClamAV scanner mode.");
    }
    if (!options.executable.trim()) throw new Error("ClamAV scanner executable is required.");
    if (options.configFile && !isAbsolute(options.configFile)) {
      throw new Error("ClamAV config file must be an absolute path.");
    }
    this.timeoutMs = options.timeoutMs ?? DEFAULT_MALWARE_SCAN_TIMEOUT_MS;
    this.runner = options.runner ?? runScannerCommand;
  }

  async scan(filePath: string): Promise<MalwareScanResult> {
    const version = await this.runner(this.options.executable, ["--version"], { timeoutMs: this.timeoutMs });
    const parsedVersion = version.exitCode === 0
      ? parseClamAvVersion(`${version.stdout}\n${version.stderr}`)
      : null;
    if (!parsedVersion) {
      return {
        verdict: "error",
        engine: "clamav",
        engineVersion: "unavailable",
        failureCode: version.timedOut ? "malware_scanner_timeout" : "malware_scanner_unavailable",
      };
    }

    const args = this.options.mode === "clamscan"
      ? [
          "--infected",
          "--no-summary",
          "--scan-pdf=yes",
          "--scan-archive=yes",
          "--official-db-only=yes",
          "--alert-encrypted=yes",
          "--alert-exceeds-max=yes",
          filePath,
        ]
      : [
          ...(this.options.configFile ? [`--config-file=${this.options.configFile}`] : []),
          "--stream",
          "--infected",
          "--no-summary",
          filePath,
        ];
    const scan = await this.runner(this.options.executable, args, { timeoutMs: this.timeoutMs });
    const output = `${scan.stdout}\n${scan.stderr}`;

    if (scan.exitCode === 0 && !/\sFOUND\s*$/im.test(output)) {
      return {
        verdict: "clean",
        engine: "clamav",
        engineVersion: parsedVersion.engineVersion,
        ...(parsedVersion.definitionsVersion ? { definitionsVersion: parsedVersion.definitionsVersion } : {}),
      };
    }
    if (scan.exitCode === 1 || /\sFOUND\s*$/im.test(output)) {
      return {
        verdict: "infected",
        engine: "clamav",
        engineVersion: parsedVersion.engineVersion,
        ...(parsedVersion.definitionsVersion ? { definitionsVersion: parsedVersion.definitionsVersion } : {}),
        signature: parseDetectionSignature(output),
        failureCode: "malware_detected",
      };
    }
    return {
      verdict: "error",
      engine: "clamav",
      engineVersion: parsedVersion.engineVersion,
      ...(parsedVersion.definitionsVersion ? { definitionsVersion: parsedVersion.definitionsVersion } : {}),
      failureCode: scan.timedOut ? "malware_scanner_timeout" : "malware_scan_error",
    };
  }
}

export const createClamAvScannerFromEnv = (
  env: NodeJS.ProcessEnv = process.env,
  runner?: ScannerCommandRunner
): MalwareScanner | undefined => {
  const rawMode = env.DOCUMENT_MALWARE_SCANNER?.trim().toLowerCase();
  if (!rawMode) return undefined;
  if (rawMode !== "clamdscan" && rawMode !== "clamscan") {
    throw new Error("DOCUMENT_MALWARE_SCANNER must be clamdscan or clamscan.");
  }
  const mode = rawMode as ClamAvScannerMode;
  const executable = env.DOCUMENT_MALWARE_SCANNER_COMMAND?.trim() || mode;
  const executableName = basename(executable).toLowerCase();
  if (
    (!isAbsolute(executable) && executable !== mode) ||
    (isAbsolute(executable) && executableName !== mode && executableName !== `${mode}.exe`)
  ) {
    throw new Error("DOCUMENT_MALWARE_SCANNER_COMMAND must name the selected scanner, optionally by absolute path.");
  }
  const configFile = env.DOCUMENT_MALWARE_SCANNER_CONFIG?.trim();
  if (configFile && mode !== "clamdscan") {
    throw new Error("DOCUMENT_MALWARE_SCANNER_CONFIG is only supported with clamdscan.");
  }
  const policy = loadArtifactSafetyPolicy(env);
  return new ClamAvCommandScanner({
    mode,
    executable,
    timeoutMs: policy.malwareScanTimeoutMs,
    ...(configFile ? { configFile } : {}),
    ...(runner ? { runner } : {}),
  });
};
