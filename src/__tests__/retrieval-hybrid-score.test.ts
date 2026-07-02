import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rankHybridCandidates, scoreHybridCandidate } from "../retrieval/hybridScore.js";
import type { HybridCandidate } from "../retrieval/types.js";

const candidate = (overrides: Partial<HybridCandidate>): HybridCandidate => ({
  id: "candidate-1",
  mode: "keyword",
  matchedModes: ["keyword"],
  citationLabel: "PDM-OT Antigua Guatemala, pagina 14",
  documentTitle: "PDM-OT Antigua Guatemala",
  excerpt: "Planificacion territorial para el municipio.",
  pageStart: 14,
  scores: { keyword: 0.5 },
  hybridScore: 0,
  ...overrides,
});

describe("hybrid retrieval scoring", () => {
  it("gives exact phrase candidates a strong ranking advantage", () => {
    const phrase = candidate({
      id: "phrase",
      mode: "phrase",
      matchedModes: ["phrase"],
      scores: { phrase: 1 },
    });
    const vector = candidate({
      id: "vector",
      mode: "vector",
      matchedModes: ["vector"],
      scores: { vector: 1 },
    });

    const ranked = rankHybridCandidates([vector, phrase]);

    assert.equal(ranked[0]?.id, "phrase");
    assert.ok((ranked[0]?.hybridScore ?? 0) > (ranked[1]?.hybridScore ?? 0));
  });

  it("adds provenance score when citation metadata is complete", () => {
    const scored = scoreHybridCandidate(
      candidate({
        chunkId: "chunk-1",
        articleNumber: "12",
        scores: { keyword: 0.5 },
      })
    );

    assert.ok((scored.scores.provenance ?? 0) > 0.8);
    assert.ok(scored.hybridScore > 1);
  });

  it("ranks by deterministic tie breaker when scores match", () => {
    const a = candidate({ id: "a", citationLabel: "A citation", scores: { keyword: 0.4 } });
    const b = candidate({ id: "b", citationLabel: "B citation", scores: { keyword: 0.4 } });

    const ranked = rankHybridCandidates([b, a]);

    assert.equal(ranked[0]?.id, "a");
  });
});
