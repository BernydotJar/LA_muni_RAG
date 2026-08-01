import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SOURCES = 128;

export interface HtmlAcquisitionPlan {
  schemaVersion: 1;
  acquisitionId: string;
  sourcePackId: string;
  snapshotDate: string;
  maxArtifactBytes: number;
  requestTimeoutMs: number;
  maxRedirects: number;
  minimumExtractedCharacters: number;
  minimumSectionCount: number;
  minimumSuccessfulSources: number;
  sourceIds: string[];
}

export type HtmlAcquisitionFailureCode =
  | "source_not_found"
  | "source_unbound"
  | "source_state_rejected"
  | "source_url_invalid"
  | "source_host_rejected"
  | "source_dns_unresolved"
  | "source_dns_private_address"
  | "source_redirect_rejected"
  | "source_redirect_limit"
  | "source_network_error"
  | "source_request_timeout"
  | "source_http_status"
  | "source_media_type_rejected"
  | "source_body_empty"
  | "source_body_too_large"
  | "source_charset_unsupported"
  | "source_structural_rejected"
  | "source_malware_scan_error"
  | "source_malware_detected"
  | "source_extraction_insufficient"
  | "source_storage_conflict"
  | "source_storage_error";

export class HtmlAcquisitionError extends Error {
  constructor(public readonly code: HtmlAcquisitionFailureCode, message: string) {
    super(message);
    this.name = "HtmlAcquisitionError";
  }
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const integer = (value: unknown, name: string, min: number, max: number): number => {
  if (!Number.isSafeInteger(value) || Number(value) < min || Number(value) > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return Number(value);
};

export const parseHtmlAcquisitionPlan = (value: unknown): HtmlAcquisitionPlan => {
  if (!object(value) || value.schemaVersion !== 1) throw new Error("Acquisition plan must use schemaVersion 1.");
  if (typeof value.acquisitionId !== "string" || !SLUG.test(value.acquisitionId)) throw new Error("Invalid acquisitionId.");
  if (typeof value.sourcePackId !== "string" || !SLUG.test(value.sourcePackId)) throw new Error("Invalid sourcePackId.");
  if (typeof value.snapshotDate !== "string" || !DATE.test(value.snapshotDate)) throw new Error("Invalid snapshotDate.");
  const parsedDate = new Date(`${value.snapshotDate}T00:00:00Z`);
  if (!Number.isFinite(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== value.snapshotDate) throw new Error("snapshotDate is not a valid calendar date.");
  if (!Array.isArray(value.sourceIds) || value.sourceIds.length < 1 || value.sourceIds.length > MAX_SOURCES) {
    throw new Error("sourceIds must be a bounded non-empty array.");
  }
  if (value.sourceIds.some((id) => typeof id !== "string" || !SLUG.test(id))) throw new Error("Invalid sourceId.");
  if (new Set(value.sourceIds).size !== value.sourceIds.length) throw new Error("sourceIds must be unique.");
  return {
    schemaVersion: 1,
    acquisitionId: value.acquisitionId,
    sourcePackId: value.sourcePackId,
    snapshotDate: value.snapshotDate,
    maxArtifactBytes: integer(value.maxArtifactBytes, "maxArtifactBytes", 1, 25 * 1024 * 1024),
    requestTimeoutMs: integer(value.requestTimeoutMs, "requestTimeoutMs", 1_000, 120_000),
    maxRedirects: integer(value.maxRedirects, "maxRedirects", 0, 4),
    minimumExtractedCharacters: integer(value.minimumExtractedCharacters, "minimumExtractedCharacters", 1, 10_000_000),
    minimumSectionCount: integer(value.minimumSectionCount, "minimumSectionCount", 1, 100_000),
    minimumSuccessfulSources: integer(value.minimumSuccessfulSources, "minimumSuccessfulSources", 1, value.sourceIds.length),
    sourceIds: [...value.sourceIds] as string[],
  };
};

const ipv4 = (value: string): number | null => {
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return (((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!) >>> 0;
};

const inRange = (value: number, base: string, prefix: number): boolean => {
  const first = ipv4(base);
  if (first === null) return false;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (first & mask);
};

export const isPublicNetworkAddress = (address: string): boolean => {
  if (isIP(address) === 4) {
    const value = ipv4(address);
    if (value === null) return false;
    return ![
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
      ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
      ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
      ["224.0.0.0", 4], ["240.0.0.0", 4],
    ].some(([base, prefix]) => inRange(value, String(base), Number(prefix)));
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::" || normalized === "::1") return false;
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mapped) return isPublicNetworkAddress(mapped);
    return !/^(?:fc|fd|ff)/.test(normalized) && !/^fe[89ab]/.test(normalized) && !/^2001:db8(?::|$)/.test(normalized);
  }
  return false;
};

export const resolvePublicHost = async (hostname: string): Promise<string[]> => {
  const addresses = (await lookup(hostname, { all: true, verbatim: true })).map((item) => item.address);
  if (addresses.length < 1) throw new HtmlAcquisitionError("source_dns_unresolved", `No DNS address for ${hostname}.`);
  if (addresses.some((address) => !isPublicNetworkAddress(address))) {
    throw new HtmlAcquisitionError("source_dns_private_address", `${hostname} resolved to a non-public address.`);
  }
  return addresses;
};

const normalizeCharset = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (normalized === "utf8" || normalized === "utf-8") return "utf-8";
  if (["iso-8859-1", "iso8859-1", "latin1", "latin-1", "windows-1252", "cp1252"].includes(normalized)) return "windows-1252";
  return undefined;
};

export const detectHtmlCharset = (contentType: string | null, content: Buffer): string => {
  const header = contentType?.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1];
  const headerCharset = normalizeCharset(header);
  if (header && !headerCharset) throw new HtmlAcquisitionError("source_charset_unsupported", `Unsupported charset ${header}.`);
  if (headerCharset) return headerCharset;
  const prefix = content.subarray(0, Math.min(content.length, 8192)).toString("latin1");
  const meta = prefix.match(/<meta\b[^>]*charset\s*=\s*["']?([^\s"'/>;]+)/i)?.[1]
    ?? prefix.match(/<meta\b[^>]*content\s*=\s*["'][^"']*charset\s*=\s*([^\s"';/>]+)/i)?.[1];
  const metaCharset = normalizeCharset(meta);
  if (meta && !metaCharset) throw new HtmlAcquisitionError("source_charset_unsupported", `Unsupported meta charset ${meta}.`);
  if (metaCharset) return metaCharset;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(content);
    return "utf-8";
  } catch {
    throw new HtmlAcquisitionError("source_charset_unsupported", "HTML is neither UTF-8 nor explicitly supported legacy text.");
  }
};
