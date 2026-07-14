import { cp, mkdir, rm, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const repoRoot = process.cwd();
const sourceDir = join(repoRoot, "public");
const outputDir = join(repoRoot, "dist-pages");

const injectPagesRuntimeScripts = (html) => {
  const bridgeTag = '<script src="./pages-demo-api.js" data-demo-mode="auto"></script>';
  const guardTag = '<script src="./pages-security-guard.js"></script>';
  const procedureEntrypointTag = '<script src="./procedure-widget-entrypoint.js"></script>';
  if (html.includes(bridgeTag) && html.includes(guardTag) && html.includes(procedureEntrypointTag)) return html;

  return html.replaceAll(
    '<script src="./widget.js"></script>',
    `${bridgeTag}${guardTag}<script src="./widget.js"></script>${procedureEntrypointTag}`
  );
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
    const patched = injectPagesRuntimeScripts(
      original
        .replaceAll('href="/"', 'href="./index.html"')
        .replaceAll('href="/glass-wall.html"', 'href="./glass-wall.html"')
        .replaceAll('href="/procedure-workflow.html"', 'href="./procedure-workflow.html"')
        .replaceAll('href="/war-room-electoral.html"', 'href="./war-room-electoral.html"')
        .replaceAll('href="/procedure-feedback-dashboard.html"', 'href="./procedure-feedback-dashboard.html"')
        .replaceAll('href="/domain-intake.html"', 'href="./domain-intake.html"')
        .replaceAll('href="/index.html"', 'href="./index.html"')
        .replaceAll('src="/widget.js"', 'src="./widget.js"')
        .replaceAll('src="/procedure-widget-entrypoint.js"', 'src="./procedure-widget-entrypoint.js"')
        .replaceAll('src="/procedure-feedback.js"', 'src="./procedure-feedback.js"')
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
