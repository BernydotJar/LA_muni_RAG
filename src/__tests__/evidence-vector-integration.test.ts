import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findEvidenceWithDependencies, type EvidenceDependencies } from "../evidence.js";
import type { QueryEmbeddingProvider } from "../embeddings/queryEmbedding.js";
import type { KeywordSearchResult, PhraseSearchResult } from "../search.js";
import type { VectorCandidateInput, VectorRetrievalRepository } from "../retrieval/vectorRetriever.js";

class StaticQueryEmbeddingProvider implements QueryEmbeddingProvider {
  readonly providerName = "test";
  readonly model = "static-query-vector";
  readonly dimensions = 3;

  async embedQuery(): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }
}

class StaticVectorRepository implements VectorRetrievalRepository {
  constructor(private readonly results: VectorCandidateInput[]) {}

  async search(queryVector: number[], limit: number): Promise<VectorCandidateInput[]> {
    assert.deepEqual(queryVector, [0.1, 0.2, 0.3]);
    return this.results.slice(0, limit);
  }
}

class FailingQueryEmbeddingProvider implements QueryEmbeddingProvider {
  readonly providerName = "test";
  readonly model = "failing-query-vector";
  readonly dimensions = 3;

  async embedQuery(): Promise<number[]> {
    throw new Error("provider unavailable");
  }
}

const emptyKeywordSearch = async (): Promise<KeywordSearchResult[]> => [];
const emptyPhraseSearch = async (): Promise<PhraseSearchResult[]> => [];

const offlineSearchDependencies = {
  keywordSearch: emptyKeywordSearch,
  phraseSearch: emptyPhraseSearch,
};

const vectorOnlyDependencies = (results: VectorCandidateInput[]): EvidenceDependencies => ({
  ...offlineSearchDependencies,
  queryEmbeddingProvider: new StaticQueryEmbeddingProvider(),
  vectorRepository: new StaticVectorRepository(results),
});

describe("vector query integration in hybrid evidence", () => {
  it("includes citable vector candidates in hybrid evidence", async () => {
    const response = await findEvidenceWithDependencies(
      "semantic vector query",
      "hybrid",
      5,
      vectorOnlyDependencies([
        {
          chunkId: "chunk-1",
          documentTitle: "PDM-OT Antigua Guatemala",
          citationLabel: "PDM-OT Antigua Guatemala, pagina 14",
          excerpt: "El ordenamiento territorial organiza el uso del suelo municipal.",
          sourceType: "pdf",
          pageStart: 14,
          pageEnd: 14,
          similarity: 0.91,
        },
      ])
    );

    assert.equal(response.mode, "hybrid");
    assert.equal(response.answerStatus, "evidence_found");
    assert.ok(response.evidence.length >= 1);
    assert.ok(response.evidence.some((item) => item.matchedModes?.includes("vector")));
  });

  it("filters uncitable vector candidates before evidence mapping", async () => {
    const response = await findEvidenceWithDependencies(
      "uncitable vector query",
      "hybrid",
      5,
      vectorOnlyDependencies([
        {
          chunkId: "chunk-uncitable",
          documentTitle: "Uncitable Document",
          citationLabel: "   ",
          excerpt: "This should not become evidence.",
          similarity: 0.99,
        },
      ])
    );

    assert.equal(response.answerStatus, "not_found");
    assert.deepEqual(response.evidence, []);
  });

  it("degrades to phrase and keyword candidates when vector dependencies are missing", async () => {
    const response = await findEvidenceWithDependencies("vectorless query", "hybrid", 5, offlineSearchDependencies);

    assert.equal(response.mode, "hybrid");
    assert.equal(response.answerStatus, "not_found");
    assert.deepEqual(response.evidence, []);
  });

  it("degrades safely when the query embedding provider fails", async () => {
    const response = await findEvidenceWithDependencies("provider failure query", "hybrid", 5, {
      ...offlineSearchDependencies,
      queryEmbeddingProvider: new FailingQueryEmbeddingProvider(),
      vectorRepository: new StaticVectorRepository([
        {
          chunkId: "chunk-1",
          citationLabel: "Should not be reached",
          excerpt: "This candidate should not be returned.",
          similarity: 0.9,
        },
      ]),
    });

    assert.equal(response.answerStatus, "not_found");
    assert.deepEqual(response.evidence, []);
  });

  it("keeps keyword and phrase modes independent from vector dependencies", async () => {
    const dependencies = vectorOnlyDependencies([
      {
        chunkId: "chunk-1",
        citationLabel: "Vector Doc, page 1",
        excerpt: "Vector-only evidence.",
        similarity: 0.9,
      },
    ]);

    const keyword = await findEvidenceWithDependencies("keyword only query", "keyword", 5, dependencies);
    const phrase = await findEvidenceWithDependencies("phrase only query", "phrase", 5, dependencies);

    assert.equal(keyword.mode, "keyword");
    assert.equal(phrase.mode, "phrase");
    assert.deepEqual(keyword.evidence, []);
    assert.deepEqual(phrase.evidence, []);
  });
});
