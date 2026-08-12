#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const inventory = JSON.parse(await readFile(".rag/source-inventory.json", "utf8"));
const snapshot = JSON.parse(await readFile("public/public-corpus-snapshot.json", "utf8"));
const domain = JSON.parse(await readFile("public/public-domain-pack-snapshot.json", "utf8"));
const fallback = await readFile("public/public-corpus-fallback.js", "utf8");
const expectedIds = ["antigua-pdm-ot", "antigua-pdmot-module-3", "antigua-pdmot-module-4"];
const expectedHashes = new Map([
  ["antigua-pdm-ot", "824f0ee47106f062269a7c65cb3433435470bbe609054972eb29c360f368cd0b"],
  ["antigua-pdmot-module-3", "dc67c503155c8fe85a6d4ac28b54c715e6293ab8261484d2531750a9ab17a3f0"],
  ["antigua-pdmot-module-4", "73186847344904a6c4ee64668dad0ec43628b3ca65ed8f12a192a05705a26fa9"],
]);
const expectedPages = new Map([
  ["antigua-pdm-ot", 224],
  ["antigua-pdmot-module-3", 46],
  ["antigua-pdmot-module-4", 22],
]);
const CONTROL_CHARACTER = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const digest = (value) => createHash("sha256").update(value).digest("hex");
const fail = (message) => { throw new Error(message); };

if (inventory?.schemaVersion !== 1 || !Array.isArray(inventory.records)) fail("Source inventory schema is invalid.");
if (snapshot?.schemaVersion !== 1 || snapshot?.corpusKind !== "public_official_municipal_static_projection_v1") fail("Public corpus snapshot schema is invalid.");
if (snapshot?.jurisdiction !== inventory.targetJurisdiction) fail("Public corpus snapshot jurisdiction drifted from the governed inventory.");
if (snapshot?.retrieval?.semanticModel !== false || snapshot?.retrieval?.serverAudit !== false || snapshot?.retrieval?.staticProjection !== true) fail("Public corpus snapshot overclaims runtime capabilities.");
if (!Array.isArray(snapshot.sources) || snapshot.sources.length !== 3) fail("Public corpus snapshot must contain exactly three sources.");
if (!Array.isArray(snapshot.sections) || snapshot.sections.length !== 292) fail("Public corpus snapshot must contain exactly 292 page-level sections.");
if (Buffer.byteLength(JSON.stringify(snapshot), "utf8") > 2 * 1024 * 1024) fail("Public corpus snapshot exceeds the reviewed 2 MiB bound.");

const records = new Map(inventory.records.map((record) => [record.sourceId, record]));
for (const sourceId of expectedIds) {
  const source = snapshot.sources.find((item) => item.sourceId === sourceId);
  const record = records.get(sourceId);
  if (!source || !record) fail(`Missing governed source ${sourceId}.`);
  if (source.contentSha256 !== expectedHashes.get(sourceId) || source.contentSha256 !== record.acquisition?.contentSha256) fail(`Hash mismatch for ${sourceId}.`);
  if (source.extractedPageCount !== expectedPages.get(sourceId) || source.extractedPageCount !== record.extraction?.sectionCount) fail(`Extracted page-count mismatch for ${sourceId}.`);
  if (source.sourceUrl !== record.publicUrl) fail(`Public URL mismatch for ${sourceId}.`);
  const parsed = new URL(source.sourceUrl);
  if (parsed.protocol !== "https:" || parsed.hostname !== "muniantigua.gob.gt" || parsed.username || parsed.password || parsed.search || parsed.hash) fail(`Unsafe public URL for ${sourceId}.`);
  if (record.status !== "ingested" || record.officialSource !== true || record.officialForTargetJurisdiction !== true) fail(`Source ${sourceId} is no longer eligible for the public snapshot.`);
  if (record.artifactSafety?.verdict !== "clean" || record.artifactSafety?.contentSha256 !== source.contentSha256) fail(`Source ${sourceId} lost its clean exact-byte safety binding.`);
}
if (snapshot.sources.some((source) => !expectedIds.includes(source.sourceId))) fail("Unexpected source entered the public snapshot.");

