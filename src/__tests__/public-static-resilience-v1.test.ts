import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const read = (path: string): Promise<string> => readFile(path, "utf8");

describe("public static resilience v1", () => {
  it("binds the static projection to exactly three governed official PDM-OT sources", async () => {
    const snapshot = JSON.parse(await read("public/public-corpus-snapshot.json")) as {
      schemaVersion: number;
      corpusKind: string;
      retrieval: { semanticModel: boolean; serverAudit: boolean; staticProjection: boolean };
      sources: Array<{ sourceId: string; contentSha256: string; sourceUrl: string; extractedPageCount: number }>;
      sections: Array<{ sourceId: string; pageStart: number; pageEnd: number; text: string }>;
    };
    assert.equal(snapshot.schemaVersion, 1);
    assert.equal(snapshot.corpusKind, "public_official_municipal_static_projection_v1");
    assert.deepEqual(snapshot.retrieval, {
      modes: ["keyword", "phrase"],
      semanticModel: false,
      serverAudit: false,
      staticProjection: true,
    });
    assert.deepEqual(
      snapshot.sources.map(({ sourceId, contentSha256, extractedPageCount }) => ({ sourceId, contentSha256, extractedPageCount })),
      [
        { sourceId: "antigua-pdm-ot", contentSha256: "824f0ee47106f062269a7c65cb3433435470bbe609054972eb29c360f368cd0b", extractedPageCount: 224 },
        { sourceId: "antigua-pdmot-module-3", contentSha256: "dc67c503155c8fe85a6d4ac28b54c715e6293ab8261484d2531750a9ab17a3f0", extractedPageCount: 46 },
        { sourceId: "antigua-pdmot-module-4", contentSha256: "73186847344904a6c4ee64668dad0ec43628b3ca65ed8f12a192a05705a26fa9", extractedPageCount: 22 },
      ]
    );
    assert.equal(snapshot.sections.length, 292);
    assert.ok(snapshot.sources.every((source) => source.sourceUrl.startsWith("https://muniantigua.gob.gt/")));
    assert.ok(snapshot.sections.every((section) => section.pageStart > 0 && section.pageStart === section.pageEnd && section.text.length > 0));
  });

  it("keeps the static runtime honest about lexical retrieval, temporal status, and server audit", async () => {
    const fallback = await read("public/public-corpus-fallback.js");
    assert.match(fallback, /semanticSearch: false/);
    assert.match(fallback, /serverAudit: false/);
    assert.match(fallback, /temporalStatus: "undetermined"/);
    assert.match(fallback, /authorityStatus: "official_target_jurisdiction"/);
    assert.match(fallback, /Fallback estático de una proyección pública de tres documentos oficiales PDM-OT/);
    assert.match(fallback, /not provide semantic search, server audit, identity, or a legal conclusion/i);
    assert.doesNotMatch(fallback, /semanticScore|embeddingProvider|vectorSimilarity|queryEmbedding/i);
  });

  it("keeps unconfigured embeds fail-closed and limits remote fallback to infrastructure availability failures", async () => {
    const bridge = await read("public/pages-api-bridge.js");
    assert.match(bridge, /if \(!configured\) return unavailableResponse\(\)/);
    assert.match(bridge, /\[502, 503, 504\]\.includes\(response\.status\)/);
    assert.match(bridge, /fallbackMode === "static-first"/);
    assert.doesNotMatch(bridge, /\[400, 401, 403, 404, 429, 500/);
  });

  it("builds GitHub Pages with the static projection before the remote bridge", async () => {
    const build = await read("scripts/build-pages.mjs");
    assert.match(build, /public-corpus-fallback\.js/);
    assert.match(build, /data-static-fallback="static-first"/);
    const fallbackIndex = build.indexOf('src="./public-corpus-fallback.js"');
    const bridgeIndex = build.indexOf('src="./pages-api-bridge.js"');
    assert.ok(fallbackIndex >= 0 && bridgeIndex > fallbackIndex);
  });

  it("reuses the client-safe municipal domain pack snapshot instead of static ad-hoc procedure copy", async () => {
    const domain = JSON.parse(await read("public/public-domain-pack-snapshot.json")) as {
      ui: { id: string; branding: { productName: string } };
      classifierRules: Array<{ id: string }>;
      workflowTemplates: Array<{ workflowType: string }>;
    };
    assert.equal(domain.ui.id, "municipal-antigua");
    assert.equal(domain.ui.branding.productName, "LA Muni RAG");
    assert.equal(domain.classifierRules.length, 9);
    assert.equal(domain.workflowTemplates.length, 5);
    assert.ok(domain.workflowTemplates.some((template) => template.workflowType === "potable_water_project"));
    assert.ok(domain.workflowTemplates.some((template) => template.workflowType === "unknown"));
  });
});
