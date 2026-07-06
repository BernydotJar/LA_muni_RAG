import { cp, mkdir, rm, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const repoRoot = process.cwd();
const sourceDir = join(repoRoot, "public");
const outputDir = join(repoRoot, "dist-pages");

const injectPagesDemoBridge = (html) => {
  const bridgeTag = '<script src="./pages-demo-api.js" data-demo-mode="auto"></script>';
  if (html.includes(bridgeTag)) return html;
  return html.replaceAll('<script src="./widget.js"></script>', `${bridgeTag}<script src="./widget.js"></script>`);
};

const patchHtmlForProjectPages = async (dir) => {
  const entries = await readdir(dir);

  for (const entry of entries) {
    const path = join(dir, entry);
    const info = await stat(path);

    if (info.isDirectory()) {
      await patchHtmlForProjectPages(path);
      continue;
    }

    if (!entry.endsWith(".html")) continue;

    const original = await readFile(path, "utf-8");
    const patched = injectPagesDemoBridge(
      original
        .replaceAll('href="/glass-wall.html"', 'href="./glass-wall.html"')
        .replaceAll('href="/index.html"', 'href="./index.html"')
        .replaceAll('src="/widget.js"', 'src="./widget.js"')
        .replaceAll('src="/assets/', 'src="./assets/')
        .replaceAll('href="/assets/', 'href="./assets/')
    );

    if (patched !== original) {
      await writeFile(path, patched, "utf-8");
    }
  }
};

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(sourceDir, outputDir, { recursive: true });
await writeFile(join(outputDir, ".nojekyll"), "", "utf-8");
await patchHtmlForProjectPages(outputDir);

console.log(`GitHub Pages artifact prepared at ${outputDir}`);
