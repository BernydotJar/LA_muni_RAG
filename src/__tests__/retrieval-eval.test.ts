import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchesExpectedEvidence } from "../evals/retrievalEval.js";

describe("retrieval eval harness", () => {
  it("matches expected citation labels", () => {
    assert.equal(
      matchesExpectedEvidence(
        { citationLabel: "Doc A p. 1" },
        { citationLabel: "Doc A p. 1", documentTitle: "Document A", excerpt: "Local services." }
      ),
      true
    );
  });
});
