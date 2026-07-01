import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { EvidenceItem, EvidenceMode } from "../evidence.js";
import {
  assessSufficiency,
  assessConfidence,
  buildSummary,
} from "../agent.js";

// ---------------------------------------------------------------------------
// Factory helper — creates an EvidenceItem with sensible defaults
// ---------------------------------------------------------------------------

const evidenceItem = (overrides: Partial<EvidenceItem> = {}): EvidenceItem => ({
  documentTitle: "Plan de Desarrollo Municipal",
  sourceType: "plan",
  citationLabel: "PDM-OT Antigua Guatemala, pagina 14",
  pageStart: 14,
  excerpt: "La planificación territorial busca...",
  score: 0.08,
  retrievalMode: "keyword",
  ...overrides,
});

// ---------------------------------------------------------------------------
// assessSufficiency
// ---------------------------------------------------------------------------

describe("assessSufficiency", () => {
  it("returns not_found when evidence is empty", () => {
    assert.equal(assessSufficiency([], "keyword"), "not_found");
    assert.equal(assessSufficiency([], "phrase"), "not_found");
  });

  it("returns evidence_found when ≥3 results (bulk threshold)", () => {
    const items = [evidenceItem(), evidenceItem(), evidenceItem()];
    assert.equal(assessSufficiency(items, "keyword"), "evidence_found");
  });

  it("returns evidence_found for phrase mode with any results", () => {
    const items = [evidenceItem({ score: null, retrievalMode: "phrase" })];
    assert.equal(assessSufficiency(items, "phrase"), "evidence_found");
  });

  it("returns evidence_found when top score ≥ 0.05", () => {
    const items = [evidenceItem({ score: 0.06 })];
    assert.equal(assessSufficiency(items, "keyword"), "evidence_found");
  });

  it("returns insufficient_evidence for few results with very low scores", () => {
    const items = [
      evidenceItem({ score: 0.005 }),
      evidenceItem({ score: 0.003 }),
    ];
    assert.equal(assessSufficiency(items, "keyword"), "insufficient_evidence");
  });

  it("returns evidence_found for few results with scores between 0.01 and 0.05", () => {
    const items = [evidenceItem({ score: 0.02 })];
    assert.equal(assessSufficiency(items, "keyword"), "evidence_found");
  });
});

// ---------------------------------------------------------------------------
// assessConfidence
// ---------------------------------------------------------------------------

describe("assessConfidence", () => {
  it("returns low for not_found", () => {
    assert.equal(assessConfidence("not_found", []), "low");
  });

  it("returns low for insufficient_evidence", () => {
    const items = [evidenceItem({ score: 0.005 })];
    assert.equal(assessConfidence("insufficient_evidence", items), "low");
  });

  it("returns high for many strong-scored results", () => {
    const items = [
      evidenceItem({ score: 0.12 }),
      evidenceItem({ score: 0.09 }),
      evidenceItem({ score: 0.06 }),
    ];
    assert.equal(assessConfidence("evidence_found", items), "high");
  });

  it("returns medium for strong score but few results", () => {
    const items = [evidenceItem({ score: 0.08 })];
    assert.equal(assessConfidence("evidence_found", items), "medium");
  });

  it("returns medium for phrase mode with many results (no scores)", () => {
    const items = [
      evidenceItem({ score: null }),
      evidenceItem({ score: null }),
      evidenceItem({ score: null }),
    ];
    assert.equal(assessConfidence("evidence_found", items), "high");
  });

  it("returns medium for phrase mode with few results (no scores)", () => {
    const items = [evidenceItem({ score: null })];
    assert.equal(assessConfidence("evidence_found", items), "medium");
  });
});

// ---------------------------------------------------------------------------
// buildSummary
// ---------------------------------------------------------------------------

describe("buildSummary", () => {
  it("reports not found for empty evidence", () => {
    const summary = buildSummary("xyz", "not_found", [], []);
    assert.equal(summary, "No evidence found for 'xyz' in the municipal corpus.");
  });

  it("includes count, source types, and top score", () => {
    const items = [
      evidenceItem({ score: 0.12, sourceType: "plan" }),
      evidenceItem({ score: 0.08, sourceType: "decree" }),
    ];
    const summary = buildSummary("test", "evidence_found", items, ["plan", "decree"]);
    assert.ok(summary.includes("2 citations"));
    assert.ok(summary.includes("plan, decree"));
    assert.ok(summary.includes("0.1200"));
  });

  it("omits score when all scores are null (phrase mode)", () => {
    const items = [evidenceItem({ score: null })];
    const summary = buildSummary("CNPAG", "evidence_found", items, ["plan"]);
    assert.ok(summary.includes("1 citation"));
    assert.ok(summary.includes("plan"));
    assert.ok(!summary.includes("top score"));
  });

  it("notes insufficient evidence when label says so", () => {
    const items = [evidenceItem({ score: 0.005 })];
    const summary = buildSummary("test", "insufficient_evidence", items, ["plan"]);
    assert.ok(summary.includes("insufficient"));
  });

  it("uses singular 'citation' for single result", () => {
    const items = [evidenceItem()];
    const summary = buildSummary("test", "evidence_found", items, ["plan"]);
    assert.ok(summary.includes("1 citation"));
    assert.ok(!summary.includes("citations"));
  });
});
