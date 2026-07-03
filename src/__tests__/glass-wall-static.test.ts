import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const glassWallPath = join(process.cwd(), "public", "glass-wall.html");

const readGlassWall = async (): Promise<string> => readFile(glassWallPath, "utf-8");

describe("RAG glass wall static page", () => {
  it("contains stable DOM anchors for the operator view", async () => {
    const html = await readGlassWall();

    assert.match(html, /id="glass-wall-form"/);
    assert.match(html, /id="glass-wall-query"/);
    assert.match(html, /id="glass-wall-mode"/);
    assert.match(html, /id="glass-wall-graph"/);
    assert.match(html, /id="glass-wall-results"/);
    assert.match(html, /id="glass-wall-runtime"/);
    assert.match(html, /id="glass-wall-safety"/);
    assert.match(html, /id="glass-wall-legend"/);
    assert.match(html, /id="glass-wall-legend-panel"/);
  });

  it("contains expanded graph nodes for the CTO glass wall", async () => {
    const html = await readGlassWall();
    const expectedNodes = [
      "node-query",
      "node-mode",
      "node-limit",
      "node-corpus",
      "node-safety",
      "node-phrase",
      "node-keyword",
      "node-vector",
      "node-embedding",
      "node-db",
      "node-runtime",
      "node-evidence-1",
      "node-evidence-2",
      "node-evidence-3",
      "node-evidence-4",
      "node-evidence-5",
      "node-citation",
      "node-score",
      "node-answer",
      "node-not-found",
      "node-degraded",
      "node-audit",
    ];

    for (const nodeId of expectedNodes) {
      assert.match(html, new RegExp(`id="${nodeId}"`));
    }
  });

  it("references only approved application endpoints", async () => {
    const html = await readGlassWall();
    const endpointMatches = [...html.matchAll(/["'`]\/(?:api\/[a-z]+|health)[^"'`]*/g)].map((match) =>
      match[0].slice(1)
    );
    const uniqueEndpoints = [...new Set(endpointMatches)];

    assert.ok(uniqueEndpoints.length > 0);
    assert.deepEqual(
      uniqueEndpoints.filter((endpoint) => !endpoint.startsWith("/health") && !endpoint.startsWith("/api/evidence") && !endpoint.startsWith("/api/answer")),
      []
    );
  });

  it("does not include obvious secret or hidden-reasoning markers", async () => {
    const html = await readGlassWall();
    const forbiddenPatterns = [
      /DATABASE_URL\s*=/i,
      /OPENAI_API_KEY\s*=/i,
      /ANTHROPIC_API_KEY\s*=/i,
      /GOOGLE_API_KEY\s*=/i,
      /password\s*=/i,
      /secret\s*=/i,
      /chain[- ]of[- ]thought\s*:/i,
      /system prompt\s*:/i,
    ];

    for (const pattern of forbiddenPatterns) {
      assert.doesNotMatch(html, pattern);
    }
  });

  it("declares the safe glass-wall contract and visible legend", async () => {
    const html = await readGlassWall();

    assert.match(html, /RAG Glass Wall/);
    assert.match(html, /safe API output/);
    assert.match(html, /sanitized runtime state/);
    assert.match(html, /active path/);
    assert.match(html, /degraded/);
    assert.match(html, /inactive/);
  });
});