const seenIds = new Set();
const sectionsPerSource = new Map(expectedIds.map((sourceId) => [sourceId, 0]));
for (const section of snapshot.sections) {
  if (!expectedIds.includes(section.sourceId)) fail(`Unexpected section source ${section.sourceId}.`);
  if (!/^[0-9a-f]{32}$/.test(section.id ?? "") || seenIds.has(section.id)) fail("Public corpus section IDs must be unique stable 128-bit hex labels.");
  seenIds.add(section.id);
  if (!Number.isSafeInteger(section.pageStart) || section.pageStart < 1 || section.pageEnd !== section.pageStart) fail(`Invalid page range in ${section.id}.`);
  if (typeof section.text !== "string" || !section.text.trim() || Buffer.byteLength(section.text, "utf8") > 262_144 || CONTROL_CHARACTER.test(section.text)) fail(`Unsafe text in ${section.id}.`);
  const source = snapshot.sources.find((item) => item.sourceId === section.sourceId);
  if (section.sourceUrl !== source.sourceUrl || section.title !== source.title || section.documentVersion !== source.documentVersion) fail(`Section metadata drift in ${section.id}.`);
  sectionsPerSource.set(section.sourceId, (sectionsPerSource.get(section.sourceId) ?? 0) + 1);
}
for (const [sourceId, count] of sectionsPerSource) if (count !== expectedPages.get(sourceId)) fail(`Section count mismatch for ${sourceId}.`);

if (domain?.schemaVersion !== 1 || domain?.ui?.id !== "municipal-antigua") fail("Public domain snapshot does not represent municipal-antigua.");
if (!Array.isArray(domain.classifierRules) || domain.classifierRules.length !== 9) fail("Public domain classifier snapshot is incomplete.");
if (!Array.isArray(domain.workflowTemplates) || domain.workflowTemplates.length !== 5) fail("Public domain workflow snapshot is incomplete.");
if (!domain.workflowTemplates.some((item) => item.workflowType === "potable_water_project") || !domain.workflowTemplates.some((item) => item.workflowType === "unknown")) fail("Public domain snapshot lacks required bounded workflow templates.");
const serializedDomain = JSON.stringify(domain);
if (/client[_-]?secret|bearer\s|password|private[_-]?key/i.test(serializedDomain)) fail("Public domain snapshot contains a secret-like field/value.");

for (const requiredMarker of ["__LA_MUNI_PUBLIC_FALLBACK__", "staticFallback: true", "semanticSearch: false", "serverAudit: false", "official_target_jurisdiction", "undetermined"]) {
  if (!fallback.includes(requiredMarker)) fail(`Fallback runtime is missing ${requiredMarker}.`);
}

const findPdfFiles = async (root) => {
  const found = [];
  for (const name of await readdir(root)) {
    const path = join(root, name);
    const info = await stat(path);
    if (info.isDirectory()) found.push(...await findPdfFiles(path));
    else if (name.toLowerCase().endsWith(".pdf")) found.push(path);
  }
  return found;
};
const publicPdfs = await findPdfFiles("public");
if (publicPdfs.length) fail(`Raw PDF artifacts must not ship in Pages: ${publicPdfs.join(", ")}`);

process.stdout.write(`${JSON.stringify({
  status: "pass",
  sourceCount: snapshot.sources.length,
  sectionCount: snapshot.sections.length,
  snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot), "utf8"),
  snapshotSha256: digest(JSON.stringify(snapshot)),
  domainSnapshotSha256: digest(JSON.stringify(domain)),
  rawPublicPdfCount: publicPdfs.length,
}, null, 2)}\n`);
