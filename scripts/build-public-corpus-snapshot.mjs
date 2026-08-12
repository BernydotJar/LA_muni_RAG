import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith("--") || value === undefined) throw new Error("Arguments must be --key value pairs.");
  args.set(key, value);
}

const required = (name) => {
  const value = args.get(name);
  if (!value) throw new Error(`Missing ${name}.`);
  return resolve(value);
};

const inventoryPath = resolve(args.get("--inventory") ?? ".rag/source-inventory.json");
const outputPath = required("--output");
const extractionPaths = new Map([
  ["antigua-pdm-ot", required("--module1")],
  ["antigua-pdmot-module-3", required("--module3")],
  ["antigua-pdmot-module-4", required("--module4")],
]);
const allowedSourceIds = [...extractionPaths.keys()];
const CONTROL_CHARACTER = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

const normalizeText = (value) => String(value ?? "").replace(/\s+/gu, " ").trim();
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.records)) throw new Error("Unsupported source inventory.");
const inventoryById = new Map(inventory.records.map((record) => [record.sourceId, record]));

const sources = [];
const sections = [];
for (const sourceId of allowedSourceIds) {
  const record = inventoryById.get(sourceId);
  if (!record) throw new Error(`Missing source inventory record ${sourceId}.`);
  if (record.status !== "ingested" || record.officialSource !== true || record.officialForTargetJurisdiction !== true) {
    throw new Error(`Source ${sourceId} is not an ingested official target-jurisdiction source.`);
  }
  const sourceUrl = new URL(record.publicUrl);
  if (sourceUrl.protocol !== "https:" || sourceUrl.hostname !== "muniantigua.gob.gt" || sourceUrl.username || sourceUrl.password || sourceUrl.search || sourceUrl.hash) {
    throw new Error(`Source ${sourceId} has an unsafe public URL.`);
  }
  const contentSha256 = record.acquisition?.contentSha256;
  if (!/^[0-9a-f]{64}$/.test(contentSha256 ?? "")) throw new Error(`Source ${sourceId} lacks a frozen content hash.`);
  if (record.artifactSafety?.verdict !== "clean" || record.artifactSafety?.contentSha256 !== contentSha256) {
    throw new Error(`Source ${sourceId} is not bound to the frozen clean artifact decision.`);
  }

  const extraction = JSON.parse(await readFile(extractionPaths.get(sourceId), "utf8"));
  if (extraction.schemaVersion !== 1 || extraction.ok !== true || !Array.isArray(extraction.pages)) {
    throw new Error(`Extraction for ${sourceId} is invalid.`);
  }
  if (extraction.pages.length !== record.extraction?.sectionCount) {
    throw new Error(`Extraction page count for ${sourceId} does not match the governed inventory.`);
  }

  const observedPages = new Set();
  for (const page of extraction.pages) {
    if (!Number.isSafeInteger(page.page) || page.page < 1 || observedPages.has(page.page)) {
      throw new Error(`Extraction for ${sourceId} has an invalid or duplicate page number.`);
    }
    observedPages.add(page.page);
    const text = normalizeText(page.text);
    if (!text || Buffer.byteLength(text, "utf8") > 262_144 || CONTROL_CHARACTER.test(text)) {
      throw new Error(`Extraction for ${sourceId} page ${page.page} violates public snapshot text bounds.`);
    }
    sections.push({
      id: sha256(`${sourceId}\n${contentSha256}\n${page.page}\n${text}`).slice(0, 32),
      sourceId,
      documentKey: record.documentKey,
      documentVersion: record.documentVersion,
      title: record.title,
      sourceUrl: sourceUrl.href,
      pageStart: page.page,
      pageEnd: page.page,
      text,
    });
  }

  sources.push({
    sourceId,
    documentKey: record.documentKey,
    documentVersion: record.documentVersion,
    title: record.title,
    sourceUrl: sourceUrl.href,
    contentSha256,
    byteLength: record.acquisition.byteLength,
    pageCount: extraction.pageCount,
    extractedPageCount: extraction.pages.length,
    authorityClass: record.authorityClass,
    authorityLevel: record.authorityLevel,
    verifiedAt: record.verifiedAt,
    publicationDate: record.publicationDate ?? null,
    limitations: Array.isArray(record.limitations) ? record.limitations.slice(0, 8) : [],
  });
}

sections.sort((left, right) => left.sourceId.localeCompare(right.sourceId) || left.pageStart - right.pageStart);
const snapshot = {
  schemaVersion: 1,
  corpusKind: "public_official_municipal_static_projection_v1",
  generatedAt: process.env.PUBLIC_CORPUS_GENERATED_AT ?? new Date().toISOString(),
  jurisdiction: inventory.targetJurisdiction,
  retrieval: {
    modes: ["keyword", "phrase"],
    semanticModel: false,
    serverAudit: false,
    staticProjection: true,
  },
  sources,
  sections,
};

await writeFile(outputPath, `${JSON.stringify(snapshot)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({
  output: outputPath,
  sourceCount: sources.length,
  sectionCount: sections.length,
  bytes: Buffer.byteLength(JSON.stringify(snapshot), "utf8"),
  sha256: sha256(JSON.stringify(snapshot)),
}, null, 2)}\n`);
