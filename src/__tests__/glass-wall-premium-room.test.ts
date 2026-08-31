import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readGlassWall = async (): Promise<string> => readFile("public/glass-wall.html", "utf-8");

describe("premium glass wall technical room", () => {
  it("keeps the technical graph entry point in plain Spanish", async () => {
    const html = await readGlassWall();

    assert.match(html, /Cómo funciona · vista técnica/);
    assert.match(html, /Vista técnica/);
    assert.match(html, /glass-wall-graph/);
    assert.match(html, /Ruta de la consulta/);
    assert.match(html, /Mapa de señales/);
  });

  it("adds homepage-coherent technical room chrome", async () => {
    const html = await readGlassWall();

    assert.match(html, /class="back-link" href="\/"/);
    assert.match(html, /Volver al inicio/);
    assert.match(html, /Vista técnica/);
    assert.match(html, /cómo se construye una respuesta/);
  });

  it("uses the deployed public inspection contract", async () => {
    const html = await readGlassWall();

    assert.match(html, /const approvedEndpointPaths = \["\/api\/public\/v1\/query"\]/);
    assert.doesNotMatch(html, /\/api\/evidence/);
    assert.doesNotMatch(html, /\/api\/answer/);
  });

  it("preserves the Spanish safety contract language", async () => {
    const html = await readGlassWall();

    assert.match(html, /Contrato de seguridad/);
    assert.match(html, /datos de diagnóstico autorizados/);
    assert.match(html, /No muestra credenciales/);
    assert.match(html, /credenciales/);
    assert.match(html, /llaves/);
    assert.match(html, /direcciones privadas de bases de datos/);
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

    assert.match(html, /Búsqueda vectorial/);
    assert.match(html, /estado técnico/);
    assert.match(html, /relación con búsqueda combinada/);
    assert.match(html, /representación de la pregunta/);
    assert.match(html, /índice vectorial/);
    assert.match(html, /señal técnica autorizada/);
    assert.match(html, /detalle interno no expuesto/);
    assert.match(html, /combinado = palabras \+ frase exacta/);
    assert.match(html, /representación interna no expuesta/);
    assert.match(html, /índice interno no expuesto/);
    assert.doesNotMatch(html, /semántica activa/);
    assert.doesNotMatch(html, /store consultable/);
  });

  it("keeps graph affordances while disabling decorative continuous motion", async () => {
    const html = await readGlassWall();

    assert.match(html, /graph-scan/);
    assert.match(html, /vector-breathe/);
    assert.match(html, /edge-flow/);
    assert.match(html, /vector-ring/);
    assert.match(html, /vector-focus/);
    assert.match(html, /stroke-dasharray/);
    assert.match(html, /animation: none/);
  });

  it("keeps reduced motion protection", async () => {
    const html = await readGlassWall();

    assert.match(html, /prefers-reduced-motion/);
    assert.match(html, /animation: none !important/);
  });
});
