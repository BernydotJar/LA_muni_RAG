import { createHash } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, isAbsolute, normalize, relative, resolve } from "node:path";

const CONFIG = process.argv[2] ?? "evals/real-corpus/controlled-ingestion-config.json";
const INVENTORY = process.env.CONTROLLED_CORPUS_SOURCE_INVENTORY ?? ".rag/source-inventory.json";
const ROOT = process.env.CONTROLLED_CORPUS_LIBRARY_ROOT;
if (!ROOT || !isAbsolute(ROOT)) throw new Error("CONTROLLED_CORPUS_LIBRARY_ROOT must be an absolute path.");

const config = JSON.parse(await readFile(CONFIG, "utf8"));
const inventory = JSON.parse(await readFile(INVENTORY, "utf8"));
if (config.schemaVersion !== 1 || !Array.isArray(config.sources) || config.sources.length !== 2) {
  throw new Error("Controlled corpus config must declare exactly two schemaVersion 1 sources.");
}
const inventoryById = new Map(inventory.records.map((record) => [record.sourceId, record]));
const root = resolve(ROOT);
await mkdir(root, { recursive: true, mode: 0o700 });
await chmod(root, 0o700);

const digestFile = async (path) => {
  const bytes = await readFile(path);
  return { byteLength: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
};

const safeDestination = (relativePath) => {
  if (typeof relativePath !== "string" || relativePath.length < 1 || isAbsolute(relativePath)) {
    throw new Error("Controlled corpus relativePath must be relative.");
  }
  const destination = resolve(root, normalize(relativePath));
  const fromRoot = relative(root, destination);
  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new Error("Controlled corpus path escaped the library root.");
  }
  return destination;
};

const receipts = [];
for (const source of config.sources) {
  const record = inventoryById.get(source.sourceId);
  if (!record || record.publicUrl === undefined) throw new Error(`Missing registered public URL for ${source.sourceId}.`);
  const url = new URL(record.publicUrl);
  if (
    url.protocol !== "https:" || url.hostname !== "muniantigua.gob.gt" ||
    url.username || url.password || url.search || url.hash
  ) throw new Error(`Unapproved controlled source URL for ${source.sourceId}.`);
  if (!/^[0-9a-f]{64}$/.test(source.expectedSha256)) throw new Error(`Invalid expected hash for ${source.sourceId}.`);
  if (!Number.isSafeInteger(source.expectedByteLength) || source.expectedByteLength < 1 || source.expectedByteLength > 100 * 1024 * 1024) {
    throw new Error(`Invalid expected byte length for ${source.sourceId}.`);
  }

  const destination = safeDestination(source.relativePath);
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  try {
    const existing = await digestFile(destination);
    if (existing.byteLength === source.expectedByteLength && existing.sha256 === source.expectedSha256) {
      receipts.push({ sourceId: source.sourceId, url: url.href, path: source.relativePath, ...existing, reused: true });
      continue;
    }
    throw new Error(`Existing artifact identity mismatch for ${source.sourceId}.`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(120_000),
    headers: { accept: "application/pdf", "user-agent": "LA-Muni-RAG-controlled-corpus/1" },
  });
  if (response.status >= 300 && response.status < 400) throw new Error(`Redirect rejected for ${source.sourceId}.`);
  if (response.status !== 200 || !response.body) throw new Error(`Download failed for ${source.sourceId}: HTTP ${response.status}.`);
  const mediaType = (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/pdf") throw new Error(`Unexpected media type for ${source.sourceId}.`);
  const contentLength = Number(response.headers.get("content-length"));
  if (contentLength !== source.expectedByteLength) throw new Error(`Content-Length mismatch for ${source.sourceId}.`);

  const temporary = `${destination}.part-${process.pid}`;
  const handle = await open(temporary, "wx", 0o600);
  const hash = createHash("sha256");
  let total = 0;
  try {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array) || value.byteLength < 1) throw new Error(`Invalid response body for ${source.sourceId}.`);
      total += value.byteLength;
      if (total > source.expectedByteLength) throw new Error(`Download exceeded expected size for ${source.sourceId}.`);
      hash.update(value);
      await handle.write(value);
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
  const actualHash = hash.digest("hex");
  if (total !== source.expectedByteLength || actualHash !== source.expectedSha256) {
    await rm(temporary, { force: true });
    throw new Error(`Downloaded artifact identity mismatch for ${source.sourceId}.`);
  }
  await chmod(temporary, 0o600);
  await rename(temporary, destination);
  const finalStat = await stat(destination);
  if (!finalStat.isFile() || finalStat.size !== source.expectedByteLength) throw new Error(`Published artifact mismatch for ${source.sourceId}.`);
  receipts.push({ sourceId: source.sourceId, url: url.href, path: source.relativePath, byteLength: total, sha256: actualHash, reused: false });
}

process.stdout.write(`${JSON.stringify({ schemaVersion: 1, acquiredAt: new Date().toISOString(), sources: receipts }, null, 2)}\n`);
