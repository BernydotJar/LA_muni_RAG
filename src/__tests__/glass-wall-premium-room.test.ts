import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readGlassWall = async (): Promise<string> => readFile("public/glass-wall.html", "utf-8");

describe("premium glass wall technical room", () => {
  it("keeps the Glass Wall technical graph entry point", async () => {
    const html = await readGlassWall();

    assert.match(html, /RAG Glass Wall/);
    assert.match(html, /CTO view/);
    assert.match(html, /glass-wall-graph/);
    assert.match(html, /observable signal path/);
  });

  it("adds homepage-coherent technical room chrome", async () => {
    const html = await readGlassWall();

    assert.match(html, /class="back-link" href="\/"/);
    assert.match(html, /Back to LA Muni RAG/);
    assert.match(html, /Technical room/);
    assert.match(html, /premium technical room/);
  });

  it("keeps the approved inspection endpoints unchanged", async () => {
    const html = await readGlassWall();

    assert.match(html, /const approvedEndpointPaths = \["\/health", "\/api\/evidence", "\/api\/answer"\]/);
  });

  it("preserves the safety contract language", async () => {
    const html = await readGlassWall();

    assert.match(html, /safe API output/);
    assert.match(html, /does not render prompts/);
    assert.match(html, /credentials/);
    assert.match(html, /provider keys/);
  });

  it("keeps reduced motion protection", async () => {
    const html = await readGlassWall();

    assert.match(html, /prefers-reduced-motion/);
  });
});
