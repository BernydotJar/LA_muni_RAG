import { createHash } from "node:crypto";
import { chmod, link, lstat, mkdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { Agent, fetch as undiciFetch } from "undici";
import { htmlExtractor } from "../ingestion/extractors/htmlExtractor.js";
import type { MalwareScanner } from "./artifactSafety.js";
import { inspectArtifactContent } from "./artifactSafety.js";
import {
  detectHtmlCharset,
  HtmlAcquisitionError,
  isPublicNetworkAddress,
  type HtmlAcquisitionFailureCode,
  type HtmlAcquisitionPlan,
  resolvePublicHost,
} from "./htmlAcquisitionPolicy.js";
import { scanVerifiedArtifactSnapshot } from "./scanVerifiedArtifact.js";
import type { SourceInventoryManifestFile } from "./sourceInventoryManifest.js";
import type { SourceInventoryRecord } from "./sourceInventory.js";
import type { SourcePackConnector, SourcePackManifest } from "./sourcePack.js";

export interface HtmlAcquisitionReceiptSource {
  sourceId: string;
  outcome: "acquired" | "blocked";
  sourceUrl: string;
  inventoryStatusBefore: SourceInventoryRecord["status"];
  inventoryStatusAfter: SourceInventoryRecord["status"];
  finalUrl?: string;
  redirects?: number;
  responseStatus?: number;
  responseMediaType?: string;
  charset?: string;
  byteLength?: number;
  contentSha256?: string;
  artifactPath?: string;
  extractionPath?: string;
  structuralSignature?: string;
  scanner?: { engine: string; version: string; definitionsVersion: string };
  sectionCount?: number;
  extractedCharacters?: number;
  reused?: boolean;
  failureCode?: HtmlAcquisitionFailureCode;
  failureMessage?: string;
}

export interface HtmlAcquisitionReceipt {
  schemaVersion: 1;
  acquisitionId: string;
  sourcePackId: string;
  snapshotDate: string;
  attemptedAt: string;
  result: "pass" | "insufficient_successes";
  attempted: number;
  successful: number;
  blocked: number;
  minimumSuccessfulSources: number;
  sources: HtmlAcquisitionReceiptSource[];
  managedCorpusMutation: false;
  indexingPerformed: false;
}

export interface HtmlAcquisitionDependencies {
  scanner: MalwareScanner;
  fetchImpl?: typeof fetch;
  resolveHost?: (hostname: string) => Promise<string[]>;
  now?: () => Date;
}

interface BoundSource { record: SourceInventoryRecord; connector: SourcePackConnector }
interface FetchedHtml {
  content: Buffer;
  finalUrl: URL;
  redirects: number;
  status: number;
  mediaType: string;
  charset: string;
}

const sha256 = (content: Buffer): string => createHash("sha256").update(content).digest("hex");
const mediaType = (value: string | null): string => (value ?? "").split(";", 1)[0]!.trim().toLowerCase();

const bindSources = (plan: HtmlAcquisitionPlan, pack: SourcePackManifest, inventory: SourceInventoryManifestFile): BoundSource[] => {
  if (pack.packId !== plan.sourcePackId || pack.isTemplate) throw new Error("Plan must reference the selected non-template source pack.");
  const records = new Map(inventory.records.map((record) => [record.sourceId, record]));
  return plan.sourceIds.map((sourceId) => {
    const record = records.get(sourceId);
    if (!record?.publicUrl) throw new HtmlAcquisitionError("source_not_found", `Source ${sourceId} is missing or has no publicUrl.`);
    if (!["verified", "acquisition_pending", "ingestion_pending"].includes(record.status)) {
      throw new HtmlAcquisitionError("source_state_rejected", `Source ${sourceId} state ${record.status} is not eligible for HTML acquisition.`);
    }
    const connectors = pack.connectors.filter((connector) =>
      connector.enabled && connector.type === "html_page" && connector.sourceInventoryIds.includes(sourceId));
    if (connectors.length !== 1) throw new HtmlAcquisitionError("source_unbound", `Source ${sourceId} must have exactly one enabled HTML connector.`);
    return { record, connector: connectors[0]! };
  });
};

const validateUrl = async (
  url: URL,
  allowedHosts: Set<string>,
  resolveHost: (hostname: string) => Promise<string[]>
): Promise<string[]> => {
  if (url.protocol !== "https:" || url.username || url.password) throw new HtmlAcquisitionError("source_url_invalid", "URL must use HTTPS without credentials.");
  if (!allowedHosts.has(url.hostname)) throw new HtmlAcquisitionError("source_host_rejected", `Host ${url.hostname} is not exactly allowlisted.`);
  try {
    const addresses = await resolveHost(url.hostname);
    if (addresses.length < 1) throw new HtmlAcquisitionError("source_dns_unresolved", `No DNS address for ${url.hostname}.`);
    if (addresses.some((address) => !isPublicNetworkAddress(address))) throw new HtmlAcquisitionError("source_dns_private_address", `${url.hostname} resolved to a non-public address.`);
    return addresses;
  } catch (error) {
    if (error instanceof HtmlAcquisitionError) throw error;
    throw new HtmlAcquisitionError("source_dns_unresolved", `DNS resolution failed for ${url.hostname}.`);
  }
};

const pinnedRequest = async (url: URL, addresses: string[], plan: HtmlAcquisitionPlan): Promise<{ response: Response; close: () => Promise<void> }> => {
  const lookup = ((_hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void): void => {
    const entries = addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
    if (options?.all) callback(null, entries);
    else callback(null, entries[0]!.address, entries[0]!.family);
  }) as never;
  const agent = new Agent({
    connect: { lookup },
    connectTimeout: plan.requestTimeoutMs,
    headersTimeout: plan.requestTimeoutMs,
    bodyTimeout: plan.requestTimeoutMs,
    maxResponseSize: plan.maxArtifactBytes + 1,
    pipelining: 0,
  });
  try {
    const response = await undiciFetch(url, {
      method: "GET",
      redirect: "manual",
      dispatcher: agent,
      signal: AbortSignal.timeout(plan.requestTimeoutMs),
      headers: { accept: "text/html,application/xhtml+xml;q=0.9", "user-agent": "LA-Muni-RAG-governed-source-acquisition/1.0" },
    });
    return { response: response as unknown as Response, close: async () => { await agent.close(); } };
  } catch (error) {
    await agent.close().catch(() => undefined);
    throw error;
  }
};

const readBounded = async (response: Response, maximum: number): Promise<Buffer> => {
  const declared = response.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maximum) throw new HtmlAcquisitionError("source_body_too_large", "Content-Length exceeds the configured limit.");
  if (!response.body) throw new HtmlAcquisitionError("source_body_empty", "Response body is absent.");
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    if (!item.value?.byteLength) continue;
    total += item.value.byteLength;
    if (total > maximum) {
      await reader.cancel().catch(() => undefined);
      throw new HtmlAcquisitionError("source_body_too_large", "Response body exceeds the configured limit.");
    }
    chunks.push(Buffer.from(item.value));
  }
  if (total < 1) throw new HtmlAcquisitionError("source_body_empty", "Response body is empty.");
  return Buffer.concat(chunks, total);
};

