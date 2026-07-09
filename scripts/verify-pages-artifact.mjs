import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const repoRoot = process.cwd();
const outputDir = join(repoRoot, "dist-pages");

const requiredFiles = [
  "index.html",
  "glass-wall.html",
  "procedure-workflow.html",
  "widget.js",
  "procedure-widget-entrypoint.js",
  "procedure-feedback.js",
  "pages-demo-api.js",
  "pages-security-guard.js",
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
const procedureWorkflowHtml = await readFile(join(outputDir, "procedure-workflow.html"), "utf-8");

const forbiddenRootRelativePatterns = [
  'href="/"',
  'href="/glass-wall.html"',
  'href="/procedure-workflow.html"',
  'href="/index.html"',
  'src="/widget.js"',
  'src="/procedure-widget-entrypoint.js"',
  'src="/procedure-feedback.js"',
  'src="/assets/',
  'href="/assets/',
];

for (const pattern of forbiddenRootRelativePatterns) {
  if (indexHtml.includes(pattern) || glassWallHtml.includes(pattern) || procedureWorkflowHtml.includes(pattern)) {
    throw new Error(`GitHub Pages artifact still contains root-relative static reference: ${pattern}`);
  }
}

if (!indexHtml.includes('src="./pages-demo-api.js" data-demo-mode="auto"')) {
  throw new Error("GitHub Pages artifact is missing the demo/API bridge before the widget.");
}

if (!indexHtml.includes('src="./pages-security-guard.js"')) {
  throw new Error("GitHub Pages artifact is missing the source-link security guard.");
}

if (!indexHtml.includes('src="./procedure-widget-entrypoint.js"')) {
  throw new Error("GitHub Pages artifact is missing the procedure workflow widget entrypoint.");
}

if (!procedureWorkflowHtml.includes('src="./pages-demo-api.js" data-demo-mode="auto"')) {
  throw new Error("Procedure workflow page is missing the Pages demo/API bridge.");
}

if (!procedureWorkflowHtml.includes('src="./procedure-feedback.js"')) {
  throw new Error("Procedure workflow page is missing the feedback loop script.");
}

console.log("GitHub Pages artifact verified.");
