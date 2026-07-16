import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const repoRoot = process.cwd();
const outputDir = join(repoRoot, "dist-pages");

const requiredFiles = [
  "index.html",
  "glass-wall.html",
  "procedure-workflow.html",
  "procedure-feedback-dashboard.html",
  "procedure-case-portfolio.html",
  "procedure-case-portfolio.css",
  "procedure-case-portfolio.js",
  "domain-intake.html",
  "widget.js",
  "procedure-widget-entrypoint.js",
  "procedure-feedback.js",
  "procedure-deep-dive.js",
  "procedure-source-attribution.js",
  "procedure-case-workspace.js",
  "procedure-case-open.js",
  "pages-demo-api.js",
  "pages-security-guard.js",
  ".nojekyll",
];

for (const file of requiredFiles) await access(join(outputDir, file));

const indexHtml = await readFile(join(outputDir, "index.html"), "utf-8");
const glassWallHtml = await readFile(join(outputDir, "glass-wall.html"), "utf-8");
const procedureWorkflowHtml = await readFile(join(outputDir, "procedure-workflow.html"), "utf-8");
const feedbackDashboardHtml = await readFile(join(outputDir, "procedure-feedback-dashboard.html"), "utf-8");
const casePortfolioHtml = await readFile(join(outputDir, "procedure-case-portfolio.html"), "utf-8");
const casePortfolioCss = await readFile(join(outputDir, "procedure-case-portfolio.css"), "utf-8");
const casePortfolioJs = await readFile(join(outputDir, "procedure-case-portfolio.js"), "utf-8");
const domainIntakeHtml = await readFile(join(outputDir, "domain-intake.html"), "utf-8");
const procedureFeedbackJs = await readFile(join(outputDir, "procedure-feedback.js"), "utf-8");
const procedureDeepDiveJs = await readFile(join(outputDir, "procedure-deep-dive.js"), "utf-8");
const procedureSourceAttributionJs = await readFile(join(outputDir, "procedure-source-attribution.js"), "utf-8");
const procedureCaseWorkspaceJs = await readFile(join(outputDir, "procedure-case-workspace.js"), "utf-8");
const procedureCaseOpenJs = await readFile(join(outputDir, "procedure-case-open.js"), "utf-8");

const forbiddenRootRelativePatterns = [
  'href="/"', 'href="/glass-wall.html"', 'href="/procedure-workflow.html"',
  'href="/procedure-feedback-dashboard.html"', 'href="/procedure-case-portfolio.html"',
  'href="/domain-intake.html"', 'href="/index.html"', 'src="/widget.js"',
  'src="/procedure-widget-entrypoint.js"', 'src="/procedure-feedback.js"',
  'src="/procedure-deep-dive.js"', 'src="/procedure-source-attribution.js"',
  'src="/procedure-case-workspace.js"', 'src="/procedure-case-open.js"',
  'src="/procedure-case-portfolio.js"', 'href="/procedure-case-portfolio.css"',
  'src="/assets/', 'href="/assets/',
];

for (const pattern of forbiddenRootRelativePatterns) {
  if ([indexHtml, glassWallHtml, procedureWorkflowHtml, feedbackDashboardHtml, casePortfolioHtml, domainIntakeHtml].some((value) => value.includes(pattern))) {
    throw new Error(`GitHub Pages artifact still contains root-relative static reference: ${pattern}`);
  }
}

if (!indexHtml.includes('src="./pages-demo-api.js" data-demo-mode="auto"')) throw new Error("GitHub Pages artifact is missing the demo/API bridge before the widget.");
if (!indexHtml.includes('src="./pages-security-guard.js"')) throw new Error("GitHub Pages artifact is missing the source-link security guard.");
if (!indexHtml.includes('src="./procedure-widget-entrypoint.js"')) throw new Error("GitHub Pages artifact is missing the procedure workflow widget entrypoint.");
if (!procedureWorkflowHtml.includes('src="./pages-demo-api.js" data-demo-mode="auto"')) throw new Error("Procedure workflow page is missing the Pages demo/API bridge.");
if (!procedureWorkflowHtml.includes('src="./procedure-feedback.js"')) throw new Error("Procedure workflow page is missing the feedback loop script.");
if (!procedureFeedbackJs.includes('./procedure-deep-dive.js')) throw new Error("Procedure workflow feedback loader is missing the deep-dive UI enhancement.");
if (!procedureFeedbackJs.includes('./procedure-source-attribution.js')) throw new Error("Procedure workflow feedback loader is missing official source attribution.");
if (!procedureFeedbackJs.includes('./procedure-case-workspace.js')) throw new Error("Procedure workflow feedback loader is missing the case workspace enhancement.");
if (!procedureFeedbackJs.includes('./procedure-case-open.js') || !procedureFeedbackJs.includes('./procedure-case-portfolio.html')) throw new Error("Procedure workflow feedback loader is missing the case opener or portfolio entrypoint.");
if (!procedureDeepDiveJs.includes('value="deep_dive"') || !procedureDeepDiveJs.includes('Dependencias y decisiones')) throw new Error("Procedure deep-dive artifact is missing its depth control or dependency rendering.");
if (!procedureSourceAttributionJs.includes("official_municipal") || !procedureSourceAttributionJs.includes("official_national") || !procedureSourceAttributionJs.includes("Abrir fuente oficial") || !procedureSourceAttributionJs.includes("noopener noreferrer")) throw new Error("Procedure source attribution artifact is missing authority labels or safe source links.");
if (!procedureCaseWorkspaceJs.includes("la-muni-rag:procedure-case:") || !procedureCaseWorkspaceJs.includes("Seguimiento operativo, no evidencia legal") || !procedureCaseWorkspaceJs.includes("auditLog.push")) throw new Error("Procedure case workspace artifact is missing storage, safety, or audit controls.");
if (!procedureCaseOpenJs.includes("CASE_KEY_PATTERN") || !procedureCaseOpenJs.includes("workflowSnapshot?.query") || !procedureCaseOpenJs.includes("procedure-workflow-form")) throw new Error("Procedure case opener is missing bounded key validation or workflow restoration.");

if (
  !casePortfolioHtml.includes("Portafolio local de casos") ||
  !casePortfolioHtml.includes("Señales operativas, no dictamen institucional") ||
  !casePortfolioHtml.includes('href="./procedure-case-portfolio.css"') ||
  !casePortfolioHtml.includes('src="./procedure-case-portfolio.js"') ||
  !casePortfolioHtml.includes("</body>") ||
  !casePortfolioHtml.includes("</html>") ||
  !casePortfolioCss.includes(".case-grid") ||
  !casePortfolioJs.includes("la-muni-rag:procedure-case:") ||
  !casePortfolioJs.includes("case-portfolio-export.json")
) {
  throw new Error("Case portfolio dashboard is missing complete shell, styles, local storage, safety, or export controls.");
}

if (!feedbackDashboardHtml.includes('la-muni-rag:procedure-feedback')) throw new Error("Feedback dashboard is missing the localStorage feedback key.");
if (!domainIntakeHtml.includes('src="./pages-demo-api.js" data-demo-mode="auto"')) throw new Error("Domain intake page is missing the Pages demo/API bridge.");
if (!domainIntakeHtml.includes('/api/domain-pack')) throw new Error("Domain intake page is missing the active domain-pack metadata route.");

console.log("GitHub Pages artifact verified.");