const fetchHtml = async (
  source: BoundSource,
  pack: SourcePackManifest,
  plan: HtmlAcquisitionPlan,
  fetchImpl: typeof fetch,
  resolveHost: (hostname: string) => Promise<string[]>
): Promise<FetchedHtml> => {
  let current: URL;
  try { current = new URL(source.record.publicUrl!); }
  catch { throw new HtmlAcquisitionError("source_url_invalid", "Inventory publicUrl is invalid."); }
  const allowedHosts = new Set(source.connector.allowedHosts.filter((host) => pack.allowedHosts.includes(host)));
  const originalHost = current.hostname;
  for (let redirects = 0; redirects <= plan.maxRedirects; redirects += 1) {
    const addresses = await validateUrl(current, allowedHosts, resolveHost);
    let response: Response;
    let close = async (): Promise<void> => undefined;
    try {
      if (fetchImpl !== fetch) {
        response = await fetchImpl(current, {
          method: "GET", redirect: "manual", signal: AbortSignal.timeout(plan.requestTimeoutMs),
          headers: { accept: "text/html,application/xhtml+xml;q=0.9", "user-agent": "LA-Muni-RAG-governed-source-acquisition/1.0" },
        });
      } else {
        ({ response, close } = await pinnedRequest(current, addresses, plan));
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new HtmlAcquisitionError("source_redirect_rejected", "Redirect omitted Location.");
        if (redirects >= plan.maxRedirects) throw new HtmlAcquisitionError("source_redirect_limit", "Redirect limit exceeded.");
        const next = new URL(location, current);
        if (next.hostname !== originalHost) throw new HtmlAcquisitionError("source_redirect_rejected", `Cross-host redirect to ${next.hostname} rejected.`);
        current = next;
        continue;
      }
      if (response.status !== 200) throw new HtmlAcquisitionError("source_http_status", `Official endpoint returned HTTP ${response.status}.`);
      const type = mediaType(response.headers.get("content-type"));
      if (type !== "text/html" && type !== "application/xhtml+xml") throw new HtmlAcquisitionError("source_media_type_rejected", `Response media type ${type || "missing"} is not HTML.`);
      const content = await readBounded(response, plan.maxArtifactBytes);
      return { content, finalUrl: current, redirects, status: response.status, mediaType: type, charset: detectHtmlCharset(response.headers.get("content-type"), content) };
    } catch (error) {
      if (error instanceof HtmlAcquisitionError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      const code = (error as { code?: string }).code;
      if (code === "UND_ERR_RES_EXCEEDED_MAX_SIZE" || /max(?:imum)? response size|exceeded.*size/i.test(message)) {
        throw new HtmlAcquisitionError("source_body_too_large", message.slice(0, 300));
      }
      throw new HtmlAcquisitionError(/abort|timeout/i.test(message) ? "source_request_timeout" : "source_network_error", message.slice(0, 300));
    } finally {
      await close().catch(() => undefined);
    }
  }
  throw new HtmlAcquisitionError("source_redirect_limit", "Redirect limit exceeded.");
};

const privateDirectory = async (path: string): Promise<void> => {
  await mkdir(path, { recursive: true, mode: 0o700 });
  await chmod(path, 0o700);
};

const childPath = (root: string, relativePath: string): string => {
  const path = resolve(root, ...relativePath.split("/"));
  const fromRoot = relative(root, path);
  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) throw new HtmlAcquisitionError("source_storage_error", "Artifact path escaped the library root.");
  return path;
};

