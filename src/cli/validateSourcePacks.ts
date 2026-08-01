import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseSourcePack } from "../sources/sourcePack.js";

const root = process.argv[2] ?? "config/source-packs";
const files: string[] = [];

const visit = async (path: string): Promise<void> => {
  const entries = await readdir(path, { withFileTypes: true });
  for (const entry of entries) {
    const target = join(path, entry.name);
    if (entry.isDirectory()) await visit(target);
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(target);
  }
};

await visit(root);
if (files.length === 0) throw new Error(`No source packs found under ${root}.`);
for (const file of files.sort()) parseSourcePack(await readFile(file, "utf8"));
console.log(JSON.stringify({ status: "pass", sourcePackCount: files.length, files: files.sort() }));
