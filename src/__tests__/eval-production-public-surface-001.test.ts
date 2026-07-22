import { access, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("EVAL-PRODUCTION-PUBLIC-SURFACE-001", () => {
  it("publishes a concise product shell with direct Assistant and Glass Wall navigation", async () => {
    const html = await read("public/index.html");
    assert.match(html, /data-open-assistant>Asistente/);
    assert.match(html, /href="\.\/glass-wall\.html">Glass Wall/);
    assert.match(html, /href="#instalar">Instalar/);
    assert.doesNotMatch(html, /id="scroll-story"|cinematic-strip|story-card/);
    assert.doesNotMatch(html, /Experiencia con evidencia|Flujo visual|Sistema operable/);
  });

  it("uses modular accessible styling with a reserved interaction color", async () => {
    const html = await read("public/index.html");
    const css = await read("public/product.css");
    const js = await read("public/product.js");
    assert.match(html, /href="\.\/product\.css"/);
    assert.match(html, /src="\.\/product\.js"/);
    assert.match(css, /--action:#67e8f9/);
    assert.match(css, /:focus-visible/);
    assert.match(css, /background:rgba\(6,9,22,\.94\)/);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(js, /\[data-open-assistant\]/);
  });

  it("fails closed on Pages and contains no static answer or procedure fixtures", async () => {
    const bridge = await read("public/pages-api-bridge.js");
    await assert.rejects(access("public/pages-demo-api.js"));
    assert.match(bridge, /service_unavailable/);
    assert.match(bridge, /status: 503/);
    assert.match(bridge, /x-la-muni-rag-api-configured/);
    assert.doesNotMatch(bridge, /demoResponse|demoProcedureResponse|demoDomainPackResponse/);
    assert.match(bridge, /"\/api\/public\/v1\/query"/);
    assert.doesNotMatch(bridge, /PDM-OT Antigua Guatemala|procedureStep/);
  });

  it("disables the unconfigured widget and removes ungrounded corpus claims", async () => {
    const widget = await read("public/widget.js");
    assert.match(widget, /Servicio no configurado/);
    assert.match(widget, /Consulta deshabilitada hasta configurar la API/);
    assert.match(widget, /if\(!apiConfigured\)/);
    assert.match(widget, /explicitApiUrl\.length > 0/);
    assert.doesNotMatch(widget, /Modo demo municipal/);
    assert.doesNotMatch(widget, /Documentos municipales verificados/);
    assert.doesNotMatch(widget, /documentos municipales oficiales cargados en el corpus/);
  });

  it("accepts only an explicit safe build-time Pages API URL", async () => {
    const build = await read("scripts/build-pages.mjs");
    const workflow = await read(".github/workflows/deploy-pages.yml");
    assert.match(build, /PAGES_API_URL/);
    assert.match(build, /must use https outside localhost/);
    assert.match(build, /must not contain credentials, query parameters, or fragments/);
    assert.match(workflow, /PAGES_API_URL: \$\{\{ vars\.PAGES_API_URL \}\}/);
  });

  it("keeps legacy browser routes disabled and requires a dedicated public gateway", async () => {
    const server = await read("src/server.ts");
    const productionTest = await read("src/__tests__/production-server-surface.test.ts");
    const decision = await read("docs/decisions/071-production-public-surface-and-gcp-target.md");
    assert.match(server, /process\.env\.NODE_ENV !== "production"/);
    assert.match(productionTest, /"\/api\/chat"/);
    assert.match(productionTest, /rejects unapproved public query origins/);
    assert.match(productionTest, /public query is disabled/);
    assert.match(decision, /dedicated public query gateway\/BFF/);
    assert.match(decision, /Do not put integration Bearer credentials in browser code/);
  });

  it("selects GCP without creating billable infrastructure", async () => {
    const decision = await read("docs/decisions/071-production-public-surface-and-gcp-target.md");
    const blueprint = await read("docs/operations/gcp-production-blueprint.md");
    const infraReadme = await read("infra/gcp/README.md");
    assert.match(decision, /Select Google Cloud as the target platform/);
    assert.match(blueprint, /Cloud Run public-query gateway\/BFF/);
    assert.match(blueprint, /Cloud SQL PostgreSQL \+ pgvector/);
    assert.match(blueprint, /minimum instances: `0`/);
    assert.match(infraReadme, /without creating a project, enabling billing[\s\S]*provisioning a billable resource/i);
    assert.match(infraReadme, /terraform apply.*outside automated repository workflows/is);
  });

  it("keeps external SEO, OCR and design references outside the production runtime", async () => {
    const assessment = await read("docs/research/071-external-tool-assessment.md");
    const design = await read("DESIGN.md");
    assert.match(assessment, /OpenSEO/);
    assert.match(assessment, /does not belong in the retrieval/);
    assert.match(assessment, /Unlimited-OCR/);
    assert.match(assessment, /isolated OCR benchmark/);
    assert.match(assessment, /awesome-design-md/);
    assert.match(design, /Do not introduce Tailwind/);
  });
});
