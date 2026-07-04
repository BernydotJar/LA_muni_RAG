import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readGlassWall = async (): Promise<string> => readFile("public/glass-wall.html", "utf-8");

describe("glass wall premium refresh", () => {
  it("keeps the CTO glass wall identity", async () => {
    const html = await readGlassWall();

    assert.match(html, /RAG Glass Wall/);
    assert.match(html, /CTO view/);
    assert.match(html, /Glass wall into/);
    assert.match(html, /retrieval/);
  });

  it("adds lightweight premium homepage alignment", async () => {
    const html = await readGlassWall();

    assert.match(html, /Back to LA Muni RAG/);
    assert.match(html, /Technical room/);
    assert.match(html, /No black box/);
    assert.match(html, /glass-orb/);
    assert.match(html, /body::after/);
  });

  it("preserves the safe observable endpoint allowlist", async () => {
    const html = await readGlassWall();

    assert.match(html, /approvedEndpointPaths/);
    assert.match(html, /\/health/);
    assert.match(html, /\/api\/evidence/);
    assert.match(html, /\/api\/answer/);
    assert.match(html, /Endpoint is not approved for glass-wall rendering/);
  });

  it("preserves graph and safety contract elements", async () => {
    const html = await readGlassWall();

    assert.match(html, /id="glass-wall-graph"/);
    assert.match(html, /id="glass-wall-form"/);
    assert.match(html, /id="glass-wall-status"/);
    assert.match(html, /node-not-found/);
    assert.match(html, /node-audit/);
    assert.match(html, /chain-of-thought/);
  });
});
