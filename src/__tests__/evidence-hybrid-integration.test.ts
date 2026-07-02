import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hybridCandidateToEvidence,
  keywordResultToHybridCandidate,
  mapKeywordResultToEvidence,
  mapPhraseResultToEvidence,
  phraseResultToHybridCandidate,
} from "../evidence.js";
import type { KeywordSearchResult, PhraseSearchResult } from "../search.js";

const keywordResult = (overrides: Partial<KeywordSearchResult> = {}): KeywordSearchResult => ({
  documentTitle: "Plan de Desarrollo Municipal",
  documentType: "plan",
  citationLabel: "PDM-OT Antigua Guatemala, pagina 14",
  pageStart: 14,
  keywordScore: 0.12,
  snippet: "La <mark>planificación</mark> territorial busca ordenar el municipio.",
  ...overrides,
});

const phraseResult = (overrides: Partial<PhraseSearchResult> = {}): PhraseSearchResult => ({
  documentTitle: "Plan de Desarrollo Municipal",
  documentType: "plan",
  citationLabel: "PDM-OT Antigua Guatemala, pagina 12",
  pageStart: 12,
  preview: "SIGLAS Y ACRONIMOS: CNPAG...",
  ...overrides,
});

describe("hybrid evidence integration mapping", () => {
  it("keeps existing keyword evidence mapping backward compatible", () => {
    const item = mapKeywordResultToEvidence(keywordResult());

    assert.equal(item.retrievalMode, "keyword");
    assert.equal(item.sourceType, "plan");
    assert.equal(item.excerpt, "La planificación territorial busca ordenar el municipio.");
    assert.equal(item.score, 0.12);
  });

  it("keeps existing phrase evidence mapping backward compatible", () => {
    const item = mapPhraseResultToEvidence(phraseResult());

    assert.equal(item.retrievalMode, "phrase");
    assert.equal(item.sourceType, "plan");
    assert.equal(item.excerpt, "SIGLAS Y ACRONIMOS: CNPAG...");
    assert.equal(item.score, null);
  });

  it("maps keyword search results into hybrid candidates", () => {
    const candidate = keywordResultToHybridCandidate(keywordResult());

    assert.equal(candidate.mode, "keyword");
    assert.deepEqual(candidate.matchedModes, ["keyword"]);
    assert.equal(candidate.citationLabel, "PDM-OT Antigua Guatemala, pagina 14");
    assert.equal(candidate.scores.keyword, 0.12);
  });

  it("maps phrase search results into strong hybrid candidates", () => {
    const candidate = phraseResultToHybridCandidate(phraseResult());

    assert.equal(candidate.mode, "phrase");
    assert.deepEqual(candidate.matchedModes, ["phrase"]);
    assert.equal(candidate.scores.phrase, 1);
  });

  it("maps hybrid candidates back into citable evidence items", () => {
    const candidate = keywordResultToHybridCandidate(keywordResult());
    const item = hybridCandidateToEvidence({
      ...candidate,
      hybridScore: 2.5,
      matchedModes: ["phrase", "keyword"],
    });

    assert.equal(item.retrievalMode, "hybrid");
    assert.equal(item.score, 2.5);
    assert.deepEqual(item.matchedModes, ["phrase", "keyword"]);
    assert.equal(item.citationLabel, "PDM-OT Antigua Guatemala, pagina 14");
  });
});
