import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dedupeHybridCandidates } from "../retrieval/dedupe.js";
import type { HybridCandidate } from "../retrieval/types.js";

const candidate = (overrides: Partial<HybridCandidate>): HybridCandidate => ({
  id: "candidate",
  mode: "keyword",
  matchedModes: ["keyword"],
  sectionId: "section-1",
  citationLabel: "PDM-OT Antigua Guatemala, pagina 14",
  excerpt: "Planificacion territorial para el municipio.",
  scores: { keyword: 0.2 },
  hybridScore: 0,
  ...overrides,
});

describe("hybrid retrieval dedupe", () => {
  it("deduplicates candidates by chunk id and preserves contributing modes", () => {
    const keyword = candidate({
      id: "keyword",
      mode: "keyword",
      matchedModes: ["keyword"],
      chunkId: "chunk-1",
      scores: { keyword: 0.4 },
    });
    const vector = candidate({
      id: "vector",
      mode: "vector",
      matchedModes: ["vector"],
      chunkId: "chunk-1",
      scores: { vector: 0.9 },
    });

    const deduped = dedupeHybridCandidates([keyword, vector]);

    assert.equal(deduped.length, 1);
    assert.deepEqual(deduped[0]?.matchedModes, ["keyword", "vector"]);
    assert.equal(deduped[0]?.scores.keyword, 0.4);
    assert.equal(deduped[0]?.scores.vector, 0.9);
  });

  it("uses phrase as primary mode when duplicate includes an exact phrase match", () => {
    const keyword = candidate({ mode: "keyword", matchedModes: ["keyword"] });
    const phrase = candidate({ mode: "phrase", matchedModes: ["phrase"], scores: { phrase: 1 } });

    const deduped = dedupeHybridCandidates([keyword, phrase]);

    assert.equal(deduped[0]?.mode, "phrase");
    assert.deepEqual(deduped[0]?.matchedModes, ["phrase", "keyword"]);
  });

  it("deduplicates by citation and excerpt hash when ids are unavailable", () => {
    const first = candidate({ sectionId: undefined, chunkId: undefined, id: "first" });
    const second = candidate({ sectionId: undefined, chunkId: undefined, id: "second" });

    const deduped = dedupeHybridCandidates([first, second]);

    assert.equal(deduped.length, 1);
  });
});
