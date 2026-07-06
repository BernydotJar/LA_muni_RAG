import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const repoRoot = process.cwd();
const outputDir = join(repoRoot, "dist-pages");

const requiredFiles = [
  "index.html",
  "glass-wall.html",
  "widget.js",
  ".nojekyll",
];

const assertFileExists = async (relativePath) => {
  await access(join(outputDir, relativePath));
};

for (const file of requiredFiles) {
  await assertFileExists(file);
}

const indexHtml = await readFile(join(outputDir, "index.html"), "utf-8");
const glassWallHtml = await readFile(join(outputDir, "glass-wall.html"), "utf-8");

const forbiddenRootRelativePatterns = [
  'href="/glass-wall.html"',
  'href="/index.html"',
  'src="/widget.js"',
  'src="/assets/',
  'href="/assets/',
];

for (const pattern of forbiddenRootRelativePatterns) {
  if (indexHtml.includes(pattern) || glassWallHtml.includes(pattern)) {
    throw new Error(`GitHub Pages artifact still contains root-relative static reference: ${pattern}`);
  }
}

console.log("GitHub Pages artifact verified.");
