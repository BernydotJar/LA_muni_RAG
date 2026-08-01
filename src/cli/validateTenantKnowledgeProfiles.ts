import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseSourcePack, type SourcePackManifest } from "../sources/sourcePack.js";
import { parseTenantKnowledgeProfile } from "../tenancy/tenantKnowledgeProfile.js";

const sourcePackRoot = process.argv[2] ?? "config/source-packs";
const profileRoot = process.argv[3] ?? "config/tenant-profiles";

const jsonFiles = async (root: string): Promise<string[]> => {
  const files: string[] = [];
  const visit = async (path: string): Promise<void> => {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const target = join(path, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile() && entry.name.endsWith(".json")) files.push(target);
    }
  };
  await visit(root);
  return files.sort();
};

const sourcePacks = new Map<string, SourcePackManifest>();
for (const file of await jsonFiles(sourcePackRoot)) {
  const pack = parseSourcePack(await readFile(file, "utf8"));
  if (sourcePacks.has(pack.packId)) throw new Error(`Duplicate source pack id: ${pack.packId}.`);
  sourcePacks.set(pack.packId, pack);
}

const profileFiles = await jsonFiles(profileRoot);
if (profileFiles.length === 0) throw new Error(`No tenant knowledge profiles found under ${profileRoot}.`);
const profileIds = new Set<string>();
for (const file of profileFiles) {
  const profile = parseTenantKnowledgeProfile(await readFile(file, "utf8"), sourcePacks);
  if (profileIds.has(profile.profileId)) throw new Error(`Duplicate tenant knowledge profile id: ${profile.profileId}.`);
  profileIds.add(profile.profileId);
}
console.log(JSON.stringify({ status: "pass", sourcePackCount: sourcePacks.size, tenantProfileCount: profileIds.size, files: profileFiles }));