const safeDirectory = async (root: string, path: string): Promise<void> => {
  const relativePath = relative(root, path);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) throw new HtmlAcquisitionError("source_storage_error", "Directory escaped the library root.");
  let current = root;
  for (const part of relativePath.split("/").filter(Boolean)) {
    current = resolve(current, part);
    try {
      const metadata = await lstat(current);
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new HtmlAcquisitionError("source_storage_conflict", `Unsafe directory component at ${current}.`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      try { await mkdir(current, { mode: 0o700 }); }
      catch (mkdirError) {
        if ((mkdirError as NodeJS.ErrnoException).code !== "EEXIST") throw mkdirError;
      }
      const metadata = await lstat(current);
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new HtmlAcquisitionError("source_storage_conflict", `Unsafe directory component at ${current}.`);
    }
    await chmod(current, 0o700);
  }
};

const immutableWrite = async (root: string, path: string, content: Buffer): Promise<boolean> => {
  await safeDirectory(root, dirname(path));
  const actualParent = await realpath(dirname(path));
  const parentFromRoot = relative(root, actualParent);
  if (parentFromRoot.startsWith("..") || isAbsolute(parentFromRoot)) throw new HtmlAcquisitionError("source_storage_error", "Artifact parent resolves outside the library root.");
  try {
    const metadata = await lstat(path);
    if (!metadata.isFile() || metadata.isSymbolicLink()) throw new HtmlAcquisitionError("source_storage_conflict", `Existing artifact is not a regular file at ${path}.`);
    const existing = await readFile(path);
    if (existing.length !== content.length || sha256(existing) !== sha256(content)) throw new HtmlAcquisitionError("source_storage_conflict", `Existing artifact differs at ${path}.`);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const temporary = `${path}.part-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, content, { flag: "wx", mode: 0o600 });
    await chmod(temporary, 0o600);
    try {
      await link(temporary, path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existing = await readFile(path);
      if (existing.length !== content.length || sha256(existing) !== sha256(content)) throw new HtmlAcquisitionError("source_storage_conflict", `Concurrent artifact differs at ${path}.`);
      return true;
    }
    if ((await stat(path)).size !== content.length) throw new HtmlAcquisitionError("source_storage_error", "Published artifact size mismatch.");
    return false;
  } finally { await rm(temporary, { force: true }); }
};

const successRecord = (record: SourceInventoryRecord, input: {
  at: string; date: string; hash: string; bytes: number; artifact: string; extraction: string;
  signature: string; scanner: { engine: string; version: string; definitions: string }; sections: number; finalUrl: string;
}): SourceInventoryRecord => ({
  ...record,
  documentVersion: `snapshot-${input.date}-sha256-${input.hash.slice(0, 16)}`,
  status: "ingestion_pending",
  acquisition: { acquiredAt: input.at, artifactPath: input.artifact, contentSha256: input.hash, mediaType: "text/html", byteLength: input.bytes },
  artifactSafety: {
    inspectedAt: input.at, artifactPath: input.artifact, contentSha256: input.hash, byteLength: input.bytes,
    observedContentSha256: input.hash, observedByteLength: input.bytes, declaredMediaType: "text/html", detectedMediaType: "text/html",
    signature: input.signature, scannerEngine: input.scanner.engine, scannerVersion: input.scanner.version,
    scannerDefinitionsVersion: input.scanner.definitions, verdict: "clean", failureCodes: [],
  },
  extraction: { extractedAt: input.at, extractor: "html_heading_v1", sectionCount: input.sections, outputPath: input.extraction },
  indexing: undefined,
  failureCodes: undefined,
  limitations: [...new Set([...record.limitations,
    "El snapshot HTML oficial fue adquirido y extraído localmente, pero permanece fuera del índice y de la proyección pública.",
    "La adquisición técnica no establece por sí sola vigencia, aplicabilidad jurídica ni que un acto municipal concreto haya ocurrido.",
    "Los documentos enlazados deben adquirirse como artefactos separados antes de citarlos.",
  ])],
  provenanceNotes: [...new Set([...record.provenanceNotes, `Feature 090 adquirió ${input.finalUrl} el ${input.at}, SHA-256 ${input.hash}, sin mutar el corpus administrado.`])],
  tags: [...new Set([...(record.tags ?? []).filter((tag) => tag !== "acquisition-pending"), "acquired", "clean-scan", "html-extracted", "ingestion-pending"])],
});

const blocked = (source: BoundSource, error: unknown): HtmlAcquisitionReceiptSource => {
  const normalized = error instanceof HtmlAcquisitionError
    ? error
    : new HtmlAcquisitionError("source_storage_error", error instanceof Error ? error.message : String(error));
  return {
    sourceId: source.record.sourceId, outcome: "blocked", sourceUrl: source.record.publicUrl!,
    inventoryStatusBefore: source.record.status, inventoryStatusAfter: source.record.status,
    failureCode: normalized.code, failureMessage: normalized.message.slice(0, 500),
  };
};

export const acquireSourcePackHtml = async (input: {
  plan: HtmlAcquisitionPlan;
  pack: SourcePackManifest;
  inventory: SourceInventoryManifestFile;
  libraryRoot: string;
  dependencies: HtmlAcquisitionDependencies;
}): Promise<{ inventory: SourceInventoryManifestFile; receipt: HtmlAcquisitionReceipt }> => {
  if (!isAbsolute(input.libraryRoot)) throw new Error("libraryRoot must be absolute.");
  await privateDirectory(resolve(input.libraryRoot));
  const root = await realpath(resolve(input.libraryRoot));
  const sources = bindSources(input.plan, input.pack, input.inventory);
  const records = new Map(input.inventory.records.map((record) => [record.sourceId, record]));
  const receiptSources: HtmlAcquisitionReceiptSource[] = [];
  const at = (input.dependencies.now ?? (() => new Date()))().toISOString();
  const fetchImpl = input.dependencies.fetchImpl ?? fetch;
  const resolveHost = input.dependencies.resolveHost ?? resolvePublicHost;

  for (const source of sources) {
    try {
      const fetched = await fetchHtml(source, input.pack, input.plan, fetchImpl, resolveHost);
      let structural;
      try {
        structural = inspectArtifactContent({ content: fetched.content, sourcePath: `${source.record.sourceId}.html`, declaredMediaType: "text/html", declaredCharset: fetched.charset, maxArtifactBytes: input.plan.maxArtifactBytes });
      } catch (error) {
        throw new HtmlAcquisitionError("source_structural_rejected", error instanceof Error ? error.message : String(error));
      }
      let scan;
      try { scan = await scanVerifiedArtifactSnapshot(fetched.content, `${source.record.sourceId}.html`, input.dependencies.scanner); }
      catch (error) { throw new HtmlAcquisitionError("source_malware_scan_error", error instanceof Error ? error.message : String(error)); }
      if (scan.verdict === "infected") throw new HtmlAcquisitionError("source_malware_detected", `ClamAV detected ${scan.signature ?? "malware"}.`);
      if (scan.verdict !== "clean" || !scan.definitionsVersion) throw new HtmlAcquisitionError("source_malware_scan_error", "Scanner did not produce complete clean evidence.");

      const hash = sha256(fetched.content);
      const base = `official/${input.pack.packId}/${input.plan.snapshotDate}/${source.record.sourceId}/${hash}`;
      const artifactRelative = `${base}.html`;
      const extractionRelative = `${base}.sections.json`;
      const artifactInventoryPath = `.rag/library/${artifactRelative}`;
      const extractionInventoryPath = `.rag/library/${extractionRelative}`;
      const document = await htmlExtractor.extract({
        title: source.record.title, content: fetched.content, sourcePath: artifactInventoryPath,
        metadata: { charset: fetched.charset, sourceId: source.record.sourceId, sourceUrl: source.record.publicUrl, finalUrl: fetched.finalUrl.href, contentSha256: hash },
      });
      const characters = document.text.trim().length;
      if (document.sections.length < input.plan.minimumSectionCount || characters < input.plan.minimumExtractedCharacters) {
        throw new HtmlAcquisitionError("source_extraction_insufficient", `Extraction produced ${document.sections.length} sections and ${characters} characters.`);
      }
      const reused = await immutableWrite(root, childPath(root, artifactRelative), fetched.content);
      const extraction = Buffer.from(`${JSON.stringify({ schemaVersion: 1, sourceId: source.record.sourceId, documentVersion: `snapshot-${input.plan.snapshotDate}-sha256-${hash.slice(0, 16)}`, sourceUrl: source.record.publicUrl, finalUrl: fetched.finalUrl.href, contentSha256: hash, charset: fetched.charset, document }, null, 2)}\n`, "utf8");
      await immutableWrite(root, childPath(root, extractionRelative), extraction);
      records.set(source.record.sourceId, successRecord(source.record, {
        at, date: input.plan.snapshotDate, hash, bytes: fetched.content.length, artifact: artifactInventoryPath,
        extraction: extractionInventoryPath, signature: structural.signature,
        scanner: { engine: scan.engine, version: scan.engineVersion, definitions: scan.definitionsVersion },
        sections: document.sections.length, finalUrl: fetched.finalUrl.href,
      }));
      receiptSources.push({
        sourceId: source.record.sourceId, outcome: "acquired", sourceUrl: source.record.publicUrl!,
        inventoryStatusBefore: source.record.status, inventoryStatusAfter: "ingestion_pending", finalUrl: fetched.finalUrl.href,
        redirects: fetched.redirects, responseStatus: fetched.status, responseMediaType: fetched.mediaType, charset: fetched.charset,
        byteLength: fetched.content.length, contentSha256: hash, artifactPath: artifactInventoryPath, extractionPath: extractionInventoryPath,
        structuralSignature: structural.signature, scanner: { engine: scan.engine, version: scan.engineVersion, definitionsVersion: scan.definitionsVersion },
        sectionCount: document.sections.length, extractedCharacters: characters, reused,
      });
    } catch (error) { receiptSources.push(blocked(source, error)); }
  }
  const successful = receiptSources.filter((item) => item.outcome === "acquired").length;
  return {
    inventory: { ...input.inventory, generatedAt: at, records: input.inventory.records.map((record) => records.get(record.sourceId) ?? record) },
    receipt: {
      schemaVersion: 1, acquisitionId: input.plan.acquisitionId, sourcePackId: input.plan.sourcePackId,
      snapshotDate: input.plan.snapshotDate, attemptedAt: at,
      result: successful >= input.plan.minimumSuccessfulSources ? "pass" : "insufficient_successes",
      attempted: receiptSources.length, successful, blocked: receiptSources.length - successful,
      minimumSuccessfulSources: input.plan.minimumSuccessfulSources, sources: receiptSources,
      managedCorpusMutation: false, indexingPerformed: false,
    },
  };
};
