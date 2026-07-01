import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EvidenceItem } from "../evidence.js";

const evidenceItem = (overrides: Partial<EvidenceItem> = {}): EvidenceItem => ({
  documentTitle: "Plan de Desarrollo Municipal",
  sourceType: "plan",
  citationLabel: "PDM-OT Antigua Guatemala, pagina 12",
  pageStart: 12,
  excerpt: "CNPAG Consejo Nacional para la Proteccion de Antigua Guatemala",
  score: null,
  retrievalMode: "phrase",
  ...overrides,
});

const mapCitations = (evidence: EvidenceItem[]) =>
  evidence.map((item) => ({
    citationLabel: item.citationLabel,
    documentTitle: item.documentTitle,
    sourceType: item.sourceType,
    pageStart: item.pageStart,
  }));

describe("deterministic answer contract", () => {
  it("uses draft_grounded and citations when evidence exists", () => {
    const evidence = [evidenceItem()];
    const response = {
      answerStatus: evidence.length > 0 ? "draft_grounded" : "not_found",
      answerLabel: evidence.length > 0 ? "draft" : "not_found",
      citations: mapCitations(evidence),
      evidence,
    };

    assert.equal(response.answerStatus, "draft_grounded");
    assert.equal(response.answerLabel, "draft");
    assert.equal(response.citations.length, 1);
    assert.equal(response.citations[0]?.citationLabel, "PDM-OT Antigua Guatemala, pagina 12");
  });

  it("uses not_found without citations when evidence is empty", () => {
    const evidence: EvidenceItem[] = [];
    const response = {
      answerStatus: evidence.length > 0 ? "draft_grounded" : "not_found",
      answerLabel: evidence.length > 0 ? "draft" : "not_found",
      citations: mapCitations(evidence),
      evidence,
    };

    assert.equal(response.answerStatus, "not_found");
    assert.equal(response.answerLabel, "not_found");
    assert.deepEqual(response.citations, []);
    assert.deepEqual(response.evidence, []);
  });
});
