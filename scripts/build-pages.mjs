import { cp, mkdir, rm, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const repoRoot = process.cwd();
const sourceDir = join(repoRoot, "public");
const outputDir = join(repoRoot, "dist-pages");

const isLocalhost = (hostname) => hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
const sanitizePagesApiUrl = (value) => {
  if (!value || !String(value).trim()) return "";
  const parsed = new URL(String(value).trim());
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("PAGES_API_URL must use https, or http for localhost only.");
  if (parsed.protocol === "http:" && !isLocalhost(parsed.hostname)) throw new Error("PAGES_API_URL must use https outside localhost.");
  if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("PAGES_API_URL must not contain credentials, query parameters, or fragments.");
  return parsed.href;
};
const escapeHtmlAttribute = (value) => value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const pagesApiUrl = sanitizePagesApiUrl(process.env.PAGES_API_URL || "");
const bridgeTag = `<script src="./pages-api-bridge.js"${pagesApiUrl ? ` data-api-url="${escapeHtmlAttribute(pagesApiUrl)}"` : ""}></script>`;
const guardTag = '<script src="./pages-security-guard.js"></script>';
const procedureEntrypointTag = '<script src="./procedure-widget-entrypoint.js"></script>';

const injectPagesRuntimeScripts = (html) => {
  let patched = html.replaceAll("<!-- PAGES_API_BRIDGE -->", `${bridgeTag}${guardTag}`);
  if (patched.includes('<script src="./widget.js"></script>') && !patched.includes('src="./pages-api-bridge.js"')) {
    patched = patched.replaceAll('<script src="./widget.js"></script>', `${bridgeTag}${guardTag}<script src="./widget.js"></script>${procedureEntrypointTag}`);
  } else if (patched.includes('<script src="./widget.js"></script>') && !patched.includes(procedureEntrypointTag)) {
    patched = patched.replaceAll('<script src="./widget.js"></script>', `<script src="./widget.js"></script>${procedureEntrypointTag}`);
  }
  return patched;
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
        .replaceAll('href="/procedure-training.html"', 'href="./procedure-training.html"')
        .replaceAll('href="/procedure-workflow.html"', 'href="./procedure-workflow.html"')
        .replaceAll('href="/procedure-feedback-dashboard.html"', 'href="./procedure-feedback-dashboard.html"')
        .replaceAll('href="/domain-intake.html"', 'href="./domain-intake.html"')
        .replaceAll('href="/index.html"', 'href="./index.html"')
        .replaceAll('src="/widget.js"', 'src="./widget.js"')
        .replaceAll('src="/product.js"', 'src="./product.js"')
        .replaceAll('href="/product.css"', 'href="./product.css"')
        .replaceAll('src="/procedure-widget-entrypoint.js"', 'src="./procedure-widget-entrypoint.js"')
        .replaceAll('src="/procedure-feedback.js"', 'src="./procedure-feedback.js"')
        .replaceAll('src="/assets/', 'src="./assets/')
        .replaceAll('href="/assets/', 'href="./assets/')
    );
    if (patched !== original) await writeFile(path, patched, "utf-8");
  }
};

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(sourceDir, outputDir, { recursive: true });
await writeFile(join(outputDir, ".nojekyll"), "", "utf-8");
await patchHtmlForProjectPages(outputDir);

console.log(`GitHub Pages artifact prepared at ${outputDir}${pagesApiUrl ? " with configured API" : " in fail-closed mode"}`);
