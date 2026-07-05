import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readGlassWall = async (): Promise<string> => readFile("public/glass-wall.html", "utf-8");

describe("premium glass wall technical room", () => {
  it("keeps the Glass Wall technical graph entry point in Spanish", async () => {
    const html = await readGlassWall();

    assert.match(html, /RAG Glass Wall/);
    assert.match(html, /Vista técnica/);
    assert.match(html, /glass-wall-graph/);
    assert.match(html, /Ruta observable de consulta/);
    assert.match(html, /Mapa de señales/);
  });

  it("adds homepage-coherent technical room chrome", async () => {
    const html = await readGlassWall();

    assert.match(html, /class="back-link" href="\/"/);
    assert.match(html, /Volver al inicio/);
    assert.match(html, /Sala técnica/);
    assert.match(html, /salida segura observable/);
  });

  it("keeps the approved inspection endpoints unchanged", async () => {
    const html = await readGlassWall();

    assert.match(html, /const approvedEndpointPaths = \["\/health", "\/api\/evidence", "\/api\/answer"\]/);
  });

  it("preserves the Spanish safety contract language", async () => {
    const html = await readGlassWall();

    assert.match(html, /Contrato de seguridad/);
    assert.match(html, /salida segura de la API/);
    assert.match(html, /No muestra prompts/);
    assert.match(html, /credenciales/);
    assert.match(html, /llaves de proveedor/);
    assert.match(html, /URLs de base de datos/);
  });

  it("uses premium panel nodes instead of the old circular node visual", async () => {
    const html = await readGlassWall();

    assert.match(html, /grid-template-areas: "dot label" "dot value"/);
    assert.match(html, /border-radius: 16px/);
    assert.match(html, /node-label/);
    assert.match(html, /node-value/);
    assert.doesNotMatch(html, /\.node-core \{ width: 20px; height: 20px; border-radius: 50%/);
  });

  it("adds safe vector runtime, embedding, and vector store insight copy", async () => {
    const html = await readGlassWall();

    assert.match(html, /Vector \/ Embedding/);
    assert.match(html, /runtime vectorial/);
    assert.match(html, /relación con modo híbrido/);
    assert.match(html, /query → vector/);
    assert.match(html, /almacén vectorial/);
    assert.match(html, /observación segura/);
    assert.match(html, /semántica activa/);
    assert.match(html, /semántica degradada/);
    assert.match(html, /store consultable/);
    assert.match(html, /store no reportado/);
  });

  it("adds CSS-only graph scan, vector pulse, and edge flow animation", async () => {
    const html = await readGlassWall();

    assert.match(html, /graph-scan/);
    assert.match(html, /vector-breathe/);
    assert.match(html, /edge-flow/);
    assert.match(html, /vector-ring/);
    assert.match(html, /vector-focus/);
    assert.match(html, /stroke-dasharray/);
  });

  it("keeps reduced motion protection", async () => {
    const html = await readGlassWall();

    assert.match(html, /prefers-reduced-motion/);
    assert.match(html, /animation: none !important/);
  });
});
