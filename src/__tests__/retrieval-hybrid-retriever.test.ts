import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildHybridRetrievalResult } from "../retrieval/hybridRetriever.js";
import { retrieveVectorCandidates, type VectorRetrievalRepository } from "../retrieval/vectorRetriever.js";
import type { HybridCandidate } from "../retrieval/types.js";

const candidate = (overrides: Partial<HybridCandidate>): HybridCandidate => ({
  id: "candidate",
  mode: "keyword",
  matchedModes: ["keyword"],
  citationLabel: "PDM-OT Antigua Guatemala, pagina 14",
  documentTitle: "PDM-OT Antigua Guatemala",
  excerpt: "Planificacion territorial para el municipio.",
  scores: { keyword: 0.5 },
  hybridScore: 0,
  ...overrides,
});

class StaticVectorRepository implements VectorRetrievalRepository {
  async search(_queryVector: number[], _limit: number) {
    return [
      {
        chunkId: "chunk-vector",
        sectionId: "section-vector",
        documentTitle: "PDM-OT Antigua Guatemala",
        citationLabel: "PDM-OT Antigua Guatemala, pagina 20",
        excerpt: "Movilidad, uso de suelo y planificacion territorial.",
        pageStart: 20,
        similarity: 0.88,
      },
    ];
  }
}

describe("hybrid retrieval orchestration", () => {
  it("merges phrase, keyword, and vector candidates into ranked evidence", async () => {
    const vectorCandidates = await retrieveVectorCandidates(new StaticVectorRepository(), [0.1, 0.2], 5);
    const result = buildHybridRetrievalResult({
      phraseCandidates: [
        candidate({
          id: "phrase",
          mode: "phrase",
          matchedModes: ["phrase"],
          chunkId: "chunk-phrase",
          scores: { phrase: 1 },
        }),
      ],
      keywordCandidates: [candidate({ id: "keyword", chunkId: "chunk-keyword" })],
      vectorCandidates,
      limit: 10,
    });

    assert.equal(result.totalBeforeDedupe, 3);
    assert.equal(result.totalAfterDedupe, 3);
    assert.equal(result.candidates[0]?.mode, "phrase");
    assert.equal(result.candidates.some((item) => item.mode === "vector"), true);
  });

  it("deduplicates overlapping candidates before applying final limit", () => {
    const result = buildHybridRetrievalResult({
      keywordCandidates: [candidate({ id: "keyword", chunkId: "same-chunk" })],
      vectorCandidates: [
        candidate({
          id: "vector",
          mode: "vector",
          matchedModes: ["vector"],
          chunkId: "same-chunk",
          scores: { vector: 0.9 },
        }),
      ],
      limit: 5,
    });

    assert.equal(result.totalBeforeDedupe, 2);
    assert.equal(result.totalAfterDedupe, 1);
    assert.deepEqual(result.candidates[0]?.matchedModes, ["keyword", "vector"]);
  });

  it("filters uncitable candidates", () => {
    const result = buildHybridRetrievalResult({
      keywordCandidates: [candidate({ citationLabel: "" })],
      vectorCandidates: [candidate({ id: "vector", mode: "vector", matchedModes: ["vector"] })],
    });

    assert.equal(result.totalBeforeDedupe, 1);
    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0]?.mode, "vector");
  });
});
