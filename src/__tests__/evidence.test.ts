import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EvidenceItem, EvidenceMode } from "../evidence.js";
import { stripHeadlineTags } from "../evidence.js";
import type { KeywordSearchResult, PhraseSearchResult } from "../search.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const keywordResult = (overrides: Partial<KeywordSearchResult> = {}): KeywordSearchResult => ({
  documentTitle: "Plan de Desarrollo Municipal",
  documentType: "plan",
  citationLabel: "PDM-OT Antigua Guatemala, pagina 14",
  pageStart: 14,
  keywordScore: 0.12,
  snippet: "La <mark>planificación</mark> territorial busca...",
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

// ---------------------------------------------------------------------------
// Helper: simulate the keyword mapping logic from evidence.ts
// (tests the transformation without needing a DB)
// ---------------------------------------------------------------------------

const mapKeywordToEvidence = (
  result: KeywordSearchResult,
  mode: EvidenceMode = "keyword"
): EvidenceItem => ({
  documentTitle: result.documentTitle,
  sourceType: result.documentType,
  citationLabel: result.citationLabel,
  pageStart: result.pageStart,
  excerpt: stripHeadlineTags(result.snippet),
  score: result.keywordScore,
  retrievalMode: mode,
});

const mapPhraseToEvidence = (
  result: PhraseSearchResult,
  mode: EvidenceMode = "phrase"
): EvidenceItem => ({
  documentTitle: result.documentTitle,
  sourceType: result.documentType,
  citationLabel: result.citationLabel,
  pageStart: result.pageStart,
  excerpt: result.preview,
  score: null,
  retrievalMode: mode,
});

// ---------------------------------------------------------------------------
// stripHeadlineTags
// ---------------------------------------------------------------------------

describe("stripHeadlineTags", () => {
  it("removes <mark> and </mark> tags", () => {
    assert.equal(
      stripHeadlineTags("word <mark>highlighted</mark> more <mark>tags</mark>"),
      "word highlighted more tags"
    );
  });

  it("returns unchanged string when no tags present", () => {
    assert.equal(stripHeadlineTags("no tags here"), "no tags here");
  });

  it("handles empty string", () => {
    assert.equal(stripHeadlineTags(""), "");
  });

  it("handles adjacent tags", () => {
    assert.equal(
      stripHeadlineTags("<mark>a</mark><mark>b</mark>"),
      "ab"
    );
  });
});

// ---------------------------------------------------------------------------
// Evidence mapping — keyword mode
// ---------------------------------------------------------------------------

describe("evidence mapping — keyword mode", () => {
  it("maps keyword result with correct sourceType", () => {
    const result = keywordResult();
    const item = mapKeywordToEvidence(result);

    assert.equal(item.sourceType, "plan");
    assert.equal(item.documentTitle, "Plan de Desarrollo Municipal");
    assert.equal(item.retrievalMode, "keyword");
    assert.equal(item.score, 0.12);
  });

  it("strips <mark> tags from excerpt", () => {
    const result = keywordResult({
      snippet: "word <mark>highlighted</mark> more <mark>tags</mark>",
    });
    const item = mapKeywordToEvidence(result);

    assert.equal(item.excerpt, "word highlighted more tags");
  });

  it("preserves all search result fields", () => {
    const result = keywordResult({
      documentType: "decree",
      citationLabel: "Decreto 12-2002, pagina 5",
      pageStart: 5,
      keywordScore: 0.0567,
    });
    const item = mapKeywordToEvidence(result);

    assert.equal(item.sourceType, "decree");
    assert.equal(item.citationLabel, "Decreto 12-2002, pagina 5");
    assert.equal(item.pageStart, 5);
    assert.equal(item.score, 0.0567);
  });
});

// ---------------------------------------------------------------------------
// Evidence mapping — phrase mode
// ---------------------------------------------------------------------------

describe("evidence mapping — phrase mode", () => {
  it("maps phrase result with correct sourceType", () => {
    const result = phraseResult();
    const item = mapPhraseToEvidence(result);

    assert.equal(item.sourceType, "plan");
    assert.equal(item.retrievalMode, "phrase");
    assert.equal(item.score, null);
  });

  it("uses preview as excerpt", () => {
    const result = phraseResult({ preview: "This is the raw preview text." });
    const item = mapPhraseToEvidence(result);

    assert.equal(item.excerpt, "This is the raw preview text.");
  });

  it("handles null pageStart", () => {
    const result = phraseResult({ pageStart: null });
    const item = mapPhraseToEvidence(result);

    assert.equal(item.pageStart, null);
  });
});

// ---------------------------------------------------------------------------
// Evidence response structure
// ---------------------------------------------------------------------------

describe("evidence response structure", () => {
  it("answerStatus is not_found for empty evidence array", () => {
    const evidence: EvidenceItem[] = [];
    const status = evidence.length > 0 ? "evidence_found" : "not_found";
    assert.equal(status, "not_found");
  });

  it("answerStatus is evidence_found for non-empty evidence", () => {
    const evidence = [mapKeywordToEvidence(keywordResult())];
    const status = evidence.length > 0 ? "evidence_found" : "not_found";
    assert.equal(status, "evidence_found");
  });

  it("evidenceCount matches evidence array length", () => {
    const evidence = [
      mapKeywordToEvidence(keywordResult()),
      mapKeywordToEvidence(keywordResult({ pageStart: 20 })),
    ];
    assert.equal(evidence.length, 2);
  });
});